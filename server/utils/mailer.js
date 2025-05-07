// server/utils/mailer.js
const nodemailer = require('nodemailer');

// Configure email transporter (replace with your email service details)
const transporter = nodemailer.createTransport({
  service: 'Gmail', // Or your email service
  auth: {
    user: process.env.EMAIL_USER, // Your email address (from Render environment variables)
    pass: process.env.EMAIL_PASS, // Your email password or app-specific password (from Render environment variables)
  },
});

async function sendBookingConfirmationEmail(bookingData, managerEmail, stakeholderEmails, clientEmail) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: `${managerEmail}, ${stakeholderEmails.join(', ')}, ${clientEmail}`,
    subject: `New Booking Confirmation - ${bookingData.name}`,
    html: `
      <p>A new booking has been made with the following details:</p>
      <ul>
        <li><strong>Service:</strong> ${bookingData.service}</li>
        <li><strong>Date:</strong> ${bookingData.date}</li>
        <li><strong>Time:</strong> ${bookingData.time}</li>
        <li><strong>Name:</strong> ${bookingData.name}</li>
        <li><strong>Email:</strong> ${bookingData.email}</li>
      </ul>
      <p>Thank you,</p>
      <p>Your Booking System</p>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendBookingConfirmationEmail };