/**
 * Process model for storing information about running processes
 */

const mongoose = require('mongoose');

// Define schema
const processSchema = new mongoose.Schema({
  // Process type (e.g., 'agent', 'browser', 'terminal')
  type: {
    type: String,
    required: true,
    enum: ['agent', 'browser', 'terminal', 'python']
  },
  
  // Session ID associated with this process
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Process status
  status: {
    type: String,
    required: true,
    enum: ['starting', 'running', 'completed', 'failed', 'stopped', 'error'],
    default: 'starting'
  },
  
  // Process start time
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Process end time (if completed)
  endTime: {
    type: Date
  },
  
  // System process ID
  pid: {
    type: Number
  },
  
  // Exit code (if completed)
  exitCode: {
    type: Number
  },
  
  // Error message (if failed)
  errorMessage: {
    type: String
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Process logs
  logs: [{
    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'debug'],
      default: 'info'
    },
    message: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Add method to add a log entry
processSchema.methods.addLog = function(level, message) {
  this.logs.push({
    level,
    message,
    timestamp: new Date()
  });
  return this.save();
};

// Create and export model
let Process;

try {
  // Try to use existing model
  Process = mongoose.model('Process');
} catch (e) {
  // Model doesn't exist yet, create it
  Process = mongoose.model('Process', processSchema);
}

module.exports = Process;