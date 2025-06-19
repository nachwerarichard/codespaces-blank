const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { sendBookingConfirmationEmail } = require('../utils/mailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user.model');

// Define the booking schema (if you haven't already)
const bookingSchema = new mongoose.Schema({
    name: String,
    email: String,
    service: String,
    date: Date,
    time: String,
    roomNumber: String, // newly added field

    // Add other fields as necessary
});
const roomSchema = new mongoose.Schema({
  number: String,
  type: String,
  capacity: Number,
  price: Number,
  status: String, // Available, Occupied, etc.
  features: [String],
});
const Room = mongoose.model('Room', roomSchema);

// Create the booking model
let Booking;
try {
    Booking = mongoose.model('Booking', bookingSchema);
} catch (error) {
    if (error.name === 'OverwriteModelError') {
        Booking = mongoose.model('Booking');
    } else {
        throw error;
    }
}

// Admin routes
router.get('/admin', async (req, res) => {
    try {
        const searchTerm = req.query.search;
        let query = {};

        if (searchTerm) {
            query = {
                $or: [
                    { name: { $regex: new RegExp(searchTerm, 'i') } },
                    { email: { $regex: new RegExp(searchTerm, 'i') } },
                    { service: { $regex: new RegExp(searchTerm, 'i') } },
                ],
            };
        }

        const bookings = await Booking.find(query);
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings: ' + error.message });
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
    const isRoomBooked = await Booking.findOne({
  roomNumber,
  date: new Date(date),
});

if (isRoomBooked) {
  return res.status(400).json({ error: 'Room already booked for this date.' });
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

// Public route to create a booking
router.post('/', async (req, res) => {
    try {
        const { service, date, time, name, email } = req.body;

        const newBooking = new Booking({
            service,
            date,
            time,
            name,
            email,
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

//  login route
router.post('/login', (req, res) => {
    //  your admin login logic here
    const { username, password } = req.body;

    // For example only:
    if (username === 'admin' && password === '123') {
        return res.json({ message: 'Login successful!' });
    } else {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
});
router.put('/assign-room/:id', async (req, res) => {
  const { roomNumber, date } = req.body;
  const bookingId = req.params.id;

  try {
    const existingBooking = await Booking.findOne({ roomNumber, date });

    if (existingBooking && existingBooking._id.toString() !== bookingId) {
      return res.status(400).json({ error: 'Room already booked for this date.' });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { roomNumber },
      { new: true }
    );

    res.json({ message: 'Room assigned successfully', updatedBooking });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;
