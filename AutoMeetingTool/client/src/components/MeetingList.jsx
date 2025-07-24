import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MeetingList = ({ newMeeting }) => {
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchMeetings = async () => {
        setLoading(true);
        setError(null);
        try {
            // Mock token
            const token = 'someUserId123';
            const response = await axios.get('http://localhost:5000/api/meetings', {
                headers: {
                    'x-auth-token': token
                }
            });
            setMeetings(response.data);
        } catch (err) {
            console.error('Error fetching meetings:', err);
            setError('Failed to fetch meetings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMeetings();
    }, []);

    useEffect(() => {
        if (newMeeting) {
            setMeetings((prevMeetings) => [newMeeting, ...prevMeetings]);
        }
    }, [newMeeting]);

    const handleDownloadTranscription = async (meetingId) => {
        try {
            // Mock token
            const token = 'someUserId123';
            const response = await axios.get(`http://localhost:5000/api/meetings/${meetingId}/transcription`, {
                responseType: 'blob', // Important for file download
                headers: {
                    'x-auth-token': token
                }
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `transcription_${meetingId}.txt`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Error downloading transcription:', err);
            alert('Failed to download transcription.');
        }
    };

    if (loading) return <p className="text-center text-gray-600">Loading meetings...</p>;
    if (error) return <p className="text-center text-red-500">{error}</p>;

    return (
        <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Scheduled Meetings</h2>
            {meetings.length === 0 ? (
                <p className="text-gray-600">No meetings scheduled yet.</p>
            ) : (
                <ul className="divide-y divide-gray-200">
                    {meetings.map((meeting) => (
                        <li key={meeting._id} className="py-4 flex justify-between items-center">
                            <div>
                                <p className="text-lg font-semibold text-gray-900">{meeting.platform} Meeting</p>
                                <p className="text-sm text-gray-600">Link: <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{meeting.meetingLink}</a></p>
                                {meeting.meetingId && <p className="text-sm text-gray-600">ID: {meeting.meetingId}</p>}
                                <p className="text-sm text-gray-600">Time: {new Date(meeting.scheduledTime).toLocaleString()}</p>
                                <p className="text-sm text-gray-600">Status: <span className={`font-medium ${meeting.status === 'scheduled' ? 'text-blue-500' : meeting.status === 'in-progress' ? 'text-yellow-500' : meeting.status === 'completed' ? 'text-green-500' : 'text-red-500'}`}>{meeting.status}</span></p>
                                <p className="text-sm text-gray-600">Auto Join: {meeting.autoJoin ? 'Yes' : 'No'}</p>
                                <p className="text-sm text-gray-600">Mic On: {meeting.micOn ? 'Yes' : 'No'}</p>
                                <p className="text-sm text-gray-600">Camera On: {meeting.cameraOn ? 'Yes' : 'No'}</p>
                                <p className="text-sm text-gray-600">Transcription: {meeting.enableTranscription ? 'Enabled' : 'Disabled'}</p>
                            </div>
                            {meeting.transcriptionPath && meeting.status === 'completed' && (
                                <button
                                    onClick={() => handleDownloadTranscription(meeting._id)}
                                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm focus:outline-none focus:shadow-outline"
                                >
                                    Download Transcription
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MeetingList;