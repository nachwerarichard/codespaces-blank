// server/seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/user.model'); // Adjust the path to your User model if needed

async function seedDatabase() {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'https://bookingenginebackend.onrender.com', { // Use your MongoDB URI from .env
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // 2. Clear existing users (Optional:  Use with caution!)
    // If you want to start with a fresh User collection, uncomment this:
    // await User.deleteMany({});
    // console.log('Cleared existing users');

    // 3. Define the user data with a hashed password
    const adminUser = {
      username: 'admin', //  Choose your desired username
      password: await bcrypt.hash('password123', 10), //  Choose a strong password,  10 is the salt rounds
    };

    const editorUser = {
        username: 'editor',
        password: await bcrypt.hash('editorpassword', 10)
    }

    // 4. Insert the user into the database
    //  Check if the user already exists.
    const existingAdmin = await User.findOne({username: adminUser.username});
    const existingEditor = await User.findOne({username: editorUser.username});

    if(!existingAdmin){
        await User.create(adminUser);
        console.log('Admin user created');
    }
    else{
        console.log('Admin user already exists');
    }

    if(!existingEditor){
        await User.create(editorUser);
        console.log('Editor user created');
    }
    else{
        console.log('Editor user already exists');
    }


    console.log('Database seeding complete');


  } catch (error) {
    // 5. Handle errors during the process
    console.error('Error seeding database:', error);
  } finally {
    // 6. Disconnect from MongoDB
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// 7. Run the seed function
seedDatabase();
