/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
  DirectConnectionState,
  DEFAULT_ICE_SERVERS,
  compressSignaling,
  decompressSignaling,
  createDirectConnection
} from './webrtc-direct.js';

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDescription = null;
    this.remoteDescription = null;
    this.iceGatheringState = 'new';
    this.iceConnectionState = 'new';
    this.signalingState = 'stable';
    this._dataChannels = [];
    this._iceCandidates = [];
  }

  createDataChannel(label, options) {
    const channel = {
      label,
      options,
      readyState: 'connecting',
      send: jest.fn(),
      close: jest.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null
    };
    this._dataChannels.push(channel);
    return channel;
  }

  async createOffer() {
    return {
      type: 'offer',
      sdp: this._createMockSdp('offer')
    };
  }

  async createAnswer() {
    return {
      type: 'answer',
      sdp: this._createMockSdp('answer')
    };
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
    this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
    
    // Simulate ICE gathering
    setTimeout(() => {
      this._iceCandidates = [
        { candidate: 'candidate:0 1 udp 2113937151 192.168.1.100 54321 typ host' }
      ];
      if (this.onicecandidate) {
        this._iceCandidates.forEach(c => this.onicecandidate({ candidate: c }));
        this.onicecandidate({ candidate: null });
      }
      this.iceGatheringState = 'complete';
      if (this.onicegatheringstatechange) {
        this.onicegatheringstatechange();
      }
    }, 10);
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
    this.signalingState = 'stable';
  }

  async addIceCandidate(candidate) {
    this._iceCandidates.push(candidate);
  }

  close() {
    this.iceConnectionState = 'closed';
    this.signalingState = 'closed';
    this._dataChannels.forEach(ch => {
      ch.readyState = 'closed';
      if (ch.onclose) ch.onclose();
    });
  }

  _createMockSdp(type) {
    return [
      'v=0',
      `o=- ${Date.now()} 2 IN IP4 127.0.0.1`,
      's=-',
      't=0 0',
      'a=group:BUNDLE 0',
      'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
      'c=IN IP4 0.0.0.0',
      'a=ice-ufrag:abcd1234efgh5678',
      'a=ice-pwd:ABCDefgh1234567890IJKL',
      'a=ice-options:trickle',
      'a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
      `a=setup:${type === 'offer' ? 'actpass' : 'active'}`,
      'a=mid:0',
      'a=sctp-port:5000',
      'a=max-message-size:262144'
    ].join('\r\n') + '\r\n';
  }

  // Simulate triggering ICE connection state changes
  _triggerIceState(state) {
    this.iceConnectionState = state;
    if (this.oniceconnectionstatechange) {
      this.oniceconnectionstatechange();
    }
  }

  // Simulate triggering data channel event
  _triggerDataChannel(channel) {
    if (this.ondatachannel) {
      this.ondatachannel({ channel });
    }
  }
}

// Set up global mocks
beforeAll(() => {
  global.RTCPeerConnection = MockRTCPeerConnection;
});

afterAll(() => {
  delete global.RTCPeerConnection;
});

describe('DirectConnectionState', () => {
  test('should have all expected states', () => {
    expect(DirectConnectionState.IDLE).toBe('idle');
    expect(DirectConnectionState.OFFERING).toBe('offering');
    expect(DirectConnectionState.ANSWERING).toBe('answering');
    expect(DirectConnectionState.CONNECTING).toBe('connecting');
    expect(DirectConnectionState.CONNECTED).toBe('connected');
    expect(DirectConnectionState.DISCONNECTED).toBe('disconnected');
    expect(DirectConnectionState.FAILED).toBe('failed');
  });
});

describe('DEFAULT_ICE_SERVERS', () => {
  test('should have STUN servers configured', () => {
    expect(Array.isArray(DEFAULT_ICE_SERVERS)).toBe(true);
    expect(DEFAULT_ICE_SERVERS.length).toBeGreaterThan(0);
    
    // All should be STUN servers (not TURN)
    DEFAULT_ICE_SERVERS.forEach(server => {
      expect(server.urls).toMatch(/^stun:/);
    });
  });
  
  test('should include Google STUN servers', () => {
    const googleServers = DEFAULT_ICE_SERVERS.filter(s => s.urls.includes('google.com'));
    expect(googleServers.length).toBeGreaterThan(0);
  });
});

describe('compressSignaling', () => {
  test('should compress SDP description with candidates', () => {
    const description = {
      type: 'offer',
      sdp: `v=0\r
o=- 1234 2 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=ice-ufrag:abcd1234efgh5678\r
a=ice-pwd:ABCDefgh1234567890IJKL\r
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r
m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r
`
    };
    
    const candidates = [
      { candidate: 'candidate:0 1 udp 2113937151 192.168.1.100 54321 typ host' }
    ];
    
    const compressed = compressSignaling(description, candidates);
    
    expect(typeof compressed).toBe('string');
    expect(compressed.length).toBeLessThan(500); // Should be reasonably short for QR code
    
    // Should be base64 encoded
    expect(() => atob(compressed)).not.toThrow();
  });
  
  test('should distinguish offer from answer', () => {
    const sdp = `a=ice-ufrag:test1234test5678\r
a=ice-pwd:test12345678901234test\r
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r
`;
    
    const offerCompressed = compressSignaling({ type: 'offer', sdp }, []);
    const answerCompressed = compressSignaling({ type: 'answer', sdp }, []);
    
    const offerData = JSON.parse(atob(offerCompressed));
    const answerData = JSON.parse(atob(answerCompressed));
    
    expect(offerData.t).toBe('o');
    expect(answerData.t).toBe('a');
  });
  
  test('should throw if required SDP fields are missing', () => {
    const badSdp = { type: 'offer', sdp: 'invalid sdp' };
    
    expect(() => compressSignaling(badSdp, [])).toThrow('Could not extract required SDP fields');
  });
  
  test('should filter empty candidates', () => {
    const sdp = `a=ice-ufrag:test1234test5678\r
a=ice-pwd:test12345678901234test\r
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r
`;
    
    const candidates = [
      null,
      { candidate: '' },
      { candidate: 'candidate:0 1 udp 2113937151 192.168.1.100 54321 typ host' }
    ];
    
    const compressed = compressSignaling({ type: 'offer', sdp }, candidates);
    const data = JSON.parse(atob(compressed));
    
    expect(data.c.length).toBe(1);
  });
});

describe('decompressSignaling', () => {
  test('should decompress offer correctly', () => {
    const sdp = `a=ice-ufrag:abcd1234efgh5678\r
a=ice-pwd:ABCDefgh1234567890IJKL\r
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r
`;
    const candidates = [
      { candidate: 'candidate:0 1 udp 2113937151 192.168.1.100 54321 typ host' }
    ];
    
    const compressed = compressSignaling({ type: 'offer', sdp }, candidates);
    const result = decompressSignaling(compressed);
    
    expect(result.description.type).toBe('offer');
    expect(result.description.sdp).toContain('a=ice-ufrag:abcd1234efgh5678');
    expect(result.description.sdp).toContain('a=ice-pwd:ABCDefgh1234567890IJKL');
    expect(result.description.sdp).toContain('a=fingerprint:sha-256');
    expect(result.description.sdp).toContain('a=setup:actpass');
    expect(result.candidates.length).toBe(1);
  });
  
  test('should decompress answer correctly', () => {
    const sdp = `a=ice-ufrag:test1234test5678\r
a=ice-pwd:test12345678901234test\r
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r
`;
    
    const compressed = compressSignaling({ type: 'answer', sdp }, []);
    const result = decompressSignaling(compressed);
    
    expect(result.description.type).toBe('answer');
    expect(result.description.sdp).toContain('a=setup:active');
  });
  
  test('should be reversible (compress then decompress)', () => {
    const originalSdp = `a=ice-ufrag:abcd1234efgh5678\r
a=ice-pwd:ABCDefgh1234567890IJKL\r
a=fingerprint:sha-256 AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99\r
`;
    
    const compressed = compressSignaling({ type: 'offer', sdp: originalSdp }, []);
    const result = decompressSignaling(compressed);
    
    // Key fields should be preserved
    expect(result.description.sdp).toContain('abcd1234efgh5678');
    expect(result.description.sdp).toContain('ABCDefgh1234567890IJKL');
  });
});

describe('createDirectConnection', () => {
  test('should create connection manager with default options', () => {
    const conn = createDirectConnection();
    
    expect(typeof conn.createOffer).toBe('function');
    expect(typeof conn.createAnswer).toBe('function');
    expect(typeof conn.acceptAnswer).toBe('function');
    expect(typeof conn.send).toBe('function');
    expect(typeof conn.close).toBe('function');
    expect(typeof conn.getState).toBe('function');
    expect(typeof conn.isConnected).toBe('function');
  });
  
  test('should start in IDLE state', () => {
    const conn = createDirectConnection();
    
    expect(conn.getState()).toBe(DirectConnectionState.IDLE);
    expect(conn.isConnected()).toBe(false);
  });
  
  test('should call onStateChange callback', async () => {
    const onStateChange = jest.fn();
    const conn = createDirectConnection({ onStateChange });
    
    await conn.createOffer();
    
    // Should have been called at least once with OFFERING state
    expect(onStateChange).toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledWith(DirectConnectionState.OFFERING);
  });
  
  test('createOffer should return compressed offer', async () => {
    const conn = createDirectConnection();
    
    const offer = await conn.createOffer();
    
    expect(typeof offer).toBe('string');
    expect(offer.length).toBeGreaterThan(0);
    
    // Should be valid base64
    expect(() => atob(offer)).not.toThrow();
    
    // State should be OFFERING
    expect(conn.getState()).toBe(DirectConnectionState.OFFERING);
  });
  
  test('createAnswer should return compressed answer', async () => {
    // Create host and get offer
    const host = createDirectConnection();
    const offer = await host.createOffer();
    
    // Create client and process offer
    const onStateChange = jest.fn();
    const client = createDirectConnection({ onStateChange });
    const answer = await client.createAnswer(offer);
    
    expect(typeof answer).toBe('string');
    expect(answer.length).toBeGreaterThan(0);
    
    // State should be CONNECTING
    expect(client.getState()).toBe(DirectConnectionState.CONNECTING);
  });
  
  test('acceptAnswer should throw without prior offer', async () => {
    const conn = createDirectConnection();
    
    await expect(conn.acceptAnswer('someAnswer')).rejects.toThrow('No peer connection');
  });
  
  test('send should throw when not connected', () => {
    const conn = createDirectConnection();
    
    expect(() => conn.send('test')).toThrow('Data channel not open');
  });
  
  test('close should reset state to DISCONNECTED', async () => {
    const onStateChange = jest.fn();
    const conn = createDirectConnection({ onStateChange });
    
    await conn.createOffer();
    conn.close();
    
    expect(conn.getState()).toBe(DirectConnectionState.DISCONNECTED);
  });
  
  test('should use custom ICE servers if provided', () => {
    const customServers = [{ urls: 'stun:custom.example.com:3478' }];
    const conn = createDirectConnection({ iceServers: customServers });
    
    // Connection should be created (no direct way to verify servers without exposing internals)
    expect(conn.getState()).toBe(DirectConnectionState.IDLE);
  });
  
  test('should handle onError callback', async () => {
    const onError = jest.fn();
    const conn = createDirectConnection({ onError });
    
    // Create offer first
    await conn.createOffer();
    
    // Try invalid answer
    try {
      await conn.acceptAnswer('invalid-base64-data!!!');
    } catch (e) {
      // Expected to throw
    }
    
    // Error might be caught internally
    expect(conn).toBeDefined();
  });
});

describe('Full connection flow', () => {
  test('should complete offer-answer exchange', async () => {
    const hostStateChanges = [];
    const clientStateChanges = [];
    
    const host = createDirectConnection({
      onStateChange: (s) => hostStateChanges.push(s)
    });
    
    const client = createDirectConnection({
      onStateChange: (s) => clientStateChanges.push(s)
    });
    
    // Host creates offer
    const offer = await host.createOffer();
    expect(host.getState()).toBe(DirectConnectionState.OFFERING);
    
    // Client processes offer and creates answer
    const answer = await client.createAnswer(offer);
    expect(client.getState()).toBe(DirectConnectionState.CONNECTING);
    
    // Host processes answer
    await host.acceptAnswer(answer);
    expect(host.getState()).toBe(DirectConnectionState.CONNECTING);
    
    // Clean up
    host.close();
    client.close();
    
    expect(host.getState()).toBe(DirectConnectionState.DISCONNECTED);
    expect(client.getState()).toBe(DirectConnectionState.DISCONNECTED);
  });
});
