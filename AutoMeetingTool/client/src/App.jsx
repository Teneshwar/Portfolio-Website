import React, { useState } from 'react';
import MeetingForm from './components/MeetingForm';
import MeetingList from './components/MeetingList';

function App() {
    const [newlyScheduledMeeting, setNewlyScheduledMeeting] = useState(null);

    const handleMeetingScheduled = (meeting) => {
        setNewlyScheduledMeeting(meeting);
    };

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-10">
                Meeting Automator
            </h1>
            <div className="max-w-4xl mx-auto">
                <MeetingForm onMeetingScheduled={handleMeetingScheduled} />
                <MeetingList newMeeting={newlyScheduledMeeting} />
            </div>
        </div>
    );
}

export default App;
