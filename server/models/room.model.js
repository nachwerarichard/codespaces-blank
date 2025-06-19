// models/room.model.js
const mongoose = require('mongoose');

// Check if the 'Room' model already exists to prevent recompilation
const Room = mongoose.models.Room || mongoose.model('Room', new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true, // Each room must have a unique number/identifier
        trim: true
    },
    roomType: {
        type: String,
        required: true,
        enum: ['Single', 'Double', 'Suite', 'Deluxe', 'Standard', 'Family', 'Other'], // Example types, customize as needed
        trim: true
    },
    capacity: { // Max number of guests this room can accommodate
        type: Number,
        required: true,
        min: 1
    },
    pricePerNight: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        required: true,
        enum: ['Available', 'Occupied', 'Cleaning', 'Maintenance', 'Out of Order'],
        default: 'Available'
    },
    features: { // Array of strings for amenities (e.g., ['Balcony', 'AC', 'Ocean View', 'Minibar', 'TV'])
        type: [String],
        default: []
    },
    currentBooking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking', // Refers to your Booking model
        default: null
    },
    notes: { // Any specific notes about the room
        type: String,
        trim: true
    },
    totalReservations: {
        type: Number,
        default: 0
    }
}, { timestamps: true })); // Adds createdAt and updatedAt timestamps


module.exports = Room; // Export the 'Room' model
