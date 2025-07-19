const cron = require('node-cron');
const Booking = require('./models/booking.model');
const Room = require('./models/room.model');

const setupHousekeepingCron = () => {
    // Schedule to run every day at 1:00 AM EAT (adjust as needed for your timezone/server time)
    // The cron string '0 1 * * *' means: 0 minutes, 1 hour, every day of month, every month, every day of week
    cron.schedule('0 1 * * *', async () => {
        console.log(`[${new Date().toISOString()}] Running daily housekeeping room status update...`);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1); // Get yesterday's date
        yesterday.setHours(23, 59, 59, 999); // End of yesterday

        try {
            // Find bookings that have a check-out date on or before yesterday,
            // are confirmed, have an assigned room, and the room is currently linked to this booking
            const bookingsToProcess = await Booking.find({
                odate: { $lte: yesterday }, // Check-out date is less than or equal to yesterday
                status: 'confirmed', // Only process confirmed bookings
                assignedRoom: { $ne: null } // Ensure a room was assigned
            }).populate('assignedRoom');

            if (bookingsToProcess.length === 0) {
                console.log('No completed room bookings found for status update.');
                return;
            }

            for (const booking of bookingsToProcess) {
                // Ensure the room exists and its currentBooking matches this booking
                // to avoid marking a room dirty that's already assigned to a new booking
                if (booking.assignedRoom && String(booking.assignedRoom.currentBooking) === String(booking._id)) {
                    // Mark room as dirty and clear its currentBooking reference
                    await Room.findByIdAndUpdate(booking.assignedRoom._id, {
                        status: 'dirty',
                        currentBooking: null
                    });
                    console.log(`Room ${booking.assignedRoom.roomNumber} marked as dirty and cleared booking ${booking._id}.`);
                }

                // Also, mark the booking itself as 'completed'
                if (booking.status !== 'completed') {
                    await Booking.findByIdAndUpdate(booking._id, { status: 'completed' });
                }
            }
            console.log(`[${new Date().toISOString()}] Housekeeping update finished.`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error in housekeeping cron job:`, error);
        }
    }, {
        timezone: "Africa/Kampala" // Set to EAT or your server's timezone
    });
};

module.exports = setupHousekeepingCron;
