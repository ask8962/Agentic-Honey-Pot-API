const http = require('http');

// Configuration
const API_KEY = 'secret_honey_key_123';
const PORT = 3000;

const testCase = {
    conversation_id: "test-fix-1",
    message: "your account blocked click link",
    history: []
};

console.log("--- Sending Test Payload ---");
const data = JSON.stringify(testCase);

const req = http.request({
    hostname: 'localhost',
    port: PORT,
    path: '/api/honeypot',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': data.length
    }
}, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const parsed = JSON.parse(body);
            console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log(body);
        }
    });
});

req.on('error', (e) => console.log("Error:", e.message));
req.write(data);
req.end();
