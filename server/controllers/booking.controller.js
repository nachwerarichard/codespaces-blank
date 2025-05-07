// server/controllers/booking.controller.js
const Booking = require('../models/booking.model'); // Assuming you have a booking model
const { sendBookingConfirmationEmail } = require('../utils/mailer');

// ... other controller functions ...

exports.createBooking = async (req, res) => {
  try {
    const newBooking = new Booking(req.body);
    const savedBooking = await newBooking.save();

    // Email recipients (replace with your actual logic to fetch these)
    const managerEmail = 'nachwerarichard@gmail.com';
    const stakeholderEmails = ['nachwerarichy@gmail.com'];
    const clientEmail = savedBooking.email; // Assuming client email is in the booking data

    // Send confirmation email
    const emailResult = await sendBookingConfirmationEmail(
      savedBooking,
      managerEmail,
      stakeholderEmails,
      clientEmail
    );

    if (emailResult.success) {
      res.status(201).json({ message: 'Booking created successfully and confirmation email sent.', booking: savedBooking });
    } else {
      res.status(201).json({ message: 'Booking created successfully, but email failed to send.', booking: savedBooking, emailError: emailResult.error });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ... other controller functions ...