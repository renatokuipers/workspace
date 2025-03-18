const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variable with fallback
    const mongoURI = process.env.DATABASE_URL || 'mongodb://localhost:27017/openmanus';

    // Set up Mongoose options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true
    };

    // Connect to MongoDB
    const connection = await mongoose.connect(mongoURI, options);
    
    console.log(`MongoDB Connected: ${connection.connection.host}`);
    
    // Set up handlers for connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });
    
    return connection;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = { connectDB };