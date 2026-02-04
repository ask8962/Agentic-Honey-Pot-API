const https = require('https');

// YOUR RENDER URL
const RENDER_HOST = 'agentic-honey-pot-api-yqng.onrender.com';
const API_KEY = 'secret_honey_key_123';

function runTest(name, payload) {
    return new Promise((resolve) => {
        console.log(`\n--- Test: ${name} ---`);
        const data = JSON.stringify(payload);

        const options = {
            hostname: RENDER_HOST,
            path: '/api/honeypot',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'Content-Length': Buffer.byteLength(data)
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

                    if (parsed.status && parsed.reply) {
                        console.log("✅ Format OK");
                    } else {
                        console.log("❌ Format WRONG - Expected { status, reply }");
                    }
                } catch (e) {
                    console.log("Response (Raw):", body.substring(0, 500));
                }
                resolve();
            });
        });

        req.on('error', (e) => console.log("Error:", e.message));
        req.write(data);
        req.end();
    });
}

async function start() {
    // Test with hackathon format
    await runTest("Hackathon Format (Scam)", {
        sessionId: "test-session-001",
        message: {
            sender: "scammer",
            text: "Your bank account will be blocked today. Verify immediately.",
            timestamp: Date.now()
        },
        conversationHistory: [],
        metadata: { channel: "SMS", language: "English", locale: "IN" }
    });

    // Test with empty body
    await runTest("Empty Body", {});
}

start();
