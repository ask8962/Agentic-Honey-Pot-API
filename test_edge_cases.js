const http = require('http');

const API_KEY = 'secret_honey_key_123';
const PORT = 3000;

function runTest(name, payload, headers = {}, method = 'POST') {
    return new Promise((resolve) => {
        console.log(`\n--- Test: ${name} ---`);

        const options = {
            hostname: 'localhost',
            port: PORT,
            path: '/api/honeypot',
            method: method,
            headers: {
                'x-api-key': API_KEY,
                ...headers
            }
        };

        let data = payload;
        if (typeof payload === 'object') {
            data = JSON.stringify(payload);
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = data.length;
        } else if (typeof payload === 'string') {
            options.headers['Content-Length'] = payload.length;
        }

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
            console.log("Network Error:", e.message);
            resolve();
        });

        if (data) req.write(data);
        req.end();
    });
}

async function start() {
    // 1. Normal Request
    await runTest("Normal JSON", { message: "Hello" });

    // 2. Empty Body (Content-Length: 0)
    await runTest("Empty Body", "", {}, 'POST');

    // 3. Empty JSON Object
    await runTest("Empty JSON {}", {});

    // 4. Missing Message Field
    await runTest("Missing Message", { conversation_id: "123" });

    // 5. URL Encoded (faking it as string manually)
    const urlEncoded = "message=Hello&conversation_id=123";
    await runTest("URL Encoded", urlEncoded, {
        'Content-Type': 'application/x-www-form-urlencoded'
    });

    // 6. Malformed JSON (should be caught by express but NOT crash server)
    await runTest("Malformed JSON", "{ message: 'bad }", {
        'Content-Type': 'application/json'
    });
}

start();
