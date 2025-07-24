require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const meetingRoutes = require('./routes/meetings');
const { ensureTranscriptionDirectory } = require('./services/utils');
const cors = require('cors'); // Import cors

const app = express();

// Connect Database
connectDB();

// Ensure transcription directory exists
ensureTranscriptionDirectory();

// Middleware
app.use(express.json({ extended: false }));
app.use(cors()); // Enable CORS

// Define Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));