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

// Test logs endpoint
async function testLogs() {
  try {
    console.log('==============================================');
    console.log('Testing Logs Endpoint');
    console.log('==============================================');
    const logs = await makeRequest('logs');
    console.log(`Status Code: ${logs.statusCode}`);
    console.log('Response:');
    console.log(logs.data);
    console.log();

    // Parse the response to check success
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
      console.error('Error parsing response:', parseError);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testLogs(); 