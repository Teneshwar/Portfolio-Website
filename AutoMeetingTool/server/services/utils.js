const fs = require('fs');
const path = require('path');

function generateTranscriptionFilename(meetingId) {
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
    return path.join(__dirname, '..', 'transcriptions', `meeting_${meetingId}_${timestamp}.txt`);
}

function ensureTranscriptionDirectory() {
    const dir = path.join(__dirname, '..', 'transcriptions');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

module.exports = {
    generateTranscriptionFilename,
    ensureTranscriptionDirectory
};