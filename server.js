require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Comprehensive CORS for browser-based testers
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

// Handle OPTIONS preflight
app.options('*', cors());

// Body parsing - handle all possible formats
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: '*/*' })); // Handle text/plain as fallback

// Error handling for bad JSON/body
app.use((err, req, res, next) => {
    if (err) {
        console.error('Body parse error:', err.message);
        return res.status(200).json({ status: "success", reply: "Message received." });
    }
    next();
});

// In-memory session storage
// Map<sessionId, { turns, scamDetected, extractedIntel, agentNotes }>
const sessionMemory = new Map();

// --- SCAM HEURISTICS ---
const SCAM_KEYWORDS = [
    'otp', 'urgent', 'account blocked', 'prize', 'kyc', 'refund', 'bank',
    'verify', 'link', 'lottery', 'winner', 'password', 'pin', 'expire',
    'suspended', 'verification', 'credit card', 'debit card', 'upi',
    'verify now', 'blocked', 'immediately', 'click here'
];

function calculateScamScore(message) {
    if (!message || typeof message !== "string") return { score: 0.05, keywords: [] };
    const lowerMsg = message.toLowerCase();
    let hits = 0;
    const foundKeywords = [];

    SCAM_KEYWORDS.forEach(word => {
        if (lowerMsg.includes(word)) {
            hits++;
            foundKeywords.push(word);
        }
    });

    let score = 0.05;
    if (hits === 1) score = 0.45;
    else if (hits === 2) score = 0.75;
    else if (hits >= 3) score = 0.98;

    return { score, keywords: foundKeywords };
}

// --- INTELLIGENCE EXTRACTION ---
const PATTERNS = {
    upi: /\b[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}\b/g,
    bank_account: /\b\d{9,18}\b/g,
    ifsc: /\b[A-Za-z]{4}0[A-Za-z0-9]{6}\b/g,
    links: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    phone: /\+?\d{10,13}/g
};

function extractIntelligence(text) {
    const results = {
        upiIds: [],
        bankAccounts: [],
        phishingLinks: [],
        phoneNumbers: [],
        suspiciousKeywords: []
    };

    if (!text || typeof text !== "string") return results;

    const upiMatches = text.match(PATTERNS.upi);
    if (upiMatches) results.upiIds = [...new Set(upiMatches)];

    const bankMatches = text.match(PATTERNS.bank_account);
    if (bankMatches) results.bankAccounts = [...new Set(bankMatches)];

    const linkMatches = text.match(PATTERNS.links);
    if (linkMatches) results.phishingLinks = [...new Set(linkMatches)];

    const phoneMatches = text.match(PATTERNS.phone);
    if (phoneMatches) results.phoneNumbers = [...new Set(phoneMatches)];

    return results;
}

// --- AGENT PERSONA ---
const AGENT_REPLIES = {
    default: [
        "Hello sir, I am not understanding. Please tell clearly.",
        "Bhaiya, message aaya but I don't know what to do?",
        "Sir, bank server is down I think. Link not opening.",
        "Acha, ek minute hold karna sir.",
        "Mera net slow hai, thoda rukna.",
        "Why is my account being suspended?",
        "Send me number again, I will try."
    ],
    otp: [
        "Sir OTP 452... wait, it disappeared.",
        "Mobile pe OTP nahi aa raha.",
        "OTP share karna safe hai na sir?"
    ],
    money: [
        "Payment failed aa raha hai.",
        "Server busy bol raha hai bank.",
        "Kitna amount bhejna hai wapis batao?"
    ],
    link: [
        "Link open nahi ho raha.",
        "Internet error dikha raha hai link pe.",
        "Ye blue link pe click karna hai?"
    ],
    upi: [
        "UPI ID kya hai aapka?",
        "Mujhe aapka UPI ID bhejo paise bhejne ke liye.",
        "Google Pay ya PhonePe, kaunsa use karu?"
    ]
};

function generateAgentReply(message) {
    const safeMsg = typeof message === "string" ? message : "";
    const lowerMsg = safeMsg.toLowerCase();

    let replies = AGENT_REPLIES.default;
    if (lowerMsg.includes('otp') || lowerMsg.includes('code')) replies = AGENT_REPLIES.otp;
    else if (lowerMsg.includes('pay') || lowerMsg.includes('transfer') || lowerMsg.includes('rs')) replies = AGENT_REPLIES.money;
    else if (lowerMsg.includes('link') || lowerMsg.includes('click')) replies = AGENT_REPLIES.link;
    else if (lowerMsg.includes('upi')) replies = AGENT_REPLIES.upi;

    return replies[Math.floor(Math.random() * replies.length)];
}

// --- GUVI CALLBACK ---
function sendGuviCallback(sessionId, session) {
    const payload = JSON.stringify({
        sessionId: sessionId,
        scamDetected: session.scamDetected,
        totalMessagesExchanged: session.turns,
        extractedIntelligence: session.extractedIntel,
        agentNotes: session.agentNotes || "Scammer used urgency tactics"
    });

    const options = {
        hostname: 'hackathon.guvi.in',
        path: '/api/updateHoneyPotFinalResult',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        console.log(`GUVI Callback Status: ${res.statusCode}`);
    });
    req.on('error', (e) => console.error('GUVI Callback Error:', e.message));
    req.write(payload);
    req.end();
}

// --- ROUTES ---

// Health Check
app.get('/', (req, res) => {
    res.json({ status: "HoneyPot Server Running", description: "Send POST to /api/honeypot" });
});

// Main Honeypot Endpoint
app.post('/api/honeypot', (req, res) => {
    try {
        // 1. Auth Check
        const apiKey = req.headers['x-api-key'];
        if (!process.env.API_KEY || apiKey !== process.env.API_KEY) {
            return res.status(401).json({ status: "error", reply: "Unauthorized" });
        }

        // 2. Parse Input (Hackathon Format)
        const body = req.body || {};
        const sessionId = body.sessionId || "default";
        const messageObj = body.message || {};
        const msgText = (typeof messageObj.text === "string") ? messageObj.text : "";
        const conversationHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];

        // 3. Session Management
        let session = sessionMemory.get(sessionId) || {
            turns: 0,
            scamDetected: false,
            extractedIntel: { upiIds: [], bankAccounts: [], phishingLinks: [], phoneNumbers: [], suspiciousKeywords: [] },
            agentNotes: ""
        };
        session.turns += 1;

        // 4. Scam Detection
        const { score, keywords } = calculateScamScore(msgText);
        const isScam = score >= 0.45;
        if (isScam) session.scamDetected = true;

        // 5. Intelligence Extraction (from current message + history)
        let combinedText = msgText;
        conversationHistory.forEach(h => {
            if (h && typeof h.text === "string") combinedText += " " + h.text;
        });
        const intel = extractIntelligence(combinedText);

        // Merge intelligence
        session.extractedIntel.upiIds = [...new Set([...session.extractedIntel.upiIds, ...intel.upiIds])];
        session.extractedIntel.bankAccounts = [...new Set([...session.extractedIntel.bankAccounts, ...intel.bankAccounts])];
        session.extractedIntel.phishingLinks = [...new Set([...session.extractedIntel.phishingLinks, ...intel.phishingLinks])];
        session.extractedIntel.phoneNumbers = [...new Set([...session.extractedIntel.phoneNumbers, ...intel.phoneNumbers])];
        session.extractedIntel.suspiciousKeywords = [...new Set([...session.extractedIntel.suspiciousKeywords, ...keywords])];

        // 6. Generate Agent Reply
        const agentReply = generateAgentReply(msgText);
        session.agentNotes = `Detected keywords: ${session.extractedIntel.suspiciousKeywords.join(', ')}`;

        // Save session
        sessionMemory.set(sessionId, session);

        // 7. Send GUVI Callback after 5 turns OR if high confidence scam
        if (session.scamDetected && (session.turns >= 5 || score >= 0.75)) {
            sendGuviCallback(sessionId, session);
        }

        // 8. Response (Hackathon Format)
        res.json({ status: "success", reply: agentReply });

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(200).json({ status: "success", reply: "Something went wrong, please try again." });
    }
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Agentic HoneyPot server running on port ${PORT}`);
    });
}

module.exports = app;
