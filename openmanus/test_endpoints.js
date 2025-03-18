// Test script for OpenManus API endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Helper function to format response
function formatResponse(response) {
  return JSON.stringify(response.data, null, 2);
}

// Helper function to test an endpoint
async function testEndpoint(endpoint, description) {
  console.log('\n========================================================');
  console.log(`Testing: ${description}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log('========================================================\n');
  
  try {
    const startTime = Date.now();
    const response = await axios.get(endpoint);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Success! Response received in ${duration}ms`);
    console.log('Response:');
    console.log(formatResponse(response));
    return response.data;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response) {
      console.log(`Status Code: ${error.response.status}`);
      console.log('Response Body:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

// Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test function
async function runTests() {
  console.log('\n📊 STEP 1: CHECKING HEALTH STATUS');
  const health = await testEndpoint(`${BASE_URL}/api/health`, 'Health Check');
  
  console.log('\n🚀 STEP 2: STARTING PROCESS');
  if (!health || health.status === 'down') {
    const startProcess = await testEndpoint(`${BASE_URL}/api/start-process`, 'Start Process');
    
    console.log('Waiting 3 seconds for process to initialize...');
    await sleep(3000);
    
    console.log('\n📊 VERIFYING PROCESS STARTED');
    const healthAfterStart = await testEndpoint(`${BASE_URL}/api/health`, 'Health Check After Start');
  } else {
    console.log('Process is already running, skipping start step.');
  }
  
  console.log('\n📜 STEP 3: CHECKING LOGS');
  const logs = await testEndpoint(`${BASE_URL}/api/logs`, 'Get Process Logs');
  
  console.log('\n🛑 STEP 4: STOPPING PROCESS');
  if (health && health.status === 'up') {
    const stopProcess = await testEndpoint(`${BASE_URL}/api/stop-process`, 'Stop Process');
    
    console.log('Waiting 2 seconds for process to stop...');
    await sleep(2000);
    
    console.log('\n📊 VERIFYING PROCESS STOPPED');
    const healthAfterStop = await testEndpoint(`${BASE_URL}/api/health`, 'Health Check After Stop');
  } else {
    console.log('Process is not running, skipping stop step.');
  }
  
  console.log('\n✨ TESTING COMPLETE ✨');
}

// Run the tests
runTests().catch(error => {
  console.error('Test script error:', error);
}); 