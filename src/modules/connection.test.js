/**
 * Connection Module Tests
 */

import { jest } from '@jest/globals';

import {
  generateRoomId,
  validateRoomId,
  createConnectionManager,
  ConnectionState,
  DEFAULT_CONFIG
} from './connection.js';

describe('Connection Module', () => {
  describe('generateRoomId', () => {
    test('should generate a valid UUID v4 format', () => {
      const roomId = generateRoomId();
      expect(roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateRoomId());
      }
      expect(ids.size).toBe(100);
    });

    test('should use fallback when crypto.randomUUID unavailable', () => {
      // Save original
      const originalCrypto = global.crypto;
      
      // Mock crypto without randomUUID
      global.crypto = { getRandomValues: () => {} };
      
      const roomId = generateRoomId();
      expect(roomId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      
      // Restore
      global.crypto = originalCrypto;
    });
  });

  describe('validateRoomId', () => {
    test('should return true for valid UUID', () => {
      expect(validateRoomId('a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5')).toBe(true);
    });

    test('should return false for invalid UUID', () => {
      expect(validateRoomId('invalid-uuid')).toBe(false);
      expect(validateRoomId('')).toBe(false);
      expect(validateRoomId(null)).toBe(false);
      expect(validateRoomId(123)).toBe(false);
      expect(validateRoomId(undefined)).toBe(false);
    });

    test('should return false for UUID v1 format (not v4)', () => {
      // v1 UUID has time-based first octet, not random with 4
      expect(validateRoomId('a1b2c3d4-e5f6-1a7b-8c9d-e0f1a2b3c4d5')).toBe(false);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    test('should have required fields', () => {
      expect(DEFAULT_CONFIG.appId).toBe('p2p-llm-stream');
      expect(DEFAULT_CONFIG.relayUrls).toBeInstanceOf(Array);
      expect(DEFAULT_CONFIG.relayUrls.length).toBeGreaterThanOrEqual(2);
      expect(DEFAULT_CONFIG.relayRedundancy).toBe(2);
    });
  });

  describe('ConnectionState', () => {
    test('should have all required states', () => {
      expect(ConnectionState.DISCONNECTED).toBe('disconnected');
      expect(ConnectionState.CONNECTING).toBe('connecting');
      expect(ConnectionState.CONNECTED).toBe('connected');
      expect(ConnectionState.ERROR).toBe('error');
    });
  });

  describe('createConnectionManager', () => {
    let manager;
    let mockJoinRoom;
    let mockRoom;

    beforeEach(() => {
      // Create mock room
      mockRoom = {
        onPeerJoin: jest.fn(),
        onPeerLeave: jest.fn(),
        makeAction: jest.fn(() => [jest.fn(), jest.fn()]),
        leave: jest.fn()
      };

      // Create mock joinRoom function
      mockJoinRoom = jest.fn(() => mockRoom);

      manager = createConnectionManager();
    });

    test('should create manager with default config', () => {
      expect(manager.config.appId).toBe(DEFAULT_CONFIG.appId);
    });

    test('should create manager with custom config', () => {
      const customManager = createConnectionManager({ appId: 'custom-app' });
      expect(customManager.config.appId).toBe('custom-app');
    });

    test('should start in disconnected state', () => {
      expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
    });

    test('should have zero peers initially', () => {
      expect(manager.getPeerCount()).toBe(0);
      expect(manager.getPeers()).toEqual([]);
    });

    describe('join', () => {
      test('should reject invalid room ID', async () => {
        await expect(manager.join('invalid', mockJoinRoom))
          .rejects.toThrow('Invalid room ID format');
        expect(manager.getState()).toBe(ConnectionState.ERROR);
      });

      test('should join room with valid ID', async () => {
        const roomId = generateRoomId();
        await manager.join(roomId, mockJoinRoom);
        
        expect(mockJoinRoom).toHaveBeenCalledWith(
          { 
            appId: DEFAULT_CONFIG.appId,
            relayUrls: DEFAULT_CONFIG.relayUrls,
            relayRedundancy: DEFAULT_CONFIG.relayRedundancy
          },
          roomId
        );
      });

      test('should set up peer join/leave callbacks', async () => {
        const roomId = generateRoomId();
        await manager.join(roomId, mockJoinRoom);
        
        expect(mockRoom.onPeerJoin).toHaveBeenCalled();
        expect(mockRoom.onPeerLeave).toHaveBeenCalled();
      });

      test('should create sync action', async () => {
        const roomId = generateRoomId();
        await manager.join(roomId, mockJoinRoom);
        
        expect(mockRoom.makeAction).toHaveBeenCalledWith('sync');
      });

      test('should handle joinRoom throwing error', async () => {
        const errorJoinRoom = jest.fn(() => {
          throw new Error('Connection failed');
        });
        const roomId = generateRoomId();
        
        await expect(manager.join(roomId, errorJoinRoom))
          .rejects.toThrow('Connection failed');
        expect(manager.getState()).toBe(ConnectionState.ERROR);
      });
    });

    describe('peer management', () => {
      test('should track peer join', async () => {
        const onPeerJoin = jest.fn();
        const managerWithCallback = createConnectionManager({ onPeerJoin });
        
        const roomId = generateRoomId();
        await managerWithCallback.join(roomId, mockJoinRoom);
        
        // Simulate peer join
        const peerJoinCallback = mockRoom.onPeerJoin.mock.calls[0][0];
        peerJoinCallback('peer-123');
        
        expect(onPeerJoin).toHaveBeenCalledWith('peer-123');
        expect(managerWithCallback.getPeerCount()).toBe(1);
        expect(managerWithCallback.getPeers()).toContain('peer-123');
      });

      test('should track peer leave', async () => {
        const onPeerLeave = jest.fn();
        const managerWithCallback = createConnectionManager({ onPeerLeave });
        
        const roomId = generateRoomId();
        await managerWithCallback.join(roomId, mockJoinRoom);
        
        // Simulate peer join then leave
        const peerJoinCallback = mockRoom.onPeerJoin.mock.calls[0][0];
        const peerLeaveCallback = mockRoom.onPeerLeave.mock.calls[0][0];
        
        peerJoinCallback('peer-123');
        peerLeaveCallback('peer-123');
        
        expect(onPeerLeave).toHaveBeenCalledWith('peer-123');
        expect(managerWithCallback.getPeerCount()).toBe(0);
      });
    });

    describe('leave', () => {
      test('should clean up on leave', async () => {
        const roomId = generateRoomId();
        await manager.join(roomId, mockJoinRoom);
        
        manager.leave();
        
        expect(mockRoom.leave).toHaveBeenCalled();
        expect(manager.getState()).toBe(ConnectionState.DISCONNECTED);
        expect(manager.getPeerCount()).toBe(0);
      });

      test('should handle leave when not connected', () => {
        expect(() => manager.leave()).not.toThrow();
      });
    });

    describe('broadcast', () => {
      test('should broadcast data to peers', async () => {
        const sendMock = jest.fn();
        mockRoom.makeAction = jest.fn(() => [sendMock, jest.fn()]);
        
        const roomId = generateRoomId();
        await manager.join(roomId, mockJoinRoom);
        
        manager.broadcast({ test: 'data' });
        
        expect(sendMock).toHaveBeenCalledWith({ test: 'data' });
      });

      test('should not throw when broadcast before join', () => {
        expect(() => manager.broadcast({ test: 'data' })).not.toThrow();
      });
    });

    describe('state change callbacks', () => {
      test('should call onStateChange when state changes', async () => {
        const onStateChange = jest.fn();
        const managerWithCallback = createConnectionManager({ onStateChange });
        
        const roomId = generateRoomId();
        await managerWithCallback.join(roomId, mockJoinRoom);
        
        expect(onStateChange).toHaveBeenCalledWith(ConnectionState.CONNECTING);
      });
    });

    describe('data reception', () => {
      test('should call onData when receiving data', async () => {
        const onData = jest.fn();
        const managerWithCallback = createConnectionManager({ onData });
        
        const getData = jest.fn();
        mockRoom.makeAction = jest.fn(() => [jest.fn(), getData]);
        
        const roomId = generateRoomId();
        await managerWithCallback.join(roomId, mockJoinRoom);
        
        // Get the callback passed to getData
        const dataCallback = getData.mock.calls[0][0];
        dataCallback({ test: 'received' }, 'peer-123');
        
        expect(onData).toHaveBeenCalledWith({ test: 'received' }, 'peer-123');
      });
    });
  });
});
