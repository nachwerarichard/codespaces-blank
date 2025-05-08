const express = require('express');
const connectDB = require('./config/db');
const bodyParser = require('body-parser');
const path = require('path');
const bookingRoutes = require('./routes/booking.routes');
const app = express();
const cors = require('cors');
// ... other imports ...
const corsOptions = {
    origin: 'https://glowing-licorice-42e6fa.netlify.app', // Replace with your actual Netlify URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
};
app.use(cors(corsOptions));
// ... your routes ...
// Connect to MongoDB
connectDB();
// Middleware
app.use(bodyParser.json());
// Remove this line as the public folder no longer exists:
// app.use(express.static(path.join(__dirname, '../public')));
// Use Routes
app.use('/api/bookings', bookingRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


app.use(express.json());
app.use('/api/admin', adminRoutes);

// ... other imports and CORS setup ...
// Connect to MongoDB
// Middleware
