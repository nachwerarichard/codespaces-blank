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
    roomNumber: String, // or roomId if using a separate Room model
    checkInDate: Date,
    checkOutDate: Date,
    time: String,
    
    // Add other fields as necessary
});

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
        const overlappingBooking = await Booking.findOne({
            roomNumber,
            $or: [
                {
                    checkInDate: { $lt: new Date(checkOutDate) },
                    checkOutDate: { $gt: new Date(checkInDate) },
                },
            ],
        });

        if (overlappingBooking) {
            return res.status(400).json({ message: 'Room is already booked for the selected dates.' });
        }
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
router.put('/assign-room/:id', async (req, res) => {
  try {
    const { roomNumber } = req.body;

    // Check for overlapping bookings for that room
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const conflict = await Booking.findOne({
      roomNumber,
      _id: { $ne: booking._id },
      $or: [
        {
          date: {
            $gte: new Date(booking.date),
            $lt: new Date(new Date(booking.date).getTime() + 24 * 60 * 60 * 1000),
          },
        },
      ],
    });

    if (conflict) {
      return res.status(400).json({ message: 'Room already booked for that date' });
    }

    booking.roomNumber = roomNumber;
    await booking.save();

    res.json({ message: 'Room assigned successfully', booking });
  } catch (error) {
    res.status(500).json({ message: 'Error assigning room', error: error.message });
  }
});

router.get('/room-calendar', async (req, res) => {
    try {
        const bookings = await Booking.find({});
        const calendarView = {};

        bookings.forEach((booking) => {
            const room = booking.roomNumber;
            if (!calendarView[room]) calendarView[room] = [];

            calendarView[room].push({
                name: booking.name,
                email: booking.email,
                checkInDate: booking.checkInDate,
                checkOutDate: booking.checkOutDate,
            });
        });

        res.json(calendarView);
    } catch (error) {
        res.status(500).json({ message: 'Error generating room calendar', error: error.message });
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



module.exports = router;
