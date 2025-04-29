const express = require('express');
const router = express.Router();
const Booking = require('../models/booking.model');

// POST /api/bookings - Create a new booking
router.post('/', async (req, res) => {
    try {
        const { service, date, time, name, email } = req.body;

        const newBooking = new Booking({
            service,
            date,
            time,
            name,
            email
        });

        const booking = await newBooking.save();
        res.status(201).json({ message: 'Booking successful!', booking });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/bookings/availability - Get all bookings for availability display
router.get('/availability', async (req, res) => {
    try {
        const availability = await Booking.find().sort({ bookingDate: -1 });
        res.json({ availability });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;