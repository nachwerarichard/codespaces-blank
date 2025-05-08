const express = require('express');
const router = express.Router();
const Booking = require('../models/booking.model');
const { sendBookingConfirmationEmail } = require('../utils/mailer'); // Import your mailer function
const jwt = require('jsonwebtoken'); // You'll need this for creating tokens
const bcrypt = require('bcrypt');  //for password hashing
const User = require('../models/user.model'); // Import your User model


  // Secret key for JWT (store this in an environment variable)
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


// server/routes/booking.routes.js


// Public route
router.post('/', async (req, res) => { /* ... your create booking logic ... */ });
router.get('/availability', async (req, res) => { /* ... your get availability logic ... */ });

// Admin routes
router.get('/admin', async (req, res) => {
    try {
        const bookings = await Booking.find();
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const updatedBooking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedBooking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        res.json(updatedBooking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/manual', async (req, res) => {
    try {
        const newBooking = new Booking(req.body);
        const savedBooking = await newBooking.save();
        res.status(201).json(savedBooking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
        if (!deletedBooking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


 // Secret key for JWT (store this in an environment variable)
 const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';  // Use a default only if not in .env

 // ... your other routes ...
 router.post('/login', (req, res) => {
    // your admin login logic here
    const { name, password } = req.body;
  
    // For example only:
    if (name === 'admin' && password === '123') {
      return res.json({ message: 'Login successful!' });
    } else {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  });
  
  

 // ... your other routes ...
module.exports = router;
