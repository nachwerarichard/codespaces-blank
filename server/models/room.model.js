const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        unique: true
    },
    roomType: { // e.g., 'Single', 'Double', 'Suite'
        type: String,
        required: true
    },
    pricePerNight: {
        type: Number,
        required: true
    },
    capacity: {
        type: Number,
        required: true
    },
    // New fields for housekeeping
    status: { // 'clean', 'dirty', 'under_maintenance'
        type: String,
        enum: ['clean', 'dirty', 'under_maintenance'],
        default: 'clean'
    },
    currentBooking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null // Will store the ID of the current booking if occupied
    }
});

module.exports = mongoose.model('Room', RoomSchema);
