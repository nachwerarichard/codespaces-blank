const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true
    },
    roomType: { // e.g., 'Single', 'Double', 'Suite', 'Family'
        type: String,
        required: true
    },
    pricePerNight: {
        type: Number,
        required: true
    },
    capacity: { // Max number of guests
        type: Number,
        required: true
    },
    status: { // 'clean', 'dirty', 'under_maintenance'
        type: String,
        enum: ['clean', 'dirty', 'under_maintenance'],
        default: 'clean'
    },
    currentBooking: { // Reference to the booking that currently occupies this room
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null
    }
});

module.exports = mongoose.model('Room', RoomSchema);
