const http = require('http');

// Function to make HTTP requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    console.log(`Making request to: /api/${path}`);
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

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test all endpoints in sequence
async function testAllEndpoints() {
  try {
    console.log('==============================================');
    console.log('STEP 1: Checking Health Status');
    console.log('==============================================');
    const health = await makeRequest('health');
    console.log(`Status Code: ${health.statusCode}`);
    console.log('Response:');
    console.log(health.data);
    console.log();

    console.log('==============================================');
    console.log('STEP 2: Starting Process');
    console.log('==============================================');
    const startProcess = await makeRequest('start-process');
    console.log(`Status Code: ${startProcess.statusCode}`);
    console.log('Response:');
    console.log(startProcess.data);
    console.log();

    console.log('Waiting 3 seconds for process to initialize...');
    await sleep(3000);

    console.log('==============================================');
    console.log('STEP 3: Checking Logs');
    console.log('==============================================');
    const logs = await makeRequest('logs');
    console.log(`Status Code: ${logs.statusCode}`);
    console.log('Response:');
    console.log(logs.data);
    console.log();

    console.log('==============================================');
    console.log('STEP 4: Stopping Process');
    console.log('==============================================');
    const stopProcess = await makeRequest('stop-process');
    console.log(`Status Code: ${stopProcess.statusCode}`);
    console.log('Response:');
    console.log(stopProcess.data);
    console.log();

    console.log('Waiting 2 seconds for process to stop...');
    await sleep(2000);

    console.log('==============================================');
    console.log('Verifying Process Stopped');
    console.log('==============================================');
    const healthAfterStop = await makeRequest('health');
    console.log(`Status Code: ${healthAfterStop.statusCode}`);
    console.log('Response:');
    console.log(healthAfterStop.data);
    console.log();

    console.log('==============================================');
    console.log('Testing Complete!');
    console.log('==============================================');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the tests
testAllEndpoints(); 