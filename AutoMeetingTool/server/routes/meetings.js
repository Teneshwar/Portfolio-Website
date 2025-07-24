const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');

// Middleware to simulate authentication for demonstration
const mockAuth = (req, res, next) => {
    // In a real application, you'd verify JWT token here
    req.user = { id: '68776203de4edfdd257b4722' }; // Simulate a logged-in user
    next();
};

router.post('/', mockAuth, meetingController.scheduleMeeting);
router.get('/', mockAuth, meetingController.getMeetings);
router.get('/:id/transcription', mockAuth, meetingController.getTranscription);

module.exports = router;