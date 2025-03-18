// Load environment variables
require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const basicRoutes = require("./routes/index");
const browserRoutes = require("./routes/browserRoutes");
const flowRoutes = require("./routes/flowRoutes");
const { router: terminalRouter, setupTerminalWebSocket } = require("./routes/terminalRoutes");
const { connectDB } = require("./config/database");
const cors = require("cors");
const http = require('http');

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL variables in .env missing.");
  process.exit(-1);
}

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Pretty-print JSON responses
app.enable('json spaces');
// We want to be consistent with URL paths, so we enable strict routing
app.enable('strict routing');

// Configure CORS with WebSocket support
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-production-domain.com']
    : ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
connectDB();

app.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
  console.error(error.stack);
});

// Setup WebSocket for terminal
setupTerminalWebSocket(server);

// Basic Routes
app.use(basicRoutes);
app.use('/api/terminal', terminalRouter);
app.use('/api/browser', browserRoutes);
app.use('/api', flowRoutes);

// If no routes handled the request, it's a 404
app.use((req, res, next) => {
  res.status(404).send("Page not found.");
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`Unhandled application error: ${err.message}`);
  console.error(err.stack);
  res.status(500).send("There was an error serving your request.");
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});