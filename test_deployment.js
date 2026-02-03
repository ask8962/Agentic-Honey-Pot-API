const https = require('https');

// YOUR RENDER URL
const RENDER_URL = 'agentic-honey-pot-api-yqng.onrender.com';
const API_KEY = 'secret_honey_key_123';

function runTest(name, payload) {
    console.log(`\n--- Test: ${name} ---`);
    const data = JSON.stringify(payload);

    const options = {
        hostname: RENDER_URL,
        path: '/api/honeypot',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
            console.log(`Status: ${res.statusCode}`);
            try {
                const parsed = JSON.parse(body);
                console.log("Response:", JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log("Response (Raw):", body);
            }
        });
    });

    req.on('error', (e) => console.log("Error:", e.message));
    req.write(data);
    req.end();
}

// 1. Test Clean
runTest("Clean Check", { message: "Hello server" });

// 2. Test Scam
setTimeout(() => {
    runTest("Scam Check", { message: "Your account blocked click link" });
}, 2000);
