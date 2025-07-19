const express = require('express');
const router = express.Router();
const Booking = require('../models/booking.model'); // Import your Booking model (correct one!)
const Room = require('../models/room.model'); // Import the new Room model
const { sendBookingConfirmationEmail } = require('../utils/mailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/user.model'); // For user authentication (admin/housekeeper)
const auth = require('../middleware/auth'); // Middleware for role-based authorization

// --- IMPORTANT: REMOVE THIS DUPLICATE SCHEMA DEFINITION. Rely on booking.model.js ---
/*
const bookingSchema = new mongoose.Schema({
    name: String,
    email: String,
    service: String,
    idate: Date,
    odate: Date, // This should be 'odate' not 'idate' again
    time: String,
    total: String,
    paid: String,
    balance: String
});
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
*/
// --- END OF DUPLICATE SCHEMA REMOVAL ---


// Helper function to calculate total amount for a room booking
async function calculateRoomBookingAmount(roomId, checkInDate, checkOutDate) {
    const room = await Room.findById(roomId);
    if (!room) {
        throw new Error('Room not found for calculation.');
    }

    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const timeDiff = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); // Number of nights

    return room.pricePerNight * diffDays;
}


// Admin: Get all bookings (with search and potentially populated room info)
router.get('/admin', auth(['admin']), async (req, res) => { // Added auth middleware
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

        // Populate assignedRoom details for admin view
        const bookings = await Booking.find(query).populate('assignedRoom');
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings: ' + error.message });
    }
});

// Admin: Get a single booking
router.get('/:id', auth(['admin']), async (req, res) => { // Added auth middleware
    try {
        const booking = await Booking.findById(req.params.id).populate('assignedRoom'); // Populate room
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Update a booking (including payment status)
router.put('/:id', auth(['admin']), async (req, res) => { // Added auth middleware
    try {
        const {
            service, idate, odate, date, time, name, email,
            assignedRoom, totalAmount, amountPaid, paymentMethod, status // New fields
        } = req.body;

        const updatedFields = {
            service, time, name, email, assignedRoom, totalAmount, amountPaid, paymentMethod, status
        };

        // Handle date fields based on service type
        if (service === 'room') {
            updatedFields.idate = idate;
            updatedFields.odate = odate;
            updatedFields.date = undefined; // Ensure appointment date is not set for room bookings
        } else {
            updatedFields.date = date;
            updatedFields.idate = undefined; // Ensure room dates are not set for appointments
            updatedFields.odate = undefined;
        }

        // Calculate paymentStatus based on amountPaid and totalAmount
        if (totalAmount !== undefined && amountPaid !== undefined) {
            if (amountPaid >= totalAmount) {
                updatedFields.paymentStatus = 'paid';
            } else if (amountPaid > 0 && amountPaid < totalAmount) {
                updatedFields.paymentStatus = 'partially_paid';
            } else {
                updatedFields.paymentStatus = 'pending';
            }
        }

        const updatedBooking = await Booking.findByIdAndUpdate(req.params.id, updatedFields, { new: true });

        if (!updatedBooking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        res.json(updatedBooking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Manually create a booking (can assign room)
router.post('/manual', auth(['admin']), async (req, res) => { // Added auth middleware
    try {
        const {
            service, idate, odate, date, time, name, email,
            assignedRoom, totalAmount, amountPaid, paymentMethod, numberOfGuests
        } = req.body;

        let bookingTotalAmount = totalAmount;
        let selectedRoom = null;

        if (service === 'room' && assignedRoom) {
            // Check if room is available for the given dates
            const existingBookingsForRoom = await Booking.find({
                assignedRoom: assignedRoom,
                status: { $in: ['pending', 'confirmed'] }, // Consider active bookings
                $or: [
                    { idate: { $lt: new Date(odate) }, odate: { $gt: new Date(idate) } }, // Overlapping dates
                ]
            });

            if (existingBookingsForRoom.length > 0) {
                return res.status(400).json({ message: 'Selected room is not available for the specified dates.' });
            }

            // Calculate total amount based on room price and duration if not provided
            if (!totalAmount) {
                bookingTotalAmount = await calculateRoomBookingAmount(assignedRoom, idate, odate);
            }
            selectedRoom = await Room.findById(assignedRoom);
            if (!selectedRoom) {
                return res.status(400).json({ message: 'Assigned room not found.' });
            }
        }

        // Determine payment status
        let paymentStatus = 'pending';
        if (amountPaid !== undefined && bookingTotalAmount !== undefined) {
            if (amountPaid >= bookingTotalAmount) {
                paymentStatus = 'paid';
            } else if (amountPaid > 0 && amountPaid < bookingTotalAmount) {
                paymentStatus = 'partially_paid';
            }
        }

        const newBooking = new Booking({
            service,
            idate: service === 'room' ? idate : undefined,
            odate: service === 'room' ? odate : undefined,
            date: service !== 'room' ? date : undefined,
            time,
            name,
            email,
            assignedRoom: selectedRoom ? selectedRoom._id : null,
            totalAmount: bookingTotalAmount,
            amountPaid: amountPaid || 0,
            paymentStatus,
            paymentMethod: paymentMethod || null,
            numberOfGuests
        });

        const savedBooking = await newBooking.save();

        // If a room was assigned and the booking is confirmed, update the room's currentBooking field
        if (savedBooking.assignedRoom && savedBooking.status === 'confirmed') {
            await Room.findByIdAndUpdate(savedBooking.assignedRoom, { currentBooking: savedBooking._id });
        }

        res.status(201).json(savedBooking);
    } catch (error) {
        console.error('Error creating manual booking:', error);
        res.status(500).json({ error: 'Failed to create booking: ' + error.message });
    }
});

// Admin: Delete a booking
router.delete('/:id', auth(['admin']), async (req, res) => { // Added auth middleware
    try {
        const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
        if (!deletedBooking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // If the deleted booking had an assigned room, clear the room's currentBooking
        if (deletedBooking.assignedRoom) {
            await Room.findByIdAndUpdate(deletedBooking.assignedRoom, { currentBooking: null });
        }

        res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Public route to create a booking (Simplified, no room assignment here directly)
// This route needs to search for available rooms, if 'room' service is selected
router.post('/', async (req, res) => {
    try {
        const { service, date, idate, odate, time, name, email, numberOfGuests } = req.body;

        if (service === 'room') {
            // Find an available room based on dates and maybe capacity/type
            const availableRooms = await Room.find({
                status: 'clean', // Only clean rooms
                currentBooking: null, // Not currently occupied
                // Add more complex availability logic here, e.g., checking if dates overlap with future bookings
                // For simplicity, we'll just pick the first available 'clean' room for now.
                // In a real app, you'd iterate and check if this room is booked for the given dates.
            });

            if (availableRooms.length === 0) {
                return res.status(400).json({ message: 'No rooms available for the selected dates or type.' });
            }

            // Simple assignment: pick the first available room
            const assignedRoom = availableRooms[0];

            // Check for actual date conflicts with existing bookings for this specific room
            const conflict = await Booking.findOne({
                assignedRoom: assignedRoom._id,
                status: { $in: ['pending', 'confirmed'] },
                $or: [
                    { idate: { $lt: new Date(odate) }, odate: { $gt: new Date(idate) } }
                ]
            });

            if (conflict) {
                // This scenario means our initial 'availableRooms' check was too simple,
                // or another booking just happened. Re-run availability or inform user.
                return res.status(400).json({ message: 'The chosen room became unavailable. Please try again or select different dates.' });
            }

            const totalAmount = await calculateRoomBookingAmount(assignedRoom._id, idate, odate);

            const newBooking = new Booking({
                service,
                idate,
                odate,
                time: "Check-in time", // Or a specific check-in time for rooms
                name,
                email,
                assignedRoom: assignedRoom._id,
                totalAmount,
                amountPaid: 0, // Customer usually pays later
                paymentStatus: 'pending',
                numberOfGuests,
                status: 'pending' // Initial status for public bookings
            });

            const booking = await newBooking.save();

            // IMPORTANT: Mark the room as booked only AFTER successful payment or confirmation by admin
            // For now, let's just assign the room, but its `currentBooking` should be updated
            // when the booking transitions to 'confirmed' status.
            // await Room.findByIdAndUpdate(assignedRoom._id, { currentBooking: booking._id }); // Uncomment if you want to block immediately

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
                res.status(201).json({ message: 'Room booking successful! Confirmation email sent. Your room is ' + assignedRoom.roomNumber, booking });
            } else {
                res.status(201).json({ message: 'Room booking successful, but failed to send email. Your room is ' + assignedRoom.roomNumber, booking, emailError: emailResult.error });
            }

        } else if (service === 'appointment') {
            const newBooking = new Booking({
                service,
                date,
                time,
                name,
                email,
                assignedRoom: null, // No room for appointments
                totalAmount: 0, // Or a fixed price for appointment
                amountPaid: 0,
                paymentStatus: 'pending',
                status: 'pending'
            });

            const booking = await newBooking.save();

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
                res.status(201).json({ message: 'Appointment booking successful and confirmation email sent!', booking });
            } else {
                res.status(201).json({ message: 'Appointment booking successful, but failed to send email.', booking, emailError: emailResult.error });
            }
        } else {
            return res.status(400).json({ message: 'Invalid service type.' });
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Admin Login Route (assuming this is part of adminRoutes)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // In a real app, you'd fetch user from DB and compare hashed password
    // This is using your current simple login logic:
    if (username === 'admin' && password === '123') {
        // In a real app, create a JWT token with user ID and role
        const token = jwt.sign({ userId: 'adminId', role: 'admin' }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
        return res.json({ message: 'Login successful!', token, role: 'admin' });
    } else if (username === 'housekeeper' && password === 'housekeep123') {
        const token = jwt.sign({ userId: 'housekeeperId', role: 'housekeeper' }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
        return res.json({ message: 'Login successful!', token, role: 'housekeeper' });
    }
    else {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
});


module.exports = router;
