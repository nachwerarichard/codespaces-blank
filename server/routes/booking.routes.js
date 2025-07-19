const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/booking.model'); // Ensure this is the correct path to the updated model
const Room = require('../models/room.model');     // Import the new Room model
const { sendBookingConfirmationEmail } = require('../utils/mailer');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth'); // Import the auth middleware

// IMPORTANT: REMOVE any duplicate schema definition here. Rely solely on models/booking.model.js
// If you have a section like:
/*
const bookingSchema = new mongoose.Schema({ ... });
let Booking;
try {
  Booking = mongoose.model('Booking', bookingSchema);
} catch (error) { ... }
*/
// DELETE THAT SECTION. It conflicts with your central booking.model.js.

// Secret for JWT. In a real app, use process.env.JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey_change_me';


// Helper function to calculate total amount for a room booking
// This function needs to fetch the room price from the Room model
async function calculateRoomBookingAmount(roomId, checkInDate, checkOutDate) {
    const room = await Room.findById(roomId);
    if (!room) {
        throw new Error('Room not found for calculation.');
    }

    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);

    // Ensure dates are valid and check-out is after check-in
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
        throw new Error('Invalid check-in or check-out dates.');
    }

    const timeDiff = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); // Number of nights

    return room.pricePerNight * diffDays;
}


// ADMIN Routes (require 'admin' role)
// ------------------------------------

// Get all bookings (Admin only, with optional search)
router.get('/admin', auth(['admin']), async (req, res) => {
    try {
        const searchTerm = req.query.search;
        let query = {};

        if (searchTerm) {
            query = {
                $or: [
                    { name: { $regex: new RegExp(searchTerm, 'i') } },
                    { email: { $regex: new RegExp(searchTerm, 'i') } },
                    { service: { $regex: new RegExp(searchTerm, 'i') } },
                    // You might want to search by room number as well, requires more complex populate/lookup
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

// Get a single booking by ID (Admin only)
router.get('/:id', auth(['admin']), async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('assignedRoom');
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a booking (Admin only)
router.put('/:id', auth(['admin']), async (req, res) => {
    try {
        const {
            service, idate, odate, date, time, name, email,
            assignedRoom, totalAmount, amountPaid, paymentMethod, status, numberOfGuests
        } = req.body;

        const updatedFields = {
            service, time, name, email, assignedRoom, totalAmount, amountPaid, paymentMethod, status, numberOfGuests
        };

        // Handle date fields based on service type
        if (service === 'room') {
            updatedFields.idate = new Date(idate);
            updatedFields.odate = new Date(odate);
            updatedFields.date = undefined; // Ensure appointment date is not set for room bookings
            // Validate room dates
            if (isNaN(updatedFields.idate.getTime()) || isNaN(updatedFields.odate.getTime()) || updatedFields.idate >= updatedFields.odate) {
                 return res.status(400).json({ message: 'Invalid check-in or check-out dates for room booking.' });
            }
        } else {
            updatedFields.date = new Date(date);
            updatedFields.idate = undefined; // Ensure room dates are not set for appointments
            updatedFields.odate = undefined;
             if (isNaN(updatedFields.date.getTime())) {
                 return res.status(400).json({ message: 'Invalid date for appointment booking.' });
            }
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
        } else {
            // If totalAmount or amountPaid are not provided, ensure paymentStatus is not 'paid' or 'partially_paid'
            if (updatedFields.paymentStatus === 'paid' || updatedFields.paymentStatus === 'partially_paid') {
                updatedFields.paymentStatus = 'pending'; // Reset if amounts not provided
            }
        }

        const oldBooking = await Booking.findById(req.params.id);
        if (!oldBooking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const updatedBooking = await Booking.findByIdAndUpdate(req.params.id, updatedFields, { new: true });

        if (!updatedBooking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Logic for blocking/unblocking rooms based on booking status and assigned room
        if (oldBooking.assignedRoom && String(oldBooking.assignedRoom) !== String(updatedBooking.assignedRoom)) {
            // Room assignment changed or removed, unblock old room
            await Room.findByIdAndUpdate(oldBooking.assignedRoom, { currentBooking: null });
        }

        if (updatedBooking.service === 'room' && updatedBooking.assignedRoom) {
            // Check for availability only if a room is assigned and status is confirmed/pending
            if (updatedBooking.status === 'confirmed' || updatedBooking.status === 'pending') {
                const overlappingBookings = await Booking.findOne({
                    _id: { $ne: updatedBooking._id }, // Exclude current booking itself
                    assignedRoom: updatedBooking.assignedRoom,
                    status: { $in: ['pending', 'confirmed'] },
                    $or: [
                        { idate: { $lt: updatedBooking.odate }, odate: { $gt: updatedBooking.idate } }
                    ]
                });

                if (overlappingBookings) {
                    // Revert the update if it causes an overlap
                    await Booking.findByIdAndUpdate(req.params.id, oldBooking); // Revert to old state
                    return res.status(400).json({ message: 'Assigned room is not available for the updated dates.' });
                }

                // Block the room if the booking is confirmed or pending
                await Room.findByIdAndUpdate(updatedBooking.assignedRoom, { currentBooking: updatedBooking._id });
            } else {
                // If booking status is cancelled/completed, unblock the room
                await Room.findByIdAndUpdate(updatedBooking.assignedRoom, { currentBooking: null });
            }
        }


        res.json(updatedBooking);
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ error: 'Failed to update booking: ' + error.message });
    }
});

// Manually create a booking (Admin only, can assign room and set payment details)
router.post('/manual', auth(['admin']), async (req, res) => {
    try {
        const {
            service, idate, odate, date, time, name, email,
            assignedRoom, totalAmount, amountPaid, paymentMethod, numberOfGuests, status
        } = req.body;

        let bookingTotalAmount = totalAmount;
        let selectedRoom = null;
        let finalBookingStatus = status || 'pending'; // Default to pending if not provided

        if (service === 'room') {
            if (!idate || !odate || new Date(idate) >= new Date(odate)) {
                return res.status(400).json({ message: 'Check-in and check-out dates are required and valid for room booking.' });
            }
            if (assignedRoom) {
                // Check if the assigned room is available for the given dates
                const overlappingBooking = await Booking.findOne({
                    assignedRoom: assignedRoom,
                    status: { $in: ['pending', 'confirmed'] }, // Consider actively booked rooms
                    $or: [
                        { idate: { $lt: new Date(odate) }, odate: { $gt: new Date(idate) } }
                    ]
                });

                if (overlappingBooking) {
                    return res.status(400).json({ message: 'Selected room is not available for the specified dates.' });
                }

                selectedRoom = await Room.findById(assignedRoom);
                if (!selectedRoom) {
                    return res.status(400).json({ message: 'Assigned room not found.' });
                }
                if (!bookingTotalAmount) { // Calculate if totalAmount is not provided
                    bookingTotalAmount = await calculateRoomBookingAmount(assignedRoom, idate, odate);
                }
            }
        } else { // Appointment
            if (!date) {
                return res.status(400).json({ message: 'Date is required for appointment booking.' });
            }
        }

        // Determine payment status
        let paymentStatus = 'pending';
        if (bookingTotalAmount > 0 && amountPaid !== undefined) {
            if (amountPaid >= bookingTotalAmount) {
                paymentStatus = 'paid';
            } else if (amountPaid > 0 && amountPaid < bookingTotalAmount) {
                paymentStatus = 'partially_paid';
            }
        }


        const newBooking = new Booking({
            service,
            idate: service === 'room' ? new Date(idate) : undefined,
            odate: service === 'room' ? new Date(odate) : undefined,
            date: service !== 'room' ? new Date(date) : undefined,
            time,
            name,
            email,
            assignedRoom: selectedRoom ? selectedRoom._id : null,
            numberOfGuests: numberOfGuests || (service === 'room' ? 1 : undefined),
            totalAmount: bookingTotalAmount || 0,
            amountPaid: amountPaid || 0,
            paymentStatus: paymentStatus,
            paymentMethod: paymentMethod || null,
            status: finalBookingStatus
        });

        const savedBooking = await newBooking.save();

        // If a room was assigned and the booking is confirmed/pending, mark the room as occupied
        if (savedBooking.assignedRoom && (savedBooking.status === 'confirmed' || savedBooking.status === 'pending')) {
            await Room.findByIdAndUpdate(savedBooking.assignedRoom, { currentBooking: savedBooking._id });
        }

        res.status(201).json(savedBooking);
    } catch (error) {
        console.error('Error creating manual booking:', error);
        res.status(500).json({ error: 'Failed to create booking: ' + error.message });
    }
});


// Delete a booking (Admin only)
router.delete('/:id', auth(['admin']), async (req, res) => {
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


// PUBLIC Route for creating a booking
// ------------------------------------
router.post('/', async (req, res) => {
    try {
        const { service, date, idate, odate, time, name, email, numberOfGuests } = req.body;

        if (service === 'room') {
            if (!idate || !odate || new Date(idate) >= new Date(odate)) {
                return res.status(400).json({ message: 'Check-in and check-out dates are required and valid for room booking.' });
            }

            // Find an AVAILABLE room: clean, not currently booked, and not under maintenance
            // Also ensure it's not booked for the requested dates
            const availableRoom = await Room.findOne({
                status: 'clean',
                currentBooking: null, // Room not currently occupied by an active booking
                capacity: { $gte: numberOfGuests || 1 } // Ensure capacity
            });

            if (!availableRoom) {
                return res.status(400).json({ message: 'No suitable rooms currently available for the selected dates.' });
            }

            // Double-check for date conflicts with existing bookings for this specific room
            // This is important because `currentBooking: null` only checks current occupancy,
            // not future booked but not yet occupied slots.
            const conflictBooking = await Booking.findOne({
                assignedRoom: availableRoom._id,
                status: { $in: ['pending', 'confirmed'] }, // Check active bookings
                $or: [
                    // New booking starts before existing ends AND new booking ends after existing starts
                    { idate: { $lt: new Date(odate) }, odate: { $gt: new Date(idate) } },
                    // Existing booking starts before new ends AND existing ends after new starts
                    { idate: { $gte: new Date(idate), $lt: new Date(odate) } },
                    { odate: { $gt: new Date(idate), $lte: new Date(odate) } }
                ]
            });

            if (conflictBooking) {
                // This means the room, though 'clean' and not 'currentBooking', is pre-booked.
                return res.status(400).json({ message: 'The selected room is not available for your dates. Please try different dates or room types.' });
            }

            const totalAmount = await calculateRoomBookingAmount(availableRoom._id, idate, odate);

            const newBooking = new Booking({
                service,
                idate: new Date(idate),
                odate: new Date(odate),
                time: "14:00", // Default check-in time for rooms (can be made configurable)
                name,
                email,
                numberOfGuests: numberOfGuests || 1,
                assignedRoom: availableRoom._id,
                totalAmount: totalAmount,
                amountPaid: 0, // Public bookings are initially pending payment
                paymentStatus: 'pending',
                status: 'pending' // Public bookings start as pending, admin confirms
            });

            const booking = await newBooking.save();

            // At this point, the room is assigned to the booking.
            // Mark the room as currently booked ONLY when the booking is 'confirmed' by an admin
            // or when payment is made, not immediately on public submission.
            // This prevents a room from being 'blocked' if the public booking is never paid/confirmed.

            // Send confirmation email
            const managerEmail = 'nachwerarichard@gmail.com'; // Replace with actual manager email
            const stakeholderEmails = ['nachwerarichy@gmail.com']; // Replace with actual stakeholder emails
            const clientEmail = booking.email;

            const emailResult = await sendBookingConfirmationEmail(
                booking,
                managerEmail,
                stakeholderEmails,
                clientEmail
            );

            if (emailResult.success) {
                res.status(201).json({ message: `Room booking successful! Confirmation email sent. Your booking for Room ${availableRoom.roomNumber} is pending confirmation.`, booking });
            } else {
                res.status(201).json({ message: `Room booking successful, but failed to send email. Your booking for Room ${availableRoom.roomNumber} is pending confirmation.`, booking, emailError: emailResult.error });
            }

        } else if (service === 'appointment') {
            if (!date || !time) {
                return res.status(400).json({ message: 'Date and Time are required for appointment booking.' });
            }

            const newBooking = new Booking({
                service,
                date: new Date(date),
                time,
                name,
                email,
                assignedRoom: null, // No room for appointments
                totalAmount: 0, // Or a fixed price for appointment types
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
        console.error('Public booking error:', err.message);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Admin/Housekeeper Login Route (using hardcoded credentials as requested)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Hardcoded credentials (DO NOT USE IN PRODUCTION)
    const HARDCODED_ADMIN_USERNAME = 'admin';
    const HARDCODED_ADMIN_PASSWORD = '123'; // Extremely insecure
    const HARDCODED_HOUSEKEEPER_USERNAME = 'housekeeper';
    const HARDCODED_HOUSEKEEPER_PASSWORD = 'housekeep123'; // Extremely insecure

    let role = null;
    let userId = null; // Placeholder ID for JWT

    if (username === HARDCODED_ADMIN_USERNAME && password === HARDCODED_ADMIN_PASSWORD) {
        role = 'admin';
        userId = 'adminUserId_hardcoded'; // Example unique ID for admin
    } else if (username === HARDCODED_HOUSEKEEPER_USERNAME && password === HARDCODED_HOUSEKEEPER_PASSWORD) {
        role = 'housekeeper';
        userId = 'housekeeperUserId_hardcoded'; // Example unique ID for housekeeper
    }

    if (role) {
        const token = jwt.sign({ userId: userId, role: role }, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour
        return res.json({ message: 'Login successful!', token, role: role });
    } else {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
});


module.exports = router;
