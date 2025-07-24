// server/controllers/meetingController.js
const Meeting = require('../models/Meeting');
const { joinGoogleMeet } = require('../services/automation/googleMeet');
const { joinMicrosoftTeams } = require('../services/automation/microsoftTeams');
const { joinZoom } = require('../services/automation/zoom');
const { startRealtimeTranscription, stopRealtimeTranscription } = require('../services/transcription/googleCloudSpeechToText');
const { generateTranscriptionFilename, ensureTranscriptionDirectory } = require('../services/utils');
const cron = require('node-cron');
const { Writable } = require('stream'); // For simulated audio stream

// Store active Puppeteer browsers and transcription streams
const activeMeetings = {}; // { meetingId: { browser, page, transcriptionStream, transcriptionFilePath } }

// Middleware to protect routes (simplified)
const auth = (req, res, next) => {
    // Implement actual JWT verification here
    // For now, assume a userId is passed or retrieved
    req.user = { id: req.header('x-auth-token') }; // Placeholder
    if (!req.user.id) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }
    next();
};


exports.scheduleMeeting = async (req, res) => {
    const {
        platform,
        meetingLink,
        meetingId,
        meetingPassword,
        scheduledTime,
        autoJoin,
        micOn,
        cameraOn,
        enableTranscription,
        userName // ADDED: Receive userName from the frontend form
    } = req.body;

    try {
        const newMeeting = new Meeting({
            userId: req.user.id, // From auth middleware (ensure this is a valid ObjectId)
            platform,
            meetingLink,
            meetingId,
            meetingPassword,
            scheduledTime: new Date(scheduledTime),
            autoJoin,
            micOn,
            cameraOn,
            enableTranscription,
            // You could store the userName in the meeting model if desired, but passing it directly is fine for now
        });

        await newMeeting.save();

        // Schedule the meeting join
        const cronTime = new Date(scheduledTime);
        const cronExpression = `${cronTime.getSeconds()} ${cronTime.getMinutes()} ${cronTime.getHours()} ${cronTime.getDate()} ${cronTime.getMonth() + 1} *`;

        console.log(`Scheduling meeting ${newMeeting._id} for ${cronTime.toLocaleString()} with cron: ${cronExpression}`);

        cron.schedule(cronExpression, async () => {
            console.log(`Attempting to join meeting: ${newMeeting._id} at ${new Date().toLocaleString()}`);
            await joinMeetingAutomation(newMeeting._id, userName); // MODIFIED: Pass userName to joinMeetingAutomation
        }, {
            timezone: "Asia/Kolkata" // Set your desired timezone
        });


        res.status(201).json(newMeeting);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getMeetings = async (req, res) => {
    try {
        const meetings = await Meeting.find({ userId: req.user.id }).sort({ scheduledTime: -1 });
        res.json(meetings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getTranscription = async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting || !meeting.transcriptionPath) {
            return res.status(404).json({ msg: 'Transcription not found' });
        }
        res.download(meeting.transcriptionPath);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Function to initiate meeting join and transcription
// MODIFIED: Added userName parameter
const joinMeetingAutomation = async (meetingId, userNameFromForm) => {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
        console.error(`Meeting with ID ${meetingId} not found.`);
        return;
    }

    if (!meeting.autoJoin) {
        console.log(`Auto-join disabled for meeting ${meetingId}. Skipping.`);
        return;
    }

    let result;
    let browser, page;
    try {
        await Meeting.findByIdAndUpdate(meetingId, { status: 'in-progress' });

        const credentials = {
            email: process.env.GOOGLE_ACCOUNT_EMAIL, // Example: for Google Meet sign-in
            password: process.env.GOOGLE_ACCOUNT_PASSWORD,
            name: userNameFromForm || 'Meeting Automator Bot' // Use the provided name or a default
        };

        switch (meeting.platform) {
            case 'Google Meet':
                result = await joinGoogleMeet(meeting.meetingLink, meeting.micOn, meeting.cameraOn, credentials);
                break;
            case 'Microsoft Teams':
                // Pass credentials to Teams if it supports displaying a name without full login
                result = await joinMicrosoftTeams(meeting.meetingLink, meeting.micOn, meeting.cameraOn, credentials);
                break;
            case 'Zoom':
                // Pass credentials to Zoom if it supports displaying a name without full login
                result = await joinZoom(meeting.meetingLink, meeting.meetingId, meeting.meetingPassword, meeting.micOn, meeting.cameraOn, credentials);
                break;
            default:
                throw new Error('Unsupported meeting platform');
        }

        if (result.success) {
            console.log(`Successfully joined ${meeting.platform} for meeting ${meetingId}.`);
            browser = result.browser;
            page = result.page;

            let transcriptionStream = null;
            let transcriptionFilePath = null;

            if (meeting.enableTranscription) {
                ensureTranscriptionDirectory();
                transcriptionFilePath = generateTranscriptionFilename(meetingId);
                await Meeting.findByIdAndUpdate(meetingId, { transcriptionPath: transcriptionFilePath });

                const simulatedAudioStream = new Writable({
                    write(chunk, encoding, callback) {
                        callback();
                    }
                });

                transcriptionStream = await startRealtimeTranscription(simulatedAudioStream, transcriptionFilePath);
                console.log(`Transcription started for meeting ${meetingId}.`);
            }

            activeMeetings[meetingId] = { browser, page, transcriptionStream, transcriptionFilePath };

            setTimeout(async () => {
                console.log(`Meeting duration ended for ${meetingId}. Closing browser and stopping transcription.`);
                if (browser) await browser.close();
                if (transcriptionStream) stopRealtimeTranscription(transcriptionStream);
                await Meeting.findByIdAndUpdate(meetingId, { status: 'completed' });
                delete activeMeetings[meetingId];
            }, 3 * 60 * 60 * 1000); // Example: Keep meeting open for 3 hours
        } else {
            // Log the specific error from joinGoogleMeet for better diagnostics
            await Meeting.findByIdAndUpdate(meetingId, { status: 'failed', errorMessage: result.error });
            console.error(`Failed to join ${meeting.platform} for meeting ${meetingId}: ${result.error}`);
        }
    } catch (error) {
        await Meeting.findByIdAndUpdate(meetingId, { status: 'failed', errorMessage: error.message });
        console.error(`Unhandled error in meeting automation for ${meetingId}: ${error.message}`);
        if (browser) await browser.close();
        if (activeMeetings[meetingId] && activeMeetings[meetingId].transcriptionStream) {
            stopRealtimeTranscription(activeMeetings[meetingId].transcriptionStream);
        }
        delete activeMeetings[meetingId];
    }
};