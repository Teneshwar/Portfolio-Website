const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    platform: {
        type: String,
        required: true,
        enum: ['Google Meet', 'Microsoft Teams', 'Zoom'],
    },
    meetingLink: {
        type: String,
        required: true,
    },
    meetingId: {
        type: String,
    },
    meetingPassword: {
        type: String,
    },
    scheduledTime: {
        type: Date,
        required: true,
    },
    autoJoin: {
        type: Boolean,
        default: true,
    },
    micOn: {
        type: Boolean,
        default: false,
    },
    cameraOn: {
        type: Boolean,
        default: false,
    },
    enableTranscription: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'failed'],
        default: 'scheduled',
    },
    transcriptionPath: {
        type: String, // Path to the generated TXT file
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Meeting', MeetingSchema);