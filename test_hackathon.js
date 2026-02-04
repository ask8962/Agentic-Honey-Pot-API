const http = require('http');

const API_KEY = 'secret_honey_key_123';
const PORT = 3000;

function runTest(name, payload) {
    return new Promise((resolve) => {
        console.log(`\n--- Test: ${name} ---`);
        const data = JSON.stringify(payload);

        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/api/honeypot',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                try {
                    const parsed = JSON.parse(body);
                    console.log("Response:", JSON.stringify(parsed, null, 2));

                    // Validate response format
                    if (parsed.status && parsed.reply) {
                        console.log("✅ Format OK: { status, reply }");
                    } else {
                        console.log("❌ Format WRONG: Expected { status, reply }");
                    }
                } catch (e) {
                    console.log("Response (Raw):", body);
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
    // Test 1: First Message (Empty History)
    await runTest("First Message (Scam)", {
        sessionId: "test-session-001",
        message: {
            sender: "scammer",
            text: "Your bank account will be blocked today. Verify immediately.",
            timestamp: Date.now()
        },
        conversationHistory: [],
        metadata: { channel: "SMS", language: "English", locale: "IN" }
    });

    // Test 2: Follow-Up Message
    await runTest("Follow-Up Message", {
        sessionId: "test-session-001",
        message: {
            sender: "scammer",
            text: "Share your UPI ID to avoid account suspension.",
            timestamp: Date.now()
        },
        conversationHistory: [
            { sender: "scammer", text: "Your bank account will be blocked today.", timestamp: Date.now() },
            { sender: "user", text: "Why will my account be blocked?", timestamp: Date.now() }
        ],
        metadata: { channel: "SMS", language: "English", locale: "IN" }
    });

    // Test 3: Empty Body
    await runTest("Empty Body", {});

    // Test 4: Message as Object (Edge Case)
    await runTest("Message Object Invalid", {
        sessionId: "test-session-002",
        message: { text: {} }
    });
}

start();
