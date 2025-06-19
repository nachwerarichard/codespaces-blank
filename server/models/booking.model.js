const mongoose = require('mongoose');

const roomBlockSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    roomNumber: { type: String, required: true }, // Denormalized
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String },
}, { timestamps: true });

const BookingSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    bookingDate: {
        type: Date,
        default: Date.now
    }
});
room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
roomNumber: { type: String, default: null }, // Denormalized for easy display
status: { type: String, enum: ['Pending', 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled'], default: 'Pending' },
checkInDate: { type: Date, required: true },
checkOutDate: { type: Date, required: true },
numberOfGuests: { type: Number, default: 1 } // New field

module.exports = mongoose.model('RoomBlock', roomBlockSchema);
module.exports = mongoose.model('Booking', BookingSchema);
