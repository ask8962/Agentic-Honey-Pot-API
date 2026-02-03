const http = require('http');

const API_KEY = 'secret_honey_key_123';
const PORT = 3000;

function runTest(name, payload, method = 'POST') {
    return new Promise((resolve) => {
        console.log(`\n--- Test: ${name} ---`);

        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/api/honeypot',
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
            }
        };

        const data = JSON.stringify(payload);
        options.headers['Content-Length'] = Buffer.byteLength(data);

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                if (res.statusCode !== 200) {
                    console.log("Body:", body);
                } else {
                    console.log("Success (200 OK)");
                }
                resolve();
            });
        });

        req.on('error', (e) => {
            console.log("Network Error (CRASH?):", e.message);
            resolve();
        });

        if (data) req.write(data);
        req.end();
    });
}

async function start() {
    // 1. Message as Object (The Killer)
    await runTest("Message={} (Object)", { message: {} });

    // 2. Message as Array
    await runTest("Message=[] (Array)", { message: [] });

    // 3. Message as Number
    await runTest("Message=123 (Number)", { message: 123 });

    // 4. Message as Null
    await runTest("Message=null", { message: null });

    // 5. History with bad content
    await runTest("History Bad Content", {
        message: "hi",
        history: [{ content: {} }, { content: null }, { content: 123 }]
    });

    // 6. History as string (not array)
    await runTest("History=String", { message: "hi", history: "should be array" });

    // 7. Conversation ID as Object
    await runTest("CID=Object", { message: "hi", conversation_id: {} });

    // 8. Massive Payload
    const massive = "A".repeat(100000);
    await runTest("Massive Message", { message: massive });
}

start();
