const speech = require('@google-cloud/speech').v1p1beta1; // Using v1p1beta1 for diarization
const fs = require('fs');

const client = new speech.SpeechClient();

async function startRealtimeTranscription(audioStream, outputPath) {
    try {
        const request = {
            config: {
                encoding: 'LINEAR16', // Or FLAC, MULAW, etc., depending on your audio source
                sampleRateHertz: 16000, // Important: Match your audio source sample rate
                languageCode: 'en-US',
                enableAutomaticPunctuation: true,
                diarizationConfig: {
                    enableSpeakerDiarization: true,
                    minSpeakerCount: 2,
                    maxSpeakerCount: 6,
                },
            },
            interimResults: true, // Get interim results
        };

        const recognizeStream = client
            .streamingRecognize(request)
            .on('error', console.error)
            .on('data', data => {
                const result = data.results[0];
                if (result && result.alternatives[0]) {
                    const transcription = result.alternatives[0].transcript;
                    const words = result.alternatives[0].words; // For speaker tags

                    let currentSpeaker = 'Unknown';
                    if (words && words.length > 0) {
                        // Speaker diarization information is available in words array
                        // The `speakerTag` field exists when diarization is enabled
                        currentSpeaker = words[0].speakerTag ? `Speaker ${words[0].speakerTag}` : 'Unknown';
                    }
                    const line = `${currentSpeaker}: ${transcription}\n`;
                    fs.appendFileSync(outputPath, line);
                    // You would also send this in real-time to the frontend via WebSockets
                    console.log(`Transcription: ${line.trim()}`);
                }
            });

        // Pipe your audio stream to the recognizeStream
        // THIS IS THE CRITICAL PART: 'audioStream' needs to be a readable stream of the meeting audio.
        audioStream.pipe(recognizeStream);

        console.log(`Real-time transcription started. Output will be saved to ${outputPath}`);
        return recognizeStream; // Return the stream to manage it (e.g., end it later)
    } catch (error) {
        console.error('Error starting real-time transcription:', error);
        throw error;
    }
}

// Example of how you might stop it (called when meeting ends)
function stopRealtimeTranscription(recognizeStream) {
    if (recognizeStream) {
        recognizeStream.end();
        console.log('Real-time transcription stopped.');
    }
}

module.exports = { startRealtimeTranscription, stopRealtimeTranscription };