/**
 * Direct WebRTC Connection Module
 * Establishes P2P connections using QR code-based signaling (no relay servers)
 * 
 * Flow:
 * 1. Host creates offer, displays as QR code
 * 2. Client scans offer QR, creates answer, displays as QR code
 * 3. Host scans answer QR, connection established
 * 
 * @module webrtc-direct
 */

/**
 * Connection states
 */
export const DirectConnectionState = {
  IDLE: 'idle',
  OFFERING: 'offering',        // Host has created offer, waiting for answer
  ANSWERING: 'answering',      // Client has received offer, creating answer
  CONNECTING: 'connecting',    // Both sides have exchanged, ICE in progress
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  FAILED: 'failed'
};

/**
 * Default ICE servers (public STUN servers for NAT traversal)
 * STUN is free and helps with most NAT situations
 */
export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.stunprotocol.org:3478' }
];

/**
 * Compresses SDP offer/answer for QR code transmission
 * Based on "Minimum Viable SDP" technique
 * @param {RTCSessionDescription} description - SDP description
 * @param {RTCIceCandidate[]} candidates - ICE candidates
 * @returns {string} Compressed signaling data
 */
export function compressSignaling(description, candidates) {
  const sdp = description.sdp;
  const type = description.type; // 'offer' or 'answer'
  
  // Extract essential SDP fields
  const iceUfragMatch = sdp.match(/a=ice-ufrag:(.+)/);
  const icePwdMatch = sdp.match(/a=ice-pwd:(.+)/);
  const fingerprintMatch = sdp.match(/a=fingerprint:sha-256 (.+)/);
  
  if (!iceUfragMatch || !icePwdMatch || !fingerprintMatch) {
    throw new Error('Could not extract required SDP fields');
  }
  
  const iceUfrag = iceUfragMatch[1].trim();
  const icePwd = icePwdMatch[1].trim();
  const fingerprint = fingerprintMatch[1].trim();
  
  // Compress fingerprint (convert hex to base64)
  const fingerprintBytes = fingerprint.split(':').map(h => parseInt(h, 16));
  const fingerprintB64 = btoa(String.fromCharCode(...fingerprintBytes));
  
  // Compress candidates (IP:port pairs)
  const compressedCandidates = candidates
    .filter(c => c && c.candidate)
    .map(c => {
      const match = c.candidate.match(/(\d+\.\d+\.\d+\.\d+) (\d+) typ (\w+)/);
      if (match) {
        const [, ip, port, typ] = match;
        // Encode IP and port compactly
        const ipParts = ip.split('.').map(Number);
        const portNum = parseInt(port);
        // Base64 encode: 4 bytes IP + 2 bytes port
        const bytes = [...ipParts, (portNum >> 8) & 0xff, portNum & 0xff];
        return btoa(String.fromCharCode(...bytes)) + ':' + typ[0]; // h=host, s=srflx, r=relay
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 5); // Limit candidates to keep QR small
  
  // Create compact JSON
  const data = {
    t: type === 'offer' ? 'o' : 'a',
    u: iceUfrag,
    p: icePwd,
    f: fingerprintB64,
    c: compressedCandidates
  };
  
  return btoa(JSON.stringify(data));
}

/**
 * Decompresses signaling data back to SDP format
 * @param {string} compressed - Compressed signaling data
 * @returns {Object} { description: RTCSessionDescriptionInit, candidates: RTCIceCandidateInit[] }
 */
export function decompressSignaling(compressed) {
  const data = JSON.parse(atob(compressed));
  
  const type = data.t === 'o' ? 'offer' : 'answer';
  const iceUfrag = data.u;
  const icePwd = data.p;
  
  // Decompress fingerprint
  const fingerprintBytes = atob(data.f).split('').map(c => c.charCodeAt(0));
  const fingerprint = fingerprintBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
  
  // Decompress candidates
  const candidates = (data.c || []).map((c, index) => {
    const [b64, typChar] = c.split(':');
    const bytes = atob(b64).split('').map(ch => ch.charCodeAt(0));
    const ip = bytes.slice(0, 4).join('.');
    const port = (bytes[4] << 8) | bytes[5];
    const typ = { h: 'host', s: 'srflx', r: 'relay' }[typChar] || 'host';
    
    return {
      candidate: `candidate:${index} 1 udp ${2113937151 - index * 100} ${ip} ${port} typ ${typ}`,
      sdpMid: '0',
      sdpMLineIndex: 0
    };
  });
  
  // Reconstruct minimal SDP for data channel
  const sdp = [
    'v=0',
    'o=- ' + Date.now() + ' 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:' + iceUfrag,
    'a=ice-pwd:' + icePwd,
    'a=ice-options:trickle',
    'a=fingerprint:sha-256 ' + fingerprint,
    'a=setup:' + (type === 'offer' ? 'actpass' : 'active'),
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144'
  ].join('\r\n') + '\r\n';
  
  return {
    description: { type, sdp },
    candidates
  };
}

/**
 * Creates a direct WebRTC connection manager
 * @param {Object} options - Configuration options
 * @returns {Object} Connection manager
 */
export function createDirectConnection(options = {}) {
  let state = DirectConnectionState.IDLE;
  let pc = null;
  let dataChannel = null;
  let localCandidates = [];
  let iceCandidateTimeout = null;
  
  const iceServers = options.iceServers || DEFAULT_ICE_SERVERS;
  
  const callbacks = {
    onStateChange: options.onStateChange || (() => {}),
    onMessage: options.onMessage || (() => {}),
    onError: options.onError || (() => {})
  };
  
  function setState(newState) {
    if (state !== newState) {
      state = newState;
      callbacks.onStateChange(newState);
    }
  }
  
  function createPeerConnection() {
    pc = new RTCPeerConnection({ iceServers });
    localCandidates = [];
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        localCandidates.push(event.candidate);
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        // ICE is connected, but wait for data channel if it exists
        if (dataChannel && dataChannel.readyState === 'open') {
          setState(DirectConnectionState.CONNECTED);
        }
      } else if (pc.iceConnectionState === 'failed') {
        setState(DirectConnectionState.FAILED);
        callbacks.onError(new Error('ICE connection failed'));
      } else if (pc.iceConnectionState === 'disconnected') {
        setState(DirectConnectionState.DISCONNECTED);
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        // Check if data channel is ready
        if (dataChannel && dataChannel.readyState === 'open') {
          setState(DirectConnectionState.CONNECTED);
        }
      } else if (pc.connectionState === 'failed') {
        setState(DirectConnectionState.FAILED);
        callbacks.onError(new Error('Connection failed'));
      }
    };
    
    pc.ondatachannel = (event) => {
      console.log('Received data channel:', event.channel.label);
      setupDataChannel(event.channel);
    };
    
    return pc;
  }
  
  function setupDataChannel(channel) {
    dataChannel = channel;
    
    // Check if channel is already open (can happen in some browsers)
    if (channel.readyState === 'open') {
      console.log('Data channel already open');
      setState(DirectConnectionState.CONNECTED);
    }
    
    dataChannel.onopen = () => {
      console.log('Data channel open event fired, readyState:', channel.readyState);
      setState(DirectConnectionState.CONNECTED);
    };
    
    dataChannel.onclose = () => {
      console.log('Data channel closed');
      setState(DirectConnectionState.DISCONNECTED);
    };
    
    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        callbacks.onMessage(message);
      } catch (e) {
        callbacks.onMessage(event.data);
      }
    };
    
    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      callbacks.onError(error);
    };
  }
  
  /**
   * Creates an offer (Host side)
   * @returns {Promise<string>} Compressed offer for QR code
   */
  async function createOffer() {
    createPeerConnection();
    
    // Create data channel
    const channel = pc.createDataChannel('p2p-stream', {
      ordered: true
    });
    setupDataChannel(channel);
    
    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    setState(DirectConnectionState.OFFERING);
    
    // Wait for ICE gathering to complete (or timeout after 3 seconds)
    return new Promise((resolve) => {
      const checkCandidates = () => {
        if (pc.iceGatheringState === 'complete' || localCandidates.length >= 3) {
          clearTimeout(iceCandidateTimeout);
          const compressed = compressSignaling(pc.localDescription, localCandidates);
          resolve(compressed);
        }
      };
      
      pc.onicegatheringstatechange = checkCandidates;
      
      // Timeout fallback
      iceCandidateTimeout = setTimeout(() => {
        const compressed = compressSignaling(pc.localDescription, localCandidates);
        resolve(compressed);
      }, 3000);
      
      // Check immediately in case already complete
      checkCandidates();
    });
  }
  
  /**
   * Processes an offer and creates an answer (Client side)
   * @param {string} compressedOffer - Compressed offer from QR code
   * @returns {Promise<string>} Compressed answer for QR code
   */
  async function createAnswer(compressedOffer) {
    createPeerConnection();
    
    setState(DirectConnectionState.ANSWERING);
    
    // Decompress and set remote description
    const { description, candidates } = decompressSignaling(compressedOffer);
    await pc.setRemoteDescription(description);
    
    // Add remote candidates
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn('Failed to add candidate:', e);
      }
    }
    
    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    setState(DirectConnectionState.CONNECTING);
    
    // Wait for ICE gathering
    return new Promise((resolve) => {
      const checkCandidates = () => {
        if (pc.iceGatheringState === 'complete' || localCandidates.length >= 3) {
          clearTimeout(iceCandidateTimeout);
          const compressed = compressSignaling(pc.localDescription, localCandidates);
          resolve(compressed);
        }
      };
      
      pc.onicegatheringstatechange = checkCandidates;
      
      iceCandidateTimeout = setTimeout(() => {
        const compressed = compressSignaling(pc.localDescription, localCandidates);
        resolve(compressed);
      }, 3000);
      
      checkCandidates();
    });
  }
  
  /**
   * Processes an answer (Host side)
   * @param {string} compressedAnswer - Compressed answer from QR code
   */
  async function acceptAnswer(compressedAnswer) {
    if (!pc) {
      throw new Error('No peer connection - call createOffer first');
    }
    
    const { description, candidates } = decompressSignaling(compressedAnswer);
    await pc.setRemoteDescription(description);
    
    // Add remote candidates
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn('Failed to add candidate:', e);
      }
    }
    
    setState(DirectConnectionState.CONNECTING);
  }
  
  /**
   * Sends a message to the peer
   * @param {any} message - Message to send (will be JSON stringified if object)
   */
  function send(message) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }
    
    const data = typeof message === 'object' ? JSON.stringify(message) : message;
    dataChannel.send(data);
  }
  
  /**
   * Closes the connection
   */
  function close() {
    if (iceCandidateTimeout) {
      clearTimeout(iceCandidateTimeout);
    }
    
    if (dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }
    
    if (pc) {
      pc.close();
      pc = null;
    }
    
    localCandidates = [];
    setState(DirectConnectionState.DISCONNECTED);
  }
  
  return {
    createOffer,
    createAnswer,
    acceptAnswer,
    send,
    close,
    getState: () => state,
    isConnected: () => state === DirectConnectionState.CONNECTED
  };
}
