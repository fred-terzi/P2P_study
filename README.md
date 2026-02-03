# P2P Study

This repo will be to develop a deeper understanding of P2P networks and protocols.

## Project Goals

1. A 'host' node that can generate a QR code to start a P2P session.
2. A 'client' node that can scan the QR code to join the P2P session.
3. The 'host' node saves data in browser storage.
4. The 'host' and 'client' nodes can sync data between each other in real-time.

**Use case:** Have an LLM generating text and streaming it to connected clients in real-time over a P2P connection.

---

# P2P Technologies Research

> Comprehensive research on open-source P2P technologies for browser-based real-time communication

## Table of Contents
- [1. WebRTC-Based Solutions](#1-webrtc-based-solutions)
  - [PeerJS](#peerjs)
  - [simple-peer](#simple-peer)
  - [Trystero](#trystero)
  - [y-webrtc](#y-webrtc)
- [2. CRDTs and Real-Time Sync](#2-crdts-and-real-time-sync)
  - [Yjs](#yjs)
  - [Automerge](#automerge)
- [3. Decentralized/P2P Frameworks](#3-decentralizedp2p-frameworks)
  - [Gun.js](#gunjs)
  - [js-libp2p](#js-libp2p)
  - [OrbitDB](#orbitdb)
- [4. QR Code Libraries](#4-qr-code-libraries)
  - [node-qrcode](#node-qrcode-qr-generation)
  - [jsQR](#jsqr-qr-scanning)
- [5. Comparison Matrix](#5-comparison-matrix)
- [6. Recommendations for LLM Text Streaming](#6-recommendations-for-llm-text-streaming)

---

## 1. WebRTC-Based Solutions

### PeerJS

**Repository:** [github.com/peers/peerjs](https://github.com/peers/peerjs)  
**Stars:** 13.2k | **License:** MIT

#### How It Works
PeerJS wraps the WebRTC API to provide a complete, configurable peer-to-peer connection API. It handles the complexity of WebRTC by providing a PeerServer for brokering connections (signaling), allowing peers to connect using simple peer IDs.

#### Pros
- ✅ Very easy to use - simple API abstraction over WebRTC
- ✅ Supports data channels, audio, and video
- ✅ Free cloud-hosted PeerServer available (0.peerjs.com)
- ✅ Can self-host PeerServer for production
- ✅ Active maintenance and community
- ✅ TypeScript support
- ✅ Works in all modern browsers

#### Cons
- ❌ Requires a signaling server (PeerServer)
- ❌ Free cloud server has limitations for production use
- ❌ No built-in encryption beyond WebRTC's DTLS

#### Server Requirements
- **Development:** Free cloud PeerServer available
- **Production:** Self-hosted PeerServer recommended (Node.js)

#### Browser Compatibility
Chrome 80+, Edge 83+, Firefox 83+, Safari 15+

#### Maintenance Status
🟢 **Active** - Regular updates and releases

#### Example Usage
```javascript
import Peer from 'peerjs';

const peer = new Peer('my-peer-id');
const conn = peer.connect('other-peer-id');

conn.on('open', () => {
  conn.send('Hello!');
});

conn.on('data', (data) => {
  console.log('Received:', data);
});
```

---

### simple-peer

**Repository:** [github.com/feross/simple-peer](https://github.com/feross/simple-peer)  
**Stars:** 7.8k | **Dependents:** 36.2k | **License:** MIT

#### How It Works
simple-peer provides a Node.js-style API for WebRTC, allowing you to create peer connections with a simple, event-driven interface. It's lower-level than PeerJS - you handle signaling yourself but gain more control.

#### Pros
- ✅ Simple, Node.js-style API (streams!)
- ✅ Works with Node.js and browsers
- ✅ Supports video/voice streams and data channels
- ✅ Trickle ICE candidates for faster connections
- ✅ Used by WebTorrent (battle-tested)
- ✅ No external dependencies
- ✅ BYOS (Bring Your Own Signaling) - flexible

#### Cons
- ❌ You must implement your own signaling
- ❌ Last commit was 4 years ago (maintenance concern)
- ❌ More manual setup than PeerJS
- ❌ No built-in peer discovery

#### Server Requirements
- **Signaling:** Must implement your own (WebSocket, Firebase, etc.)
- **STUN/TURN:** Can use public servers or self-host

#### Browser Compatibility
All modern browsers with WebRTC support

#### Maintenance Status
🟡 **Low Activity** - Last commit ~4 years ago, but stable

#### Example Usage
```javascript
import Peer from 'simple-peer';

const peer = new Peer({ initiator: true, trickle: true });

peer.on('signal', (data) => {
  // Send signaling data to remote peer via your signaling channel
  signalingChannel.send(JSON.stringify(data));
});

peer.on('connect', () => {
  peer.send('Hello from simple-peer!');
});

peer.on('data', (data) => {
  console.log('Received:', data);
});

// When you receive signaling data from remote peer:
signalingChannel.on('message', (data) => {
  peer.signal(JSON.parse(data));
});
```

---

### Trystero

**Repository:** [github.com/dmotz/trystero](https://github.com/dmotz/trystero)  
**NPM:** [npmjs.com/package/trystero](https://www.npmjs.com/package/trystero)  
**Stars:** ~1k | **Weekly Downloads:** 1,039 | **License:** MIT

#### How It Works
Trystero enables **serverless** WebRTC peer connections by using existing decentralized infrastructure for signaling:
- 🐦 **Nostr** relays
- 📡 **MQTT** brokers
- 🌊 **BitTorrent** trackers
- ⚡️ **Supabase** (managed)
- 🔥 **Firebase** (managed)
- 🪐 **IPFS** pubsub

Peers exchange SDP through these networks, then communicate directly via WebRTC.

#### Pros
- ✅ **Zero server setup** for most strategies (Nostr, MQTT, BitTorrent)
- ✅ Multiple signaling strategies with same API
- ✅ End-to-end encryption for all P2P data
- ✅ SDP encryption during signaling
- ✅ Built-in room/namespace support
- ✅ Automatic serialization/chunking of data
- ✅ Progress events for large transfers
- ✅ React hooks support
- ✅ Runs in Node.js, Deno, Bun (server-side)
- ✅ Audio/video streaming support
- ✅ TypeScript support
- ✅ Active maintenance

#### Cons
- ❌ Relies on third-party infrastructure (trackers, relays)
- ❌ Connection time can vary based on strategy
- ❌ Public infrastructure availability not guaranteed
- ❌ Larger bundle size than simple-peer

#### Server Requirements
| Strategy | Setup Required | Bundle Size (Brotli) |
|----------|---------------|---------------------|
| Nostr | None | 8KB |
| MQTT | None | 75KB |
| BitTorrent | None | 5KB |
| Supabase | ~5 mins | 28KB |
| Firebase | ~5 mins | 45KB |
| IPFS | None | 119KB |

#### Browser Compatibility
All modern browsers with WebRTC support

#### Maintenance Status
🟢 **Active** - Published 4 months ago (v0.22.0)

#### Example Usage
```javascript
import { joinRoom } from 'trystero'; // Default: Nostr
// Or: import { joinRoom } from 'trystero/torrent'

const config = { appId: 'my-llm-streamer' };
const room = joinRoom(config, 'room-123');

// Listen for peers
room.onPeerJoin(peerId => console.log(`${peerId} joined`));
room.onPeerLeave(peerId => console.log(`${peerId} left`));

// Create actions for sending/receiving data
const [sendText, getText] = room.makeAction('llm-text');

// Send to all peers
sendText('Hello from LLM!');

// Receive from peers
getText((text, peerId) => {
  console.log(`Received from ${peerId}:`, text);
});

// For password-protected rooms:
const secureRoom = joinRoom(
  { appId: 'my-app', password: 'secret123' },
  'private-room'
);
```

---

### y-webrtc

**Repository:** [github.com/yjs/y-webrtc](https://github.com/yjs/y-webrtc)  
**Stars:** 574 | **License:** MIT

#### How It Works
y-webrtc is a WebRTC connector for [Yjs](#yjs) (CRDT library). It enables direct peer-to-peer synchronization of Yjs documents over WebRTC, with optional signaling through public or self-hosted servers.

#### Pros
- ✅ Built specifically for Yjs CRDT sync
- ✅ Public signaling servers available
- ✅ Password protection for rooms
- ✅ Encrypted communications
- ✅ Awareness protocol support (cursor positions, etc.)
- ✅ Works alongside other Yjs providers (WebSocket, IndexedDB)

#### Cons
- ❌ Tied to Yjs ecosystem
- ❌ Requires signaling server
- ❌ Smaller community than standalone WebRTC libs

#### Server Requirements
- Public signaling servers: `wss://signaling.yjs.dev`, `wss://y-webrtc-signaling-eu.herokuapp.com`
- Can self-host signaling server

#### Browser Compatibility
All modern browsers with WebRTC support

#### Maintenance Status
🟢 **Active** - Part of Yjs ecosystem

#### Example Usage
```javascript
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

const doc = new Y.Doc();
const provider = new WebrtcProvider('room-name', doc, {
  password: 'optional-password',
  signaling: ['wss://signaling.yjs.dev']
});

const ytext = doc.getText('shared-text');
ytext.insert(0, 'Hello from peer!');

// Changes automatically sync to all peers
```

---

## 2. CRDTs and Real-Time Sync

### Yjs

**Repository:** [github.com/yjs/yjs](https://github.com/yjs/yjs)  
**Stars:** 21.1k | **Dependents:** 44.4k | **License:** MIT

#### How It Works
Yjs is a high-performance CRDT (Conflict-free Replicated Data Type) implementation that enables real-time collaboration. It provides shared data types that automatically merge changes from multiple sources without conflicts.

**Shared Types:**
- `Y.Text` - Collaborative text editing
- `Y.Array` - Collaborative arrays
- `Y.Map` - Collaborative key-value maps
- `Y.XmlFragment` / `Y.XmlElement` - Collaborative XML

**Providers (sync mechanisms):**
- `y-websocket` - WebSocket sync
- `y-webrtc` - P2P WebRTC sync
- `y-indexeddb` - Local persistence
- `y-dat` - Dat protocol sync

#### Pros
- ✅ **Very active development** (commits within days)
- ✅ Battle-tested by major apps (AFFiNE, Evernote, JupyterLab, Linear)
- ✅ Excellent performance (handles large documents)
- ✅ Rich ecosystem of providers and bindings
- ✅ Editor bindings: ProseMirror, Quill, Monaco, CodeMirror, TipTap
- ✅ Offline-first with IndexedDB persistence
- ✅ TypeScript support
- ✅ Small core (~5KB gzipped)
- ✅ Awareness protocol for presence features

#### Cons
- ❌ Learning curve for CRDT concepts
- ❌ Document size grows with history (compaction helps)
- ❌ Requires understanding of Y.Doc lifecycle

#### Server Requirements
- **y-websocket:** Node.js WebSocket server
- **y-webrtc:** Signaling server (public ones available)
- **Offline:** y-indexeddb for local persistence

#### Browser Compatibility
All modern browsers, Node.js, React Native

#### Maintenance Status
🟢 **Very Active** - Multiple commits in the last week

#### Example Usage
```javascript
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';

// Create a shared document
const doc = new Y.Doc();

// P2P sync
const webrtcProvider = new WebrtcProvider('my-room', doc);

// Local persistence
const indexeddbProvider = new IndexeddbPersistence('my-doc', doc);

// Shared text for LLM output
const ytext = doc.getText('llm-output');

// Stream LLM text
function streamToken(token) {
  ytext.insert(ytext.length, token);
  // Automatically syncs to all connected peers!
}

// Listen for remote changes
ytext.observe(event => {
  console.log('Text changed:', ytext.toString());
});
```

---

### Automerge

**Repository:** [github.com/automerge/automerge](https://github.com/automerge/automerge)  
**Stars:** 5.9k | **License:** MIT

#### How It Works
Automerge is a CRDT library that lets you build local-first applications. It provides JSON-like data structures that can be modified concurrently and merged automatically. The core is written in Rust with JavaScript bindings via WASM.

#### Pros
- ✅ JSON-like API - easy to understand
- ✅ Rust core = excellent performance
- ✅ Local-first philosophy
- ✅ Compact binary encoding
- ✅ Built-in sync protocol
- ✅ Works in browser and Node.js
- ✅ TypeScript support
- ✅ Good documentation

#### Cons
- ❌ Larger bundle size due to WASM
- ❌ Smaller ecosystem than Yjs
- ❌ Less editor integrations
- ❌ Sync protocol requires custom transport

#### Server Requirements
- Bring your own sync transport (WebSocket, WebRTC, etc.)
- Can work fully offline

#### Browser Compatibility
All modern browsers (requires WASM support)

#### Maintenance Status
🟢 **Active** - Regular releases

#### Example Usage
```javascript
import { next as Automerge } from '@automerge/automerge';

// Create a document
let doc = Automerge.init();

// Make changes
doc = Automerge.change(doc, 'Add text', d => {
  d.text = 'Hello from LLM!';
});

// Get binary for sync
const binary = Automerge.save(doc);

// Merge changes from another peer
const otherDoc = Automerge.load(remoteBinary);
doc = Automerge.merge(doc, otherDoc);
```

---

## 3. Decentralized/P2P Frameworks

### Gun.js

**Repository:** [github.com/amark/gun](https://github.com/amark/gun)  
**Website:** [gun.eco](https://gun.eco)  
**Stars:** 18.9k | **License:** Apache-2.0 / MIT / Zlib

#### How It Works
Gun is a decentralized, real-time graph database. Data is synchronized across all connected peers automatically using a gossip protocol. It includes SEA (Security, Encryption, Authorization) for cryptographic authentication and end-to-end encryption.

#### Pros
- ✅ **~9KB gzipped** - very lightweight
- ✅ **20M+ API ops/sec** - extremely fast
- ✅ Built-in user authentication (SEA)
- ✅ End-to-end encryption
- ✅ Offline-first with localStorage/IndexedDB
- ✅ No configuration required to start
- ✅ Graph data model - flexible
- ✅ Used by Internet Archive
- ✅ Free relay peers available

#### Cons
- ❌ Graph model has learning curve
- ❌ Eventual consistency can be confusing
- ❌ Documentation can be sparse
- ❌ Memory usage can grow with large datasets
- ❌ Unique API patterns

#### Server Requirements
- **Development:** Works with public relay peers
- **Production:** Self-hosted relay recommended (Node.js)

#### Browser Compatibility
All modern browsers, Node.js, React Native

#### Maintenance Status
🟢 **Active** - Large community

#### Example Usage
```javascript
import Gun from 'gun';
import 'gun/sea'; // For encryption

const gun = Gun(['https://gun-relay.example.com/gun']);

// User authentication
const user = gun.user();
await user.create('username', 'password');
await user.auth('username', 'password');

// Store and sync data
gun.get('llm-session').get('output').put('Hello from LLM!');

// Listen for updates from any peer
gun.get('llm-session').get('output').on((data) => {
  console.log('LLM output:', data);
});

// Encrypted private data
const secret = await SEA.encrypt('private message', user._.sea);
user.get('private').put(secret);
```

---

### js-libp2p

**Repository:** [github.com/libp2p/js-libp2p](https://github.com/libp2p/js-libp2p)  
**Stars:** 2.5k | **License:** Apache-2.0 / MIT

#### How It Works
js-libp2p is the JavaScript implementation of the libp2p networking stack, used by IPFS, Filecoin, and Ethereum. It's a modular system for building P2P applications with pluggable transports, encryption, and protocols.

**Transports:**
- WebSockets
- WebRTC
- WebTransport
- TCP (Node.js)

#### Pros
- ✅ Production-proven (IPFS, Ethereum)
- ✅ Highly modular and configurable
- ✅ Multiple transport options
- ✅ Built-in encryption (Noise protocol)
- ✅ PubSub for real-time messaging
- ✅ DHT for peer discovery
- ✅ NAT traversal (hole punching)
- ✅ TypeScript support

#### Cons
- ❌ **Complex** - steep learning curve
- ❌ Large bundle size
- ❌ Requires significant configuration
- ❌ Overkill for simple use cases

#### Server Requirements
- Can work fully P2P with WebRTC
- Relay servers helpful for NAT traversal
- Bootstrap nodes for peer discovery

#### Browser Compatibility
Modern browsers with WebRTC/WebSocket support

#### Maintenance Status
🟢 **Very Active** - Core infrastructure for IPFS

#### Example Usage
```javascript
import { createLibp2p } from 'libp2p';
import { webRTC } from '@libp2p/webrtc';
import { noise } from '@chainsafe/libp2p-noise';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';

const node = await createLibp2p({
  transports: [webRTC()],
  connectionEncryption: [noise()],
  services: {
    pubsub: gossipsub()
  }
});

await node.start();

// Subscribe to a topic
node.services.pubsub.subscribe('llm-stream');

// Publish messages
node.services.pubsub.publish('llm-stream', 
  new TextEncoder().encode('Hello from LLM!')
);

// Receive messages
node.services.pubsub.addEventListener('message', (evt) => {
  console.log('Received:', new TextDecoder().decode(evt.detail.data));
});
```

---

### OrbitDB

**Repository:** [github.com/orbitdb/orbitdb](https://github.com/orbitdb/orbitdb)  
**Stars:** 8.7k | **License:** MIT

#### How It Works
OrbitDB is a serverless, distributed, peer-to-peer database built on IPFS (now Helia) and libp2p. It uses Merkle-CRDTs for conflict-free replication. Data syncs automatically via libp2p pubsub.

**Database Types:**
- `events` - Append-only log
- `documents` - Document store with indexing
- `keyvalue` - Key-value store
- `keyvalue-indexed` - Indexed key-value store

#### Pros
- ✅ Truly decentralized - no central server
- ✅ Multiple database types
- ✅ Built on IPFS/Helia - content-addressed
- ✅ Access control system
- ✅ Encryption support
- ✅ Works in browser and Node.js
- ✅ Active community

#### Cons
- ❌ Requires IPFS/Helia setup
- ❌ Larger bundle size
- ❌ Peer discovery can be slow
- ❌ More complex setup than alternatives

#### Server Requirements
- Can work fully P2P
- Bootstrap nodes recommended for discovery
- IPFS pinning services for persistence

#### Browser Compatibility
Modern browsers with libp2p support

#### Maintenance Status
🟢 **Active** - Regular updates

#### Example Usage
```javascript
import { createHelia } from 'helia';
import { createOrbitDB } from '@orbitdb/core';

const helia = await createHelia();
const orbitdb = await createOrbitDB({ ipfs: helia });

// Create an event log for LLM output
const db = await orbitdb.open('llm-stream', { type: 'events' });

// Add entries
const hash = await db.add('New LLM token');

// Listen for updates from peers
db.events.on('update', async (entry) => {
  const all = await db.all();
  console.log('All entries:', all);
});

// Query
for await (const record of db.iterator()) {
  console.log(record);
}
```

---

## 4. QR Code Libraries

### node-qrcode (QR Generation)

**Repository:** [github.com/soldair/node-qrcode](https://github.com/soldair/node-qrcode)  
**NPM:** [npmjs.com/package/qrcode](https://www.npmjs.com/package/qrcode)  
**Stars:** 8k | **Weekly Downloads:** 5.2M | **License:** MIT

#### How It Works
Generates QR codes in various formats (canvas, data URL, SVG, terminal) for both browser and Node.js.

#### Pros
- ✅ Works in browser and Node.js
- ✅ Multiple output formats (PNG, SVG, terminal)
- ✅ Customizable colors and margins
- ✅ Error correction levels
- ✅ Supports emojis and multibyte characters
- ✅ CLI tool included
- ✅ Precompiled browser bundle
- ✅ Very widely used (5.2M weekly downloads)

#### Cons
- ❌ Generation only (no scanning)
- ❌ Last update ~2 years ago

#### Browser Compatibility
IE 10+, Safari 5.1+, all evergreen browsers

#### Maintenance Status
🟡 **Stable** - Mature library, infrequent updates

#### Example Usage
```javascript
import QRCode from 'qrcode';

// Generate to canvas
const canvas = document.getElementById('qr-canvas');
QRCode.toCanvas(canvas, 'peer-id:abc123', {
  errorCorrectionLevel: 'H',
  width: 256
});

// Generate data URL for <img>
const dataUrl = await QRCode.toDataURL('peer-id:abc123');

// Generate SVG string
const svg = await QRCode.toString('peer-id:abc123', { type: 'svg' });
```

---

### jsQR (QR Scanning)

**Repository:** [github.com/cozmo/jsQR](https://github.com/cozmo/jsQR)  
**Stars:** 4k | **Used by:** 72.9k projects | **License:** Apache-2.0

#### How It Works
Pure JavaScript QR code reader that takes raw image data and locates/decodes QR codes. Works with webcam streams, uploaded images, or any image data.

#### Pros
- ✅ Pure JavaScript - no dependencies
- ✅ Works with any image source
- ✅ Returns QR position data (corners, finder patterns)
- ✅ TypeScript definitions included
- ✅ Platform agnostic (browser, Node.js)
- ✅ Widely used and battle-tested (72.9k dependents)

#### Cons
- ❌ Scanning only (no generation)
- ❌ Last update ~5 years ago
- ❌ Requires manual webcam integration

#### Browser Compatibility
All modern browsers

#### Maintenance Status
🟡 **Stable** - Mature library, infrequent updates

#### Example Usage
```javascript
import jsQR from 'jsqr';

// Scanning from webcam
const video = document.getElementById('webcam');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function scan() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  const code = jsQR(imageData.data, canvas.width, canvas.height);
  
  if (code) {
    console.log('Found QR code:', code.data);
    // code.data contains the decoded string (e.g., peer ID)
  }
  
  requestAnimationFrame(scan);
}

// Start webcam
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
  .then(stream => {
    video.srcObject = stream;
    video.play();
    scan();
  });
```

---

## 5. Comparison Matrix

### WebRTC Libraries

| Feature | PeerJS | simple-peer | Trystero | y-webrtc |
|---------|--------|-------------|----------|----------|
| **Stars** | 13.2k | 7.8k | ~1k | 574 |
| **Server Required** | Yes (PeerServer) | Custom signaling | No* | Yes (signaling) |
| **Setup Complexity** | Low | Medium | Low | Low (with Yjs) |
| **Bundle Size** | Medium | Small | 5-119KB | Small |
| **Maintenance** | 🟢 Active | 🟡 Low | 🟢 Active | 🟢 Active |
| **Best For** | Quick start | Full control | Serverless | CRDT sync |

*Trystero uses existing infrastructure (BitTorrent trackers, Nostr relays, etc.)

### Data Sync Libraries

| Feature | Yjs | Automerge | Gun.js | OrbitDB |
|---------|-----|-----------|--------|---------|
| **Stars** | 21.1k | 5.9k | 18.9k | 8.7k |
| **Type** | CRDT | CRDT | Graph DB | P2P DB |
| **Bundle Size** | ~5KB | Larger (WASM) | ~9KB | Large |
| **Offline Support** | ✅ IndexedDB | ✅ | ✅ | ✅ |
| **Encryption** | Via provider | Manual | ✅ Built-in (SEA) | ✅ |
| **Learning Curve** | Medium | Medium | Medium | High |
| **Maintenance** | 🟢 Very Active | 🟢 Active | 🟢 Active | 🟢 Active |

---

## 6. Recommendations for LLM Text Streaming

### Best Overall: **Trystero + Yjs**

For a P2P app streaming LLM text with QR code connection:

```
┌─────────────────────────────────────────────────────────┐
│                    RECOMMENDED STACK                     │
├─────────────────────────────────────────────────────────┤
│  Connection Layer:  Trystero (serverless P2P)           │
│  Data Sync Layer:   Yjs (CRDT for text streaming)       │
│  QR Generation:     node-qrcode                         │
│  QR Scanning:       jsQR                                │
│  Local Storage:     y-indexeddb                         │
└─────────────────────────────────────────────────────────┘
```

#### Why This Stack?

1. **Trystero** - Zero server setup, multiple signaling strategies, encrypted
2. **Yjs** - Perfect for real-time text sync, handles streaming tokens naturally
3. **QR codes** - Generate peer ID/room code as QR, scan to connect

### Alternative Stacks

#### Simplest Setup (if you can run a server):
- **PeerJS** - Easy API, minimal code
- **node-qrcode** + **jsQR** for connection
- Manual data handling

#### Fully Decentralized:
- **Gun.js** - Built-in everything, smallest bundle
- No external infrastructure needed

#### Maximum Control:
- **simple-peer** - Build exactly what you need
- Custom signaling via WebSocket
- Full control over connection flow

### Example Architecture

```javascript
// 1. Generate room/connection QR code
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { joinRoom, selfId } from 'trystero/nostr';
import * as Y from 'yjs';

// Host generates QR with room info
const roomId = crypto.randomUUID();
const qrData = JSON.stringify({ room: roomId, host: selfId });
await QRCode.toCanvas(canvas, qrData);

// 2. Client scans QR and joins
// ... (scan QR code with jsQR)
const { room: roomId } = JSON.parse(scannedData);

// 3. Both peers join the room
const room = joinRoom({ appId: 'llm-streamer' }, roomId);
const [sendToken, getToken] = room.makeAction('token');

// 4. Stream LLM tokens
async function* streamLLM(prompt) {
  // Your LLM API call here
  for await (const token of llmStream) {
    sendToken(token); // Broadcast to all peers
    yield token;
  }
}

// 5. Receive tokens on client
getToken((token, peerId) => {
  document.getElementById('output').textContent += token;
});
```

---

## Resources

- [WebRTC API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [CRDT Tech](https://crdt.tech/) - Learn about CRDTs
- [Local-First Software](https://www.inkandswitch.com/local-first/)
- [libp2p Documentation](https://docs.libp2p.io/)
- [Yjs Documentation](https://docs.yjs.dev/)

---

*Last updated: Research conducted for P2P LLM text streaming application*