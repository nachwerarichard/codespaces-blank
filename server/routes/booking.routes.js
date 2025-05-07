const express = require('express');
const router = express.Router();
const Booking = require('../models/booking.model');

// have a booking model
const { sendBookingConfirmationEmail } = require('../utils/mailer');

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



// server/controllers/booking.controller.js


// ... other controller functions ...

exports.createBooking = async (req, res) => {
  try {
    const newBooking = new Booking(req.body);
    const savedBooking = await newBooking.save();

    // Email recipients (replace with your actual logic to fetch these)
    const managerEmail = 'nachwerarichard@gmail.com';
    const stakeholderEmails = ['nachwerarichy@gmail.com'];
    const clientEmail = savedBooking.email; // Assuming client email is in the booking data

    // Send confirmation email
    const emailResult = await sendBookingConfirmationEmail(
      savedBooking,
      managerEmail,
      stakeholderEmails,
      clientEmail
    );

    if (emailResult.success) {
      res.status(201).json({ message: 'Booking created successfully and confirmation email sent.', booking: savedBooking });
    } else {
      res.status(201).json({ message: 'Booking created successfully, but email failed to send.', booking: savedBooking, emailError: emailResult.error });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ... other controller functions ...

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