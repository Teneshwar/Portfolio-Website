// client/src/components/MeetingForm.jsx
import React, { useState } from 'react';
import axios from 'axios';

const MeetingForm = ({ onMeetingScheduled }) => {
    const [platform, setPlatform] = useState('');
    const [meetingLink, setMeetingLink] = useState('');
    const [meetingId, setMeetingId] = useState('');
    const [meetingPassword, setMeetingPassword] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [autoJoin, setAutoJoin] = useState(true);
    const [micOn, setMicOn] = useState(false);
    const [cameraOn, setCameraOn] = useState(false);
    const [enableTranscription, setEnableTranscription] = useState(true);
    // ADDED: State for the user's name to be used in meetings
    const [userName, setUserName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        // Ensure date format is YYYY-MM-DD for reliable Date object creation
        // If scheduledDate is already YYYY-MM-DD from the input type="date", this is fine.
        // If it was DD-MM-YYYY, you'd need to reformat it here.
        const fullScheduledTime = new Date(`${scheduledDate}T${scheduledTime}`);

        // VALIDATION: Basic check for valid date
        if (isNaN(fullScheduledTime.getTime())) {
            setError("Invalid date or time. Please ensure correct format.");
            setLoading(false);
            return;
        }

        try {
            // In a real app, you'd get the token from localStorage after login
            const token = 'someUserId123'; // Mock token for now

            const response = await axios.post('http://localhost:5000/api/meetings', {
                platform,
                meetingLink,
                meetingId: platform === 'Zoom' ? meetingId : undefined,
                meetingPassword: platform === 'Zoom' || platform === 'Microsoft Teams' ? meetingPassword : undefined,
                scheduledTime: fullScheduledTime.toISOString(),
                autoJoin,
                micOn,
                cameraOn,
                enableTranscription,
                // ADDED: Pass the userName to the backend
                userName: userName,
            }, {
                headers: {
                    'x-auth-token': token
                }
            });
            setSuccess('Meeting scheduled successfully!');
            onMeetingScheduled(response.data);
            // Clear form
            setPlatform('');
            setMeetingLink('');
            setMeetingId('');
            setMeetingPassword('');
            setScheduledDate('');
            setScheduledTime('');
            setAutoJoin(true);
            setMicOn(false);
            setCameraOn(false);
            setEnableTranscription(true);
            // ADDED: Clear userName field after submission
            setUserName('');

        } catch (err) {
            console.error('Error scheduling meeting:', err);
            setError(err.response?.data?.msg || 'Failed to schedule meeting.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 bg-white shadow-md rounded-lg mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Schedule New Meeting</h2>

            {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{success}</div>}
            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                    <label htmlFor="platform" className="block text-gray-700 text-sm font-bold mb-2">
                        Platform:
                    </label>
                    <select
                        id="platform"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                    >
                        <option value="">Select Platform</option>
                        <option value="Google Meet">Google Meet</option>
                        <option value="Microsoft Teams">Microsoft Teams</option>
                        <option value="Zoom">Zoom</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label htmlFor="meetingLink" className="block text-gray-700 text-sm font-bold mb-2">
                        Meeting Link:
                    </label>
                    <input
                        type="url"
                        id="meetingLink"
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        placeholder="https://meet.google.com/..."
                        required
                    />
                </div>

                {(platform === 'Zoom' || platform === 'Microsoft Teams') && (
                    <div className="mb-4">
                        <label htmlFor="meetingId" className="block text-gray-700 text-sm font-bold mb-2">
                            Meeting ID (Optional for Teams, Required for Zoom):
                        </label>
                        <input
                            type="text"
                            id="meetingId"
                            value={meetingId}
                            onChange={(e) => setMeetingId(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="e.g., 123 4567 8900"
                            required={platform === 'Zoom'}
                        />
                    </div>
                )}

                {(platform === 'Zoom' || platform === 'Microsoft Teams') && (
                    <div className="mb-4">
                        <label htmlFor="meetingPassword" className="block text-gray-700 text-sm font-bold mb-2">
                            Meeting Password (Optional):
                        </label>
                        <input
                            type="text"
                            id="meetingPassword"
                            value={meetingPassword}
                            onChange={(e) => setMeetingPassword(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="e.g., abcXYZ"
                        />
                    </div>
                )}

                <div className="mb-4">
                    <label htmlFor="scheduledDate" className="block text-gray-700 text-sm font-bold mb-2">
                        Scheduled Date:
                    </label>
                    <input
                        type="date"
                        id="scheduledDate"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                    />
                </div>

                <div className="mb-4">
                    <label htmlFor="scheduledTime" className="block text-gray-700 text-sm font-bold mb-2">
                        Scheduled Time:
                    </label>
                    <input
                        type="time"
                        id="scheduledTime"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        required
                    />
                </div>
            </div>

            {/* ADDED: Input field for the user's name */}
            <div className="mb-4">
                <label htmlFor="userName" className="block text-gray-700 text-sm font-bold mb-2">
                    Your Name (for meeting display):
                </label>
                <input
                    type="text"
                    id="userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    placeholder="e.g., John Doe"
                    required // Make name required for joining meetings
                />
            </div>


            <div className="mb-4 flex items-center">
                <input
                    type="checkbox"
                    id="autoJoin"
                    checked={autoJoin}
                    onChange={(e) => setAutoJoin(e.target.checked)}
                    className="mr-2 leading-tight"
                />
                <label htmlFor="autoJoin" className="text-gray-700 text-sm font-bold">
                    Auto Join Meeting
                </label>
            </div>

            <div className="mb-4 flex items-center">
                <input
                    type="checkbox"
                    id="micOn"
                    checked={micOn}
                    onChange={(e) => setMicOn(e.target.checked)}
                    className="mr-2 leading-tight"
                />
                <label htmlFor="micOn" className="text-gray-700 text-sm font-bold">
                    Microphone On
                </label>
            </div>

            <div className="mb-4 flex items-center">
                <input
                    type="checkbox"
                    id="cameraOn"
                    checked={cameraOn}
                    onChange={(e) => setCameraOn(e.target.checked)}
                    className="mr-2 leading-tight"
                />
                <label htmlFor="cameraOn" className="text-gray-700 text-sm font-bold">
                    Camera On
                </label>
            </div>

            <div className="mb-6 flex items-center">
                <input
                    type="checkbox"
                    id="enableTranscription"
                    checked={enableTranscription}
                    onChange={(e) => setEnableTranscription(e.target.checked)}
                    className="mr-2 leading-tight"
                />
                <label htmlFor="enableTranscription" className="text-gray-700 text-sm font-bold">
                    Enable Real-time Transcription
                </label>
            </div>

            <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                disabled={loading}
            >
                {loading ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
        </form>
    );
};

export default MeetingForm;