const mongoose = require('mongoose');
// We are not using bcrypt here as per your request to use hardcoded passwords
// in the logic, but usually, this model would hash passwords.

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    // In a real app, this would store the hashed password.
    // For hardcoded passwords in route logic, this field might not be strictly needed
    // or could store a non-sensitive value if you still want User documents.
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'housekeeper'],
        required: true
    }
});

module.exports = mongoose.model('User', UserSchema);
