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

// Function to start a process
async function startProcess() {
  console.log('Starting process...');
  const response = await makeRequest('start-process');
  console.log(`Status Code: ${response.statusCode}`);
  
  let processInfo = null;
  try {
    const result = JSON.parse(response.data);
    if (result.success && result.processInfo) {
      processInfo = result.processInfo;
      console.log(`Process started with ID: ${processInfo._id}`);
      console.log(`Process started with PID: ${processInfo.pid}`);
    }
  } catch (error) {
    console.error('Error parsing response:', error);
  }
  
  return processInfo;
}

// Function to modify the database URL for direct testing
async function modifyDatabaseUrl() {
  // This is a test function we'd normally implement
  // For now, it's a placeholder
  console.log('(Note: Unable to directly modify the database URL in this script)');
}

// Main test function
async function runTest() {
  console.log('==============================================');
  console.log('CHECKING PROCESSES TEST');
  console.log('==============================================');
  
  try {
    // Step 1: Start a process
    console.log('\nSTEP 1: Starting a new process');
    const processInfo = await startProcess();
    
    // Step 2: Fetch logs (this should work if database is connected)
    console.log('\nSTEP 2: Fetching logs');
    const logsResponse = await makeRequest('logs');
    console.log(`Logs Status Code: ${logsResponse.statusCode}`);
    console.log('Logs Response:');
    console.log(logsResponse.data);
    
    console.log('\nTEST COMPLETED');
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
runTest(); 