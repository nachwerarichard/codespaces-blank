// routes/rooms.js
const express = require('express');
const router = express.Router();
const Room = require('../models/room.model'); // Adjust path if your models folder is different

// Middleware for authentication (placeholder for now, you'll implement JWT later)
// const authenticateAdmin = (req, res, next) => {
//     // In a real app, verify JWT here
//     // For now, assume authenticated if user reaches here after login
//     next();
// };

// GET all rooms
router.get('/', async (req, res) => {
    try {
        const rooms = await Room.find({}); // Find all rooms
        res.json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Failed to fetch rooms', details: error.message });
    }
});

// GET a single room by ID
router.get('/:id', async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(room);
    } catch (error) {
        console.error('Error fetching room by ID:', error);
        res.status(500).json({ error: 'Failed to fetch room', details: error.message });
    }
});

// CREATE a new room
router.post('/', async (req, res) => {
    try {
        const newRoom = new Room(req.body);
        const savedRoom = await newRoom.save();
        res.status(201).json(savedRoom); // 201 Created
    } catch (error) {
        console.error('Error creating room:', error);
        // Handle unique room number error
        if (error.code === 11000 && error.keyPattern && error.keyPattern.roomNumber) {
            return res.status(400).json({ message: 'Room number already exists. Please choose a different one.' });
        }
        res.status(400).json({ error: 'Failed to create room', details: error.message }); // 400 Bad Request for validation errors
    }
});

// UPDATE a room by ID
router.put('/:id', async (req, res) => {
    try {
        const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, {
            new: true, // Return the updated document
            runValidators: true // Run schema validators on update
        });
        if (!updatedRoom) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(updatedRoom);
    } catch (error) {
        console.error('Error updating room:', error);
        if (error.code === 11000 && error.keyPattern && error.keyPattern.roomNumber) {
            return res.status(400).json({ message: 'Room number already exists. Please choose a different one.' });
        }
        res.status(400).json({ error: 'Failed to update room', details: error.message });
    }
});

// DELETE a room by ID
router.delete('/:id', async (req, res) => {
    try {
        // Optional: Add logic here to prevent deleting occupied rooms or rooms with associated future bookings
        const roomToDelete = await Room.findById(req.params.id);
        if (!roomToDelete) {
            return res.status(404).json({ message: 'Room not found' });
        }
        // If you've linked currentBooking, you might check if it's not null before deleting
        // if (roomToDelete.currentBooking) {
        //     return res.status(400).json({ message: 'Cannot delete an occupied room. Please check out guests first.' });
        // }

        const deletedRoom = await Room.findByIdAndDelete(req.params.id);
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ error: 'Failed to delete room', details: error.message });
    }
});

module.exports = router;
