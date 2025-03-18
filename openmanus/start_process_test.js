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

// Test start process endpoint
async function testStartProcess() {
  try {
    console.log('==============================================');
    console.log('Testing Start Process Endpoint');
    console.log('==============================================');
    const startProcess = await makeRequest('start-process');
    console.log(`Status Code: ${startProcess.statusCode}`);
    console.log('Response:');
    console.log(startProcess.data);
    console.log();

    // Parse the response to get process ID if available
    try {
      const response = JSON.parse(startProcess.data);
      if (response.success && response.processInfo && response.processInfo.pid) {
        console.log(`Process started with PID: ${response.processInfo.pid}`);
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testStartProcess(); 