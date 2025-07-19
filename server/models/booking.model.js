const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true
    },
    // Keep idate and odate for check-in/check-out for room bookings
    idate: { // Check-in Date
        type: Date,
        required: function() { return this.service === 'room'; } // Required only for room bookings
    },
    odate: { // Check-out Date
        type: Date,
        required: function() { return this.service === 'room'; } // Required only for room bookings
    },
    date: { // For appointment date (if service is not 'room')
        type: Date,
        required: function() { return this.service !== 'room'; } // Required only for non-room bookings
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
    },
    assignedRoom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        default: null // The room assigned to this booking
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'partially_paid', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'mobile_money', 'bank_transfer', null],
        default: null // Set when payment is made
    },
    // Added for room specific details if needed directly in booking
    numberOfGuests: {
        type: Number,
        default: 1
    },
    status: { // Status of the booking itself (e.g., 'confirmed', 'cancelled', 'completed')
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    }
});

module.exports = mongoose.model('Booking', BookingSchema);
