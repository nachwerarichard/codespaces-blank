const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    service: {
        type: String,
        required: true
    },
    // For Room Bookings: Check-in and Check-out Dates
    idate: { // Check-in Date
        type: Date,
        // Required only if service is 'room'. 'date' will be used otherwise.
        required: function() { return this.service === 'room'; }
    },
    odate: { // Check-out Date
        type: Date,
        // Required only if service is 'room'.
        required: function() { return this.service === 'room'; }
    },
    // For Appointment Bookings: Single Date
    date: {
        type: Date,
        // Required only if service is NOT 'room'.
        required: function() { return this.service !== 'room'; }
    },
    time: { // For appointments, or a default check-in time for rooms
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
    bookingDate: { // When the booking was created in the system
        type: Date,
        default: Date.now
    },
    assignedRoom: { // Reference to the Room document if it's a room booking
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        default: null
    },
    numberOfGuests: { // Useful for room bookings
        type: Number,
        default: 1
    },
    totalAmount: { // Total cost of the booking
        type: Number,
        default: 0
    },
    amountPaid: { // Amount already paid by the customer
        type: Number,
        default: 0
    },
    paymentStatus: { // Calculated based on totalAmount and amountPaid
        type: String,
        enum: ['pending', 'partially_paid', 'paid', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'mobile_money', 'bank_transfer', null],
        default: null // Null if no payment yet
    },
    status: { // Status of the booking itself (e.g., pending confirmation, confirmed, cancelled, completed)
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    }
});

module.exports = mongoose.model('Booking', BookingSchema);
