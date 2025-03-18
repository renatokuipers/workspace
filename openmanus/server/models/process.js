const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
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
});

const processSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['starting', 'running', 'error', 'completed', 'stopped'],
    default: 'starting'
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  pid: {
    type: Number
  },
  exitCode: {
    type: Number
  },
  command: {
    type: String,
    required: true
  },
  restartCount: {
    type: Number,
    default: 0
  },
  logs: [logSchema]
}, {
  timestamps: true
});

const Process = mongoose.model('Process', processSchema);

module.exports = Process;