require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Error handling for bad JSON/body
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('Bad JSON:', err.message);
        return res.status(400).json({ error: "Invalid JSON body" });
    }
    next();
});

// In-memory 'memory' for agents
// Map<conversation_id, { turnCount: number, lastState: string }>
const conversationMemory = new Map();

// --- SCAM HEURISTICS ---
const SCAM_KEYWORDS = [
    'otp', 'urgent', 'account blocked', 'prize', 'kyc', 'refund', 'bank',
    'verify', 'link', 'lottery', 'winner', 'password', 'pin', 'expire',
    'suspended', 'verification', 'credit card', 'debit card'
];

function calculateScamScore(message) {
    if (!message) return 0;
    const lowerMsg = message.toLowerCase();
    let hits = 0;

    SCAM_KEYWORDS.forEach(word => {
        if (lowerMsg.includes(word)) {
            hits++;
        }
    });

    // Simple heuristic: 1 hit = 0.4, 2 hits = 0.7, 3+ hits = 0.95
    if (hits === 0) return 0.05; // Low baseline
    if (hits === 1) return 0.45;
    if (hits === 2) return 0.75;
    return 0.98;
}

// --- INTELLIGENCE EXTRACTION ---
// Standard Regex patterns for Indian context
const PATTERNS = {
    // UPI: username@bank or number@bank
    upi: /\b[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}\b/g, // Improved UPI regex
    // Bank Account: 9-18 digits (often found near IFSC)
    bank_account: /\b\d{9,18}\b/g,
    // IFSC: 4 letters, 0, 6 alphanumeric
    ifsc: /\b[A-Za-z]{4}0[A-Za-z0-9]{6}\b/g,
    // URLs (http/https)
    links: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
};

function extractIntelligence(text) {
    const results = {
        upi: [],
        bank_accounts: [],
        ifsc: [],
        links: []
    };

    if (!text) return results;

    const upiMatches = text.match(PATTERNS.upi);
    if (upiMatches) results.upi = [...new Set(upiMatches)]; // Dedup

    const bankMatches = text.match(PATTERNS.bank_account);
    if (bankMatches) results.bank_accounts = [...new Set(bankMatches)];

    const ifscMatches = text.match(PATTERNS.ifsc);
    if (ifscMatches) results.ifsc = [...new Set(ifscMatches)];

    const linkMatches = text.match(PATTERNS.links);
    if (linkMatches) results.links = [...new Set(linkMatches)];

    return results;
}

// --- AGENT PERSONA: "Confused Indian User" ---
const AGENT_REPLIES = [
    "Hello sir, I am not understanding. Please tell clearly.",
    "Bhaiya, message aaya but I don't know what to do?",
    "Sir, bank server is down I think. Link not opening.",
    "Acha, ek minute hold karna sir.",
    "Mera net slow hai, thoda rukna.",
    "Kaise bheju? Google Pay or PhonePe?",
    "OTP nahi aaya abhi tak sir...",
    "Why my account blocked? I am worried.",
    "Send me number again, I will try.",
    "Sir isme 'Verify' pe click karu kya?"
];

// Context-aware replies (Simulated)
const CONTEXT_REPLIES = {
    'otp': ["Sir OTP 452... wait, it disappeared.", "Mobile pe OTP nahi aa raha.", "OTP share karna safe hai na sir?"],
    'money': ["Payment failed aa raha hai.", "Server busy bol raha hai bank.", "Kitna amount bhejna hai wapis batao?"],
    'link': ["Link open nahi ho raha.", "Internet error dikha raha hai link pe.", "Ye blue link pe click karna hai?"],
    'default': AGENT_REPLIES
};

function generateAgentReply(message, conversationId) {
    const lowerMsg = message.toLowerCase();

    // Update memory
    let mem = conversationMemory.get(conversationId) || { turns: 0 };
    mem.turns += 1;
    conversationMemory.set(conversationId, mem);

    // Pick category
    let availableReplies = CONTEXT_REPLIES.default;
    if (lowerMsg.includes('otp') || lowerMsg.includes('code')) availableReplies = CONTEXT_REPLIES.otp;
    else if (lowerMsg.includes('pay') || lowerMsg.includes('transfer') || lowerMsg.includes('rs') || lowerMsg.includes('rupee')) availableReplies = CONTEXT_REPLIES.money;
    else if (lowerMsg.includes('link') || lowerMsg.includes('click')) availableReplies = CONTEXT_REPLIES.link;

    // Random pick
    const reply = availableReplies[Math.floor(Math.random() * availableReplies.length)];
    return reply;
}

// --- ROUTES ---

// Health Check
app.get('/', (req, res) => {
    res.json({ status: "HoneyPot Server Running", description: "Send POST to /api/honeypot" });
});

app.post('/api/honeypot', (req, res) => {
    try {
        // 1. Auth Check
        const apiKey = req.headers['x-api-key'];
        if (!process.env.API_KEY || apiKey !== process.env.API_KEY) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // 2. Parse Input
        const body = req.body || {};
        const { conversation_id, message, history } = body;
        const cid = conversation_id || "default";

        // Handle empty input gracefully (Tester might send empty body)
        const msgText = message || "";

        // 3. Scam Detection
        const confidence = calculateScamScore(msgText);
        const isScam = confidence >= 0.45; // Threshold

        // 4. Intelligence Extraction
        let combinedText = msgText;
        if (Array.isArray(history)) {
            history.forEach(h => {
                if (h && h.content) combinedText += " " + h.content;
            });
        }
        const extracted = extractIntelligence(combinedText);

        // 5. Agent Activation
        let agentReply = null;
        if (isScam) {
            agentReply = generateAgentReply(msgText, cid);
        }

        // 6. Response Construction
        const responseData = {
            is_scam: isScam,
            confidence: confidence,
            turns: conversationMemory.get(cid)?.turns || 1,
            agent_reply: agentReply, // null if not scam
            extracted: extracted,
            engagement_active: isScam,
            timestamp: new Date().toISOString()
        };

        res.json(responseData);

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Agentic HoneyPot server running on port ${PORT}`);
});
