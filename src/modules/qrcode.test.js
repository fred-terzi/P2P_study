/**
 * QR Code Module Tests
 */

import { jest } from '@jest/globals';

import {
  createSessionData,
  encodeSessionData,
  decodeSessionData,
  validateSessionData,
  isSessionExpired,
  createQRManager,
  PROTOCOL_VERSION,
  QR_CONFIG
} from './qrcode.js';

describe('QR Code Module', () => {
  describe('PROTOCOL_VERSION', () => {
    test('should be defined', () => {
      expect(PROTOCOL_VERSION).toBe('1.0');
    });
  });

  describe('QR_CONFIG', () => {
    test('should have default configuration', () => {
      expect(QR_CONFIG.errorCorrectionLevel).toBe('M');
      expect(QR_CONFIG.width).toBe(256);
      expect(QR_CONFIG.margin).toBe(2);
      expect(QR_CONFIG.color.dark).toBe('#000000');
      expect(QR_CONFIG.color.light).toBe('#ffffff');
    });
  });

  describe('createSessionData', () => {
    test('should create session data with room ID', () => {
      const data = createSessionData('room-123');
      
      expect(data.roomId).toBe('room-123');
      expect(data.version).toBe(PROTOCOL_VERSION);
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('number');
    });

    test('should include encryption key when provided', () => {
      const data = createSessionData('room-123', { encryptionKey: 'secret' });
      expect(data.encryptionKey).toBe('secret');
    });

    test('should set null encryption key when not provided', () => {
      const data = createSessionData('room-123');
      expect(data.encryptionKey).toBeNull();
    });

    test('should throw on missing room ID', () => {
      expect(() => createSessionData()).toThrow('Room ID is required');
      expect(() => createSessionData('')).toThrow('Room ID is required');
      expect(() => createSessionData(null)).toThrow('Room ID is required');
    });

    test('should throw on non-string room ID', () => {
      expect(() => createSessionData(123)).toThrow('Room ID is required');
    });
  });

  describe('encodeSessionData / decodeSessionData', () => {
    test('should encode and decode correctly', () => {
      const original = createSessionData('room-123', { encryptionKey: 'key' });
      const encoded = encodeSessionData(original);
      const decoded = decodeSessionData(encoded);
      
      expect(decoded.roomId).toBe(original.roomId);
      expect(decoded.encryptionKey).toBe(original.encryptionKey);
      expect(decoded.version).toBe(original.version);
    });

    test('should produce string output', () => {
      const data = createSessionData('room-123');
      const encoded = encodeSessionData(data);
      
      expect(typeof encoded).toBe('string');
    });

    test('should throw on invalid session data for encode', () => {
      expect(() => encodeSessionData(null)).toThrow('Invalid session data');
      expect(() => encodeSessionData({})).toThrow('Invalid session data');
    });

    test('should throw on invalid encoded data for decode', () => {
      expect(() => decodeSessionData(null)).toThrow('Invalid encoded data');
      expect(() => decodeSessionData('')).toThrow('Invalid encoded data');
      expect(() => decodeSessionData(123)).toThrow('Invalid encoded data');
    });

    test('should throw on malformed base64', () => {
      expect(() => decodeSessionData('not-valid-base64!!!')).toThrow();
    });

    test('should throw on missing roomId in decoded data', () => {
      const encoded = btoa(JSON.stringify({ version: '1.0' }));
      expect(() => decodeSessionData(encoded)).toThrow('Missing roomId');
    });
  });

  describe('validateSessionData', () => {
    test('should validate correct session data', () => {
      const data = createSessionData('room-123');
      const result = validateSessionData(data);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject null session data', () => {
      const result = validateSessionData(null);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Session data is required');
    });

    test('should reject missing roomId', () => {
      const result = validateSessionData({ version: '1.0', timestamp: Date.now() });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('roomId'))).toBe(true);
    });

    test('should reject missing version', () => {
      const result = validateSessionData({ roomId: 'test', timestamp: Date.now() });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    });

    test('should reject incompatible version', () => {
      const result = validateSessionData({
        roomId: 'test',
        version: '2.0',
        timestamp: Date.now()
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Incompatible'))).toBe(true);
    });

    test('should reject missing timestamp', () => {
      const result = validateSessionData({ roomId: 'test', version: '1.0' });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('timestamp'))).toBe(true);
    });
  });

  describe('isSessionExpired', () => {
    test('should return false for fresh session', () => {
      const data = createSessionData('room-123');
      expect(isSessionExpired(data)).toBe(false);
    });

    test('should return true for expired session', () => {
      const data = {
        roomId: 'test',
        timestamp: Date.now() - 7200000 // 2 hours ago
      };
      expect(isSessionExpired(data)).toBe(true);
    });

    test('should respect custom max age', () => {
      const data = {
        roomId: 'test',
        timestamp: Date.now() - 60000 // 1 minute ago
      };
      
      expect(isSessionExpired(data, 30000)).toBe(true); // 30 second max
      expect(isSessionExpired(data, 120000)).toBe(false); // 2 minute max
    });

    test('should return true for null/undefined data', () => {
      expect(isSessionExpired(null)).toBe(true);
      expect(isSessionExpired(undefined)).toBe(true);
      expect(isSessionExpired({})).toBe(true);
    });
  });

  describe('createQRManager', () => {
    let qrManager;

    beforeEach(() => {
      qrManager = createQRManager();
    });

    describe('generate', () => {
      test('should generate data URL', async () => {
        const dataUrl = await qrManager.generate('room-123');
        
        expect(dataUrl).toContain('data:image/png;base64,');
      });

      test('should store last generated data', async () => {
        await qrManager.generate('room-123');
        
        const lastGenerated = qrManager.getLastGenerated();
        expect(lastGenerated.roomId).toBe('room-123');
      });

      test('should include encryption key option', async () => {
        await qrManager.generate('room-123', { encryptionKey: 'secret' });
        
        const lastGenerated = qrManager.getLastGenerated();
        expect(lastGenerated.encryptionKey).toBe('secret');
      });
    });

    describe('generateToCanvas', () => {
      test('should return session data', async () => {
        const mockCanvas = {};
        const sessionData = await qrManager.generateToCanvas(mockCanvas, 'room-123');
        
        expect(sessionData.roomId).toBe('room-123');
      });

      test('should use real QR library when provided', async () => {
        const mockToCanvas = jest.fn();
        const mockLib = { toCanvas: mockToCanvas };
        const manager = createQRManager(mockLib);
        
        const mockCanvas = {};
        await manager.generateToCanvas(mockCanvas, 'room-123');
        
        expect(mockToCanvas).toHaveBeenCalled();
      });
    });

    describe('parse', () => {
      test('should parse valid QR content', () => {
        const data = createSessionData('room-123');
        const encoded = encodeSessionData(data);
        
        const parsed = qrManager.parse(encoded);
        
        expect(parsed.roomId).toBe('room-123');
      });

      test('should throw on invalid QR content', () => {
        expect(() => qrManager.parse('invalid')).toThrow();
      });

      test('should throw on incompatible version', () => {
        const data = {
          roomId: 'test',
          version: '99.0',
          timestamp: Date.now()
        };
        const encoded = btoa(JSON.stringify(data));
        
        expect(() => qrManager.parse(encoded)).toThrow('Invalid QR code');
      });
    });

    describe('createShareUrl', () => {
      test('should create URL with session parameter', () => {
        const url = qrManager.createShareUrl('https://example.com', 'room-123');
        
        expect(url).toContain('https://example.com');
        expect(url).toContain('session=');
      });

      test('should include room ID in encoded session', () => {
        const url = qrManager.createShareUrl('https://example.com', 'room-123');
        const urlObj = new URL(url);
        const encoded = urlObj.searchParams.get('session');
        const decoded = decodeSessionData(encoded);
        
        expect(decoded.roomId).toBe('room-123');
      });
    });

    describe('parseFromUrl', () => {
      test('should parse session from URL', () => {
        const shareUrl = qrManager.createShareUrl('https://example.com', 'room-123');
        const sessionData = qrManager.parseFromUrl(shareUrl);
        
        expect(sessionData.roomId).toBe('room-123');
      });

      test('should return null for URL without session', () => {
        const result = qrManager.parseFromUrl('https://example.com');
        expect(result).toBeNull();
      });

      test('should return null for invalid URL', () => {
        const result = qrManager.parseFromUrl('not-a-url');
        expect(result).toBeNull();
      });
    });

    describe('with real QR library mock', () => {
      test('should use library toDataURL when available', async () => {
        const mockToDataURL = jest.fn().mockResolvedValue('data:image/png;base64,real');
        const mockLib = { toDataURL: mockToDataURL };
        const manager = createQRManager(mockLib);
        
        const result = await manager.generate('room-123');
        
        expect(mockToDataURL).toHaveBeenCalled();
        expect(result).toBe('data:image/png;base64,real');
      });
    });
  });
});
