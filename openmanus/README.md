# OpenManus AI Assistant

OpenManus is a local AI assistant platform that combines a Node.js backend with a React frontend to provide a powerful interface for interacting with Python-based AI tools.

## Features

- Real-time chat interface for communicating with AI
- Terminal access for running commands
- Browser automation capabilities
- Integration with Python backend for AI processing
- WebSocket-based communication for real-time updates
- Fully local processing without external API dependencies

## Project Structure

The project is organized into several key components:

- **Client**: React-based frontend interface
- **Server**: Node.js backend that handles API requests and WebSockets
- **Core**: Python-based AI processing engine (accessed via the server)

## Setup

### Prerequisites

- Node.js 16+ and npm
- Python 3.8+ (for the core AI functionality)
- MongoDB (optional, for persistence)
- PowerShell (for Windows)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/openmanus.git
   cd openmanus
   ```

2. Install server dependencies:
   ```
   cd server
   npm install
   ```

3. Install client dependencies:
   ```
   cd ../client
   npm install
   ```

4. Create a `.env` file in the server directory with the following content:
   ```
   PORT=3001
   NODE_ENV=development
   USE_MONGODB=false
   # If using MongoDB, add MONGODB_URI=your_mongodb_uri
   ```

5. Install Python dependencies (optional, for running the core AI):
   ```
   cd ../python
   pip install -r requirements.txt
   ```

## Running the Application

### Development Mode

1. Start the server:
   ```
   cd server
   npm start
   ```

2. In a separate terminal, start the client:
   ```
   cd client
   npm start
   ```

3. Access the application at http://localhost:3000

### Production Mode

1. Build the client:
   ```
   cd client
   npm run build
   ```

2. Start the server in production mode:
   ```
   cd ../server
   NODE_ENV=production npm start
   ```

3. Access the application at http://localhost:3001

## Usage

1. Open the application in your browser
2. Use the chat interface to interact with the AI assistant
3. Utilize the terminal for running commands
4. Access the browser tool for web navigation tasks

## Technologies Used

- **Frontend**: React, TypeScript, WebSockets
- **Backend**: Node.js, Express, WebSockets
- **Database**: MongoDB (optional)
- **AI Processing**: Custom Python implementation

## License

This project is licensed under the MIT License - see the LICENSE file for details. 