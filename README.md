# Agentic Honey-Pot Backend

A lightweight Node.js + Express backend designed to detect scam attempts, extract intelligence, and waste scammers' time using an automated "Confused Indian User" persona.

## Features

- **Scam Detection**: Heuristic-based scoring using keywords (OTP, KYC, blocked, etc.).
- **Intelligence Extraction**: Automatically parses UPI IDs, Bank Account numbers, IFSC codes, and malicious links.
- **Agentic Persona**: Engages scammers with believable, time-wasting replies in Indian English/Hinglish.
- **Secure**: Protected via `x-api-key`.

## Prerequisites

- Node.js (v14+)
- npm

## Setup & Running Locally

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Rename `.env.example` to `.env` and set your secrets:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to set your desired `API_KEY`.*

3. **Start Server**
   ```bash
   npm start
   ```
   Server defaults to port 3000.

## API Usage

### Endpoint: `POST /api/honeypot`

**Headers**:
- `Content-Type`: `application/json`
- `x-api-key`: `<YOUR_API_KEY>`

**Body**:
```json
{
  "conversation_id": "12345",
  "message": "Dear customer your account is blocked. Click https://scam-link.com/login to verify KYC immediately.",
  "history": []
}
```

**Response**:
```json
{
  "is_scam": true,
  "confidence": 0.98,
  "turns": 1,
  "agent_reply": "Why my account blocked? I am worried.",
  "extracted": {
    "upi": [],
    "bank_accounts": [],
    "ifsc": [],
    "links": ["https://scam-link.com/login"]
  }
}
```

## Deployment on Render.com

This project is ready for deployment on [Render](https://render.com).

1. **Push to GitHub**: Initialize a git repo and push this code.
2. **Create Web Service**:
   - Go to Render Dashboard > New > Web Service.
   - Connect your GitHub repository.
3. **Settings**:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. **Environment Variables**:
   - Add `API_KEY` (Value: your chosen secret key)
   - Add `node_version` (Value: 18 or higher recommended)
5. **Deploy**: Click "Create Web Service".

Render will provide you with a URL (e.g., `https://your-app.onrender.com`). Use this URL to send POST requests.
