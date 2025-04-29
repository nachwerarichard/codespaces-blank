const express = require('express');
const connectDB = require('./config/db');
const bodyParser = require('body-parser');
const path = require('path');

const bookingRoutes = require('./routes/booking.routes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Use Routes
app.use('/api/bookings', bookingRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));