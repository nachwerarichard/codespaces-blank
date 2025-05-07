const express = require('express');
const router = express.Router();
const Booking = require('../models/booking.model');
const { sendBookingConfirmationEmail } = require('../utils/mailer'); // Import your mailer function

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

        // Send confirmation email
        const managerEmail = 'nachwerarichard@gmail.com';
        const stakeholderEmails = ['nachwerarichy@gmail.com'];
        const clientEmail = booking.email;

        const emailResult = await sendBookingConfirmationEmail(
            booking,
            managerEmail,
            stakeholderEmails,
            clientEmail
        );

        if (emailResult.success) {
            res.status(201).json({ message: 'Booking successful and confirmation email sent!', booking });
        } else {
            res.status(201).json({ message: 'Booking successful, but failed to send email.', booking, emailError: emailResult.error });
        }

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