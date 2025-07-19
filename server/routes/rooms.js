const express = require('express');
const router = express.Router();
const Room = require('../models/room.model');
const auth = require('../middleware/auth'); // You'll create this later for admin/housekeeper roles

// Create a new room (Admin only)
router.post('/', auth(['admin']), async (req, res) => {
    try {
        const newRoom = new Room(req.body);
        const savedRoom = await newRoom.save();
        res.status(201).json(savedRoom);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all rooms (Admin/Housekeeper can see, public might see available)
router.get('/', async (req, res) => {
    try {
        const rooms = await Room.find();
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get a single room
router.get('/:id', async (req, res) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ message: 'Room not found' });
        res.json(room);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update room details (Admin only)
router.put('/:id', auth(['admin']), async (req, res) => {
    try {
        const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedRoom) return res.status(404).json({ message: 'Room not found' });
        res.json(updatedRoom);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update room status for housekeeping (Admin/Housekeeper)
router.patch('/:id/status', auth(['admin', 'housekeeper']), async (req, res) => {
    try {
        const { status } = req.body;
        if (!status || !['clean', 'dirty', 'under_maintenance'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status provided.' });
        }
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        room.status = status;
        await room.save();
        res.json({ message: `Room ${room.roomNumber} status updated to ${status}.`, room });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Delete a room (Admin only)
router.delete('/:id', auth(['admin']), async (req, res) => {
    try {
        const deletedRoom = await Room.findByIdAndDelete(req.params.id);
        if (!deletedRoom) return res.status(404).json({ message: 'Room not found' });
        res.json({ message: 'Room deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
