const express = require('express');
const connectDB = require('./config/db');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // You might need this for JWT_SECRET in process.env
require('dotenv').config(); // If you use a .env file for configuration

// Import your routes and cron job
const bookingRoutes = require('./routes/booking.routes');
const roomRoutes = require('./routes/rooms');
const setupHousekeepingCron = require('./cronJob'); // Path to your new cron job file

const app = express();

// CORS configuration - replace with your actual Netlify URL
const corsOptions = {
    origin: 'https://rainbow-fox-3bad88.netlify.app', // Your frontend URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-auth-token'] // Allow x-auth-token header
};
app.use(cors(corsOptions));

// Middleware to parse JSON request bodies
app.use(express.json()); // This replaces bodyParser.json() in modern Express

// Connect to MongoDB
// ConnectDB function should now return a Promise or be async itself
connectDB().then(() => {
    console.log('MongoDB Connected');
    // Start cron jobs after successful DB connection
    setupHousekeepingCron();
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process with failure
});

// Use Routes
app.use('/api/bookings', bookingRoutes); // This handles both public and admin booking operations (admin part uses auth middleware)
app.use('/api/rooms', roomRoutes);     // Routes for room management

// Remove any redundant admin route lines if they are now covered by bookingRoutes (e.g., app.use('/api/admin', adminRoutes);)
// If your existing adminRoutes contains only login, it's fine. If it has other booking-related logic,
// consolidate it into bookingRoutes as shown above.

const PORT = process.env.PORT || 5000; // Use port from environment variable or default to 5000

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
