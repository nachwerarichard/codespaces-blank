const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { sendBookingConfirmationEmail } = require('../utils/mailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user.model');


const roomSchema = new mongoose.Schema({
    roomNumber: String,
    type: String,
    price: Number,
    status: { type: String, enum: ['available', 'occupied'], default: 'available' }
});

let Room;
try {
    Room = mongoose.model('Room', roomSchema);
} catch (error) {
    if (error.name === 'OverwriteModelError') {
        Room = mongoose.model('Room');
    } else {
        throw error;
    }
}

router.post('/rooms/seed', async (req, res) => {
    try {
        const rooms = [
            { roomNumber: '101', type: 'Standard', price: 50 },
            { roomNumber: '102', type: 'Standard', price: 50 },
            { roomNumber: '103', type: 'Standard', price: 50 },
            { roomNumber: '104', type: 'Standard', price: 50 },
            { roomNumber: '105', type: 'Standard', price: 50 },
            { roomNumber: '201', type: 'Deluxe', price: 80 },
            { roomNumber: '202', type: 'Deluxe', price: 80 },
            { roomNumber: '203', type: 'Deluxe', price: 80 },
            { roomNumber: '204', type: 'Deluxe', price: 80 },
            { roomNumber: '205', type: 'Deluxe', price: 80 },
        ];

        await Room.deleteMany(); // Clear existing rooms to avoid duplicates
        const createdRooms = await Room.insertMany(rooms);

        res.json({ message: 'Rooms seeded successfully', createdRooms });
    } catch (error) {
        console.error('Error seeding rooms:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all rooms
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await Room.find();
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available rooms
router.get('/rooms/available', async (req, res) => {
    try {
        const rooms = await Room.find({ status: 'available' });
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update room status (assign / free up)
router.patch('/rooms/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!['available', 'occupied'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const room = await Room.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!room) return res.status(404).json({ message: 'Room not found' });

        res.json({ message: 'Room status updated', room });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/assign-room', async (req, res) => {
    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ message: 'roomId is required' });

    try {
        const room = await Room.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found' });
        if (room.status === 'occupied') return res.status(400).json({ message: 'Room already occupied' });

        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        booking.roomId = room._id;
        await booking.save();

        room.status = 'occupied';
        await room.save();

        res.json({ message: 'Room assigned successfully', booking, room });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/assign-room', async (req, res) => {
  const { bookingId, roomId } = req.body;
  try {
    const room = await Room.findById(roomId);
    if (!room || room.status === 'occupied') {
      return res.status(400).json({ error: 'Room not available' });
    }

    // Update room status
    room.status = 'occupied';
    await room.save();

    // Optionally update booking with room info
    await Booking.findByIdAndUpdate(bookingId, { roomNumber: room.roomNumber });

    res.json({ message: 'Room assigned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Define the booking schema (if you haven't already)
const bookingSchema = new mongoose.Schema({
    name: String,
    email: String,
    service: String,
    date: Date,
    time: String,
    roomId: { type: String, default: null },   // New: assigned room
    totalAmount: { type: Number, default: 0 }, // New: total price
    amountPaid: { type: Number, default: 0 },  // New: paid so far
    balance: { type: Number, default: 0 },     // New: remaining balance// Add other fields as necessary
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

router.post('/:id/assign-room', async (req, res) => {
    const { roomId, totalAmount } = req.body;

    if (!roomId || !totalAmount) {
        return res.status(400).json({ message: 'roomId and totalAmount are required' });
    }

    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.roomId = roomId;
        booking.totalAmount = totalAmount;
        booking.balance = totalAmount - booking.amountPaid;

        await booking.save();

        res.json({ message: 'Room assigned successfully', booking });
    } catch (error) {
        console.error('Error assigning room:', error);
        res.status(500).json({ error: error.message });
    }
});


router.patch('/:id/payment', async (req, res) => {
    const { amountPaid } = req.body;

    if (amountPaid == null) {
        return res.status(400).json({ message: 'amountPaid is required' });
    }

    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        booking.amountPaid += amountPaid;
        booking.balance = booking.totalAmount - booking.amountPaid;

        await booking.save();

        res.json({ message: 'Payment updated successfully', booking });
    } catch (error) {
        console.error('Error updating payment:', error);
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



module.exports = router;
