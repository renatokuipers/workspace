const express = require('express');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');
const morgan = require('morgan');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

// Import routes
const chatRoutes = require('./routes/chatRoutes');
const terminalRoutes = require('./routes/terminalRoutes');
const flowRoutes = require('./routes/flowRoutes');
const browserRoutes = require('./routes/browserRoutes');

// Import WebSocket handlers
const chatWebSocketRoutes = require('./routes/chatWebSocketRoutes');
const terminalWebSocketRoutes = require('./routes/terminalWebSocketRoutes');
const flowWebSocketRoutes = require('./routes/flowWebSocketRoutes');

// Import services
const terminalService = require('./services/terminalService');
const chatService = require('./services/chatService');

// Setup Express app
const app = express();
const server = http.createServer(app);

// Create necessary directories
const logsDir = path.join(__dirname, 'logs');
const workspaceDir = path.join(__dirname, 'workspace');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

if (!fs.existsSync(workspaceDir)) {
  fs.mkdirSync(workspaceDir, { recursive: true });
}

// Setup logging
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: accessLogStream }));

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/flow', flowRoutes);
app.use('/api/browser', browserRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Setup WebSocket servers
const chatWss = chatWebSocketRoutes.setupChatWebSocket(server);
const terminalWss = terminalWebSocketRoutes.setupTerminalWebSocket(server);
const flowWss = flowWebSocketRoutes.setupFlowWebSocket(server);

// Set up MongoDB connection if enabled
if (process.env.USE_MONGODB === 'true') {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/openmanus';
  mongoose.connect(mongoUri)
    .then(() => {
      console.log('Connected to MongoDB successfully');
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      console.log('Continuing without MongoDB...');
    });
}

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../client/build');

  if (fs.existsSync(staticPath)) {
    console.log(`Serving static files from: ${staticPath}`);
    app.use(express.static(staticPath));

    // All other GET requests not handled will return the React app
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(staticPath, 'index.html'));
    });
  } else {
    console.warn(`Static path ${staticPath} does not exist. Not serving frontend files.`);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Start the server
const PORT = process.env.PORT || 3001;

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please:
    1. Stop any other server instances (check for 'node server.js' processes)
    2. Choose a different port by setting PORT in your .env file
    3. Restart the application`);

    // Give a clean shutdown
    process.exit(1);
  } else {
    console.error(`Server error: ${error.message}`);
    console.error(error.stack);
  }
});

// Function to start the server
function startServer(port) {
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Try to start the server
startServer(PORT);

// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  console.log('Received shutdown signal, cleaning up...');

  // Close all terminal processes
  terminalService.cleanupAllTerminals();

  // Close the HTTP server
  server.close(() => {
    console.log('HTTP server closed');

    // Close WebSocket servers
    chatWss.close(() => {
      console.log('Chat WebSocket server closed');
    });

    terminalWss.close(() => {
      console.log('Terminal WebSocket server closed');
    });

    flowWss.close(() => {
      console.log('Flow WebSocket server closed');
    });

    // Close database connection
    if (mongoose.connection.readyState) {
      mongoose.connection.close()
        .then(() => {
          console.log('MongoDB connection closed');
          process.exit(0);
        })
        .catch(err => {
          console.error('Error closing MongoDB connection:', err);
          process.exit(1);
        });
    } else {
      process.exit(0);
    }
  });

  // Force exit if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

module.exports = server;