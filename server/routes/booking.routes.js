const express = require('express');
const router = express.Router();
const Booking = require('../models/booking.model');
const { sendBookingConfirmationEmail } = require('../utils/mailer'); // Import your mailer function
const jwt = require('jsonwebtoken'); // You'll need this for creating tokens
const bcrypt = require('bcrypt');  //for password hashing

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

 // Login route
 router.post('/login', async (req, res) => {
     const { username, password } = req.body;

     try {
         // 1. Find the user by username (you'll need a User model)
         //   Important:  You should have a separate User model, NOT a Booking model, to store user credentials
         const user = await User.findOne({ username });  //  Change User

         if (!user) {
             return res.status(401).json({ message: 'Invalid credentials' });
         }
         // 2. Compare the provided password with the hashed password in the database
         const passwordMatch = await bcrypt.compare(password, user.password); //  Change user.password

         if (!passwordMatch) {
             return res.status(401).json({ message: 'Invalid credentials' });
         }

         // 3. If the username and password are correct, create a JWT
         const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { // Change user
             expiresIn: '24h', // Token expires in 24 hours
         });

         // 4. Send the token back to the client
         res.json({ token });
     } catch (error) {
         res.status(500).json({ message: 'Error during login', error: error.message });
     }
 });

 // ... your other routes ...
module.exports = router;
