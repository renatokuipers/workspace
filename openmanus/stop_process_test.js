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

// Test stop process endpoint
async function testStopProcess() {
  try {
    console.log('==============================================');
    console.log('Testing Stop Process Endpoint');
    console.log('==============================================');
    const stopProcess = await makeRequest('stop-process');
    console.log(`Status Code: ${stopProcess.statusCode}`);
    console.log('Response:');
    console.log(stopProcess.data);
    console.log();

    // Parse the response to check success
    try {
      const response = JSON.parse(stopProcess.data);
      if (response.success) {
        console.log('Process stopped successfully');
      } else if (response.error) {
        console.log(`Error: ${response.error}`);
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testStopProcess(); 