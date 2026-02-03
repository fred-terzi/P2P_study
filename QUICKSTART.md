# P2P LLM Stream - Quick Start Guide

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd /home/mike-diker/git-repos/P2P_study
npm install
```

### 2. Run Tests (with V8 Coverage)

```bash
npm run test:coverage
```

Expected output:
```
Test Suites: 4 passed, 4 total
Tests:       151 passed, 151 total

---------------|---------|----------|---------|---------|
File           | % Stmts | % Branch | % Funcs | % Lines |
---------------|---------|----------|---------|---------|
All files      |   99.32 |     98.5 |   96.34 |   99.32 |
---------------|---------|----------|---------|---------|
```

### 3. Start Development Server

```bash
npm run dev
```

This opens:
- **Host Page**: http://localhost:3000/host.html
- **Client Page**: http://localhost:3000/client.html

## 📱 Demo Workflow

### As Host:
1. Open `host.html`
2. Click **"Create Session"** - generates QR code
3. Click **"Simulate LLM"** to stream sample text
4. Watch text appear in real-time

### As Client:
1. Open `client.html` (in another browser/device)
2. Scan QR code OR copy-paste the Room ID
3. Click **"Join"**
4. See streamed text appear in real-time!

## 🧪 Test Commands

```bash
# Full coverage report
npm run test:coverage

# Watch mode (auto-rerun on changes)
npm run test:watch

# Single run
npm test

# Automated iteration until passing
npm run test:iterate
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/modules/connection.js` | P2P WebRTC connections |
| `src/modules/sync.js` | Real-time data sync |
| `src/modules/qrcode.js` | QR generation/parsing |
| `src/modules/storage.js` | Browser persistence |
| `host.html` | Host interface |
| `client.html` | Client interface |

## 🔧 Module Usage

```javascript
// Import all modules
import {
  createConnectionManager,
  createSyncManager,
  createStreamHandler,
  createQRManager,
  createStorageAdapter,
  generateRoomId
} from './src/index.js';

// Create a P2P session
const manager = createConnectionManager({
  onPeerJoin: (id) => console.log('Peer joined:', id),
  onData: (data) => console.log('Received:', data)
});

const roomId = generateRoomId();
await manager.join(roomId, joinRoom); // joinRoom from Trystero

// Stream text
const sync = createSyncManager();
const stream = createStreamHandler(sync, manager);
stream.startStream();
stream.onToken('Hello ');
stream.onToken('World!');
```

## ✅ Verification Checklist

- [ ] `npm install` completes without errors
- [ ] `npm run test:coverage` shows 99%+ coverage
- [ ] `npm run dev` starts server on port 3000
- [ ] Host page generates QR code
- [ ] Client page can join via Room ID
- [ ] Text streams in real-time between peers
