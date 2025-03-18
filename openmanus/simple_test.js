const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/start-process',
  method: 'GET'
};

const req = http.request(options, res => {
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:');
    console.log(data);
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.end(); 