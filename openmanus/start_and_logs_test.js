const http = require('http');

// Function to make HTTP requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/${path}`,
      method: 'GET'
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test function
async function startAndCheckLogs() {
  try {
    console.log('==============================================');
    console.log('STEP 1: Starting Process');
    console.log('==============================================');
    const startProcess = await makeRequest('start-process');
    console.log(`Status Code: ${startProcess.statusCode}`);
    console.log('Response:');
    console.log(startProcess.data);
    console.log();

    // Parse the response to get process ID
    let processId = null;
    try {
      const response = JSON.parse(startProcess.data);
      if (response.success && response.processInfo) {
        processId = response.processInfo._id;
        console.log(`Process started with ID: ${processId}`);
        console.log(`Process started with PID: ${response.processInfo.pid}`);
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
    }

    // Wait for process to initialize
    console.log('Waiting 3 seconds for process to initialize...');
    await sleep(3000);

    console.log('==============================================');
    console.log('STEP 2: Checking Logs');
    console.log('==============================================');
    const logs = await makeRequest('logs');
    console.log(`Status Code: ${logs.statusCode}`);
    console.log('Response:');
    console.log(logs.data);
    console.log();

    // Parse the logs response
    try {
      const response = JSON.parse(logs.data);
      if (response.success && response.process) {
        console.log(`Process ID: ${response.process.id}`);
        console.log(`Status: ${response.process.status}`);
        console.log(`Start Time: ${response.process.startTime}`);
        console.log(`PID: ${response.process.pid}`);
        console.log(`Logs Count: ${response.process.logs.length}`);
      }
    } catch (parseError) {
      console.error('Error parsing logs response:', parseError);
    }

    console.log('==============================================');
    console.log('Testing Complete!');
    console.log('==============================================');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
startAndCheckLogs(); 