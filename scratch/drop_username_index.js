const mongoose = require('mongoose');
require('dotenv').config();

async function dropIndex() {
  try {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/rentbuddy';
    await mongoose.connect(mongoUrl);
    console.log('Connected to MongoDB');
    
    const collection = mongoose.connection.collection('users');
    await collection.dropIndex('username_1');
    console.log('Successfully dropped index username_1');
    
    process.exit(0);
  } catch (error) {
    console.error('Error dropping index:', error.message);
    process.exit(1);
  }
}

dropIndex();
