/**
 * Scanner Module Tests
 */

import { jest } from '@jest/globals';

import {
  createQRScanner,
  ScannerState
} from './scanner.js';

describe('Scanner Module', () => {
  describe('ScannerState', () => {
    test('should have all required states', () => {
      expect(ScannerState.IDLE).toBe('idle');
      expect(ScannerState.STARTING).toBe('starting');
      expect(ScannerState.SCANNING).toBe('scanning');
      expect(ScannerState.STOPPED).toBe('stopped');
      expect(ScannerState.ERROR).toBe('error');
    });
  });

  describe('createQRScanner', () => {
    let scanner;
    let mockJsQR;
    let mockOnScan;
    let mockOnError;
    let mockOnStateChange;
    let mockVideoElement;
    let mockMediaStream;
    let mockNavigator;
    let mockDocument;
    let mockCanvasContext;

    beforeEach(() => {
      jest.clearAllMocks();
      
      mockJsQR = jest.fn();
      mockOnScan = jest.fn();
      mockOnError = jest.fn();
      mockOnStateChange = jest.fn();

      // Mock video element
      mockVideoElement = {
        srcObject: null,
        setAttribute: jest.fn(),
        play: jest.fn().mockResolvedValue(undefined),
        onloadedmetadata: null,
        onerror: null,
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480
      };

      // Mock media stream
      mockMediaStream = {
        getTracks: jest.fn(() => [{
          stop: jest.fn()
        }]),
        getVideoTracks: jest.fn(() => [{
          stop: jest.fn(),
          getSettings: jest.fn(() => ({ facingMode: 'environment' }))
        }])
      };

      // Mock navigator
      mockNavigator = {
        mediaDevices: {
          getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
          enumerateDevices: jest.fn().mockResolvedValue([
            { kind: 'videoinput', deviceId: 'camera1', label: 'Front Camera' },
            { kind: 'videoinput', deviceId: 'camera2', label: 'Back Camera' }
          ])
        }
      };

      // Mock canvas context
      mockCanvasContext = {
        drawImage: jest.fn(),
        getImageData: jest.fn(() => ({
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480
        }))
      };
      
      // Mock document
      mockDocument = {
        createElement: jest.fn((tag) => {
          if (tag === 'canvas') {
            return {
              getContext: jest.fn(() => mockCanvasContext),
              width: 0,
              height: 0
            };
          }
          return {};
        })
      };

      // Mock requestAnimationFrame
      global.requestAnimationFrame = jest.fn((cb) => 1);
      global.cancelAnimationFrame = jest.fn();

      scanner = createQRScanner({
        jsQR: mockJsQR,
        onScan: mockOnScan,
        onError: mockOnError,
        onStateChange: mockOnStateChange,
        navigator: mockNavigator,
        document: mockDocument
      });
    });

    afterEach(() => {
      if (scanner) {
        scanner.stop();
      }
    });

    describe('initial state', () => {
      test('should start in IDLE state', () => {
        expect(scanner.getState()).toBe(ScannerState.IDLE);
      });

      test('should not be active initially', () => {
        expect(scanner.isActive()).toBe(false);
      });
    });

    describe('getState', () => {
      test('should return current state', () => {
        expect(scanner.getState()).toBe(ScannerState.IDLE);
      });
    });

    describe('isActive', () => {
      test('should return false when not scanning', () => {
        expect(scanner.isActive()).toBe(false);
      });
    });

    describe('stop', () => {
      test('should set state to STOPPED', () => {
        scanner.stop();
        expect(scanner.getState()).toBe(ScannerState.STOPPED);
      });

      test('should call onStateChange', () => {
        scanner.stop();
        expect(mockOnStateChange).toHaveBeenCalledWith(ScannerState.STOPPED);
      });

      test('should set isActive to false', () => {
        scanner.stop();
        expect(scanner.isActive()).toBe(false);
      });
    });

    describe('start', () => {
      test('should request camera access', async () => {
        // Trigger metadata loaded
        setTimeout(() => {
          if (mockVideoElement.onloadedmetadata) {
            mockVideoElement.onloadedmetadata();
          }
        }, 0);

        await scanner.start(mockVideoElement);

        expect(mockNavigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      });

      test('should set video srcObject', async () => {
        setTimeout(() => {
          if (mockVideoElement.onloadedmetadata) {
            mockVideoElement.onloadedmetadata();
          }
        }, 0);

        await scanner.start(mockVideoElement);

        expect(mockVideoElement.srcObject).toBe(mockMediaStream);
      });

      test('should transition to SCANNING state', async () => {
        setTimeout(() => {
          if (mockVideoElement.onloadedmetadata) {
            mockVideoElement.onloadedmetadata();
          }
        }, 0);

        await scanner.start(mockVideoElement);

        expect(scanner.getState()).toBe(ScannerState.SCANNING);
      });

      test('should call onStateChange with STARTING then SCANNING', async () => {
        setTimeout(() => {
          if (mockVideoElement.onloadedmetadata) {
            mockVideoElement.onloadedmetadata();
          }
        }, 0);

        await scanner.start(mockVideoElement);

        expect(mockOnStateChange).toHaveBeenCalledWith(ScannerState.STARTING);
        expect(mockOnStateChange).toHaveBeenCalledWith(ScannerState.SCANNING);
      });

      test('should handle camera permission denied', async () => {
        const permissionError = new Error('Permission denied');
        permissionError.name = 'NotAllowedError';
        mockNavigator.mediaDevices.getUserMedia.mockRejectedValue(permissionError);

        await expect(scanner.start(mockVideoElement)).rejects.toThrow('Camera permission denied');
        expect(scanner.getState()).toBe(ScannerState.ERROR);
      });

      test('should handle no camera found', async () => {
        const notFoundError = new Error('No camera');
        notFoundError.name = 'NotFoundError';
        mockNavigator.mediaDevices.getUserMedia.mockRejectedValue(notFoundError);

        await expect(scanner.start(mockVideoElement)).rejects.toThrow('No camera found');
      });

      test('should handle generic camera error', async () => {
        const genericError = new Error('Some error');
        mockNavigator.mediaDevices.getUserMedia.mockRejectedValue(genericError);

        await expect(scanner.start(mockVideoElement)).rejects.toThrow('Failed to access camera');
      });

      test('should not start if already scanning', async () => {
        setTimeout(() => {
          if (mockVideoElement.onloadedmetadata) {
            mockVideoElement.onloadedmetadata();
          }
        }, 0);

        await scanner.start(mockVideoElement);
        
        // Reset mock to track second call
        mockNavigator.mediaDevices.getUserMedia.mockClear();
        
        // Try to start again - should return early
        await scanner.start(mockVideoElement);
        
        // Should not call getUserMedia again
        expect(mockNavigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
      });
    });

    describe('without mediaDevices support', () => {
      test('should throw when camera API not supported', async () => {
        const newScanner = createQRScanner({
          jsQR: mockJsQR,
          onError: mockOnError,
          navigator: {} // No mediaDevices
        });

        await expect(newScanner.start(mockVideoElement))
          .rejects.toThrow('Camera API not supported');
      });

      test('should throw when navigator is null', async () => {
        const newScanner = createQRScanner({
          jsQR: mockJsQR,
          onError: mockOnError,
          navigator: null
        });

        await expect(newScanner.start(mockVideoElement))
          .rejects.toThrow('Camera API not supported');
      });
    });

    describe('callbacks', () => {
      test('should work without callbacks', () => {
        const scannerWithoutCallbacks = createQRScanner({
          jsQR: mockJsQR,
          navigator: mockNavigator,
          document: mockDocument
        });

        expect(() => {
          scannerWithoutCallbacks.stop();
        }).not.toThrow();
      });
    });
  });

  describe('scanning loop', () => {
    let scanner;
    let mockJsQR;
    let mockOnScan;
    let mockVideoElement;
    let mockMediaStream;
    let mockNavigator;
    let mockDocument;
    let rafCallbacks;
    let mockCanvasContext;

    beforeEach(() => {
      jest.clearAllMocks();
      rafCallbacks = [];

      mockJsQR = jest.fn();
      mockOnScan = jest.fn();

      mockVideoElement = {
        srcObject: null,
        setAttribute: jest.fn(),
        play: jest.fn().mockResolvedValue(undefined),
        onloadedmetadata: null,
        onerror: null,
        readyState: 4,
        HAVE_ENOUGH_DATA: 4, // HTMLVideoElement constant
        videoWidth: 640,
        videoHeight: 480
      };

      mockMediaStream = {
        getTracks: jest.fn(() => [{
          stop: jest.fn()
        }]),
        getVideoTracks: jest.fn(() => [{
          stop: jest.fn(),
          getSettings: jest.fn(() => ({ facingMode: 'environment' }))
        }])
      };

      mockNavigator = {
        mediaDevices: {
          getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
          enumerateDevices: jest.fn().mockResolvedValue([])
        }
      };

      mockCanvasContext = {
        drawImage: jest.fn(),
        getImageData: jest.fn(() => ({
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480
        }))
      };

      const mockCanvas = {
        getContext: jest.fn(() => mockCanvasContext),
        width: 0,
        height: 0
      };

      mockDocument = {
        createElement: jest.fn((tag) => {
          if (tag === 'canvas') {
            return mockCanvas;
          }
          return {};
        })
      };

      // Capture RAF callbacks - execute immediately instead of just storing
      global.requestAnimationFrame = jest.fn((cb) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
      global.cancelAnimationFrame = jest.fn();

      scanner = createQRScanner({
        jsQR: mockJsQR,
        onScan: mockOnScan,
        navigator: mockNavigator,
        document: mockDocument
      });
    });

    afterEach(() => {
      if (scanner) {
        scanner.stop();
      }
    });

    test('should call onScan when QR detected', async () => {
      mockJsQR.mockReturnValue({ data: 'scanned-data' });

      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 0);

      await scanner.start(mockVideoElement);

      // scanFrame is called during start(), which triggers onScan
      expect(mockOnScan).toHaveBeenCalledWith('scanned-data', { data: 'scanned-data' });
    });

    test('should not call onScan repeatedly for same QR', async () => {
      mockJsQR.mockReturnValue({ data: 'same-data' });

      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 0);

      await scanner.start(mockVideoElement);

      // First call happens during start()
      // Simulate multiple RAF callbacks with same QR
      if (rafCallbacks.length > 0) {
        rafCallbacks[0]();
        rafCallbacks[rafCallbacks.length - 1]();
        rafCallbacks[rafCallbacks.length - 1]();
      }

      // Should only be called once for the same data (deduplication)
      expect(mockOnScan).toHaveBeenCalledTimes(1);
    });

    test('should call onScan again for different QR', async () => {
      // Start with first QR
      mockJsQR.mockReturnValue({ data: 'first-data' });

      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 0);

      await scanner.start(mockVideoElement);
      
      // First scan happens during start()
      expect(mockOnScan).toHaveBeenCalledWith('first-data', { data: 'first-data' });

      // Different QR code found
      mockJsQR.mockReturnValue({ data: 'second-data' });
      if (rafCallbacks.length > 0) {
        rafCallbacks[rafCallbacks.length - 1]();
      }

      expect(mockOnScan).toHaveBeenCalledTimes(2);
      expect(mockOnScan).toHaveBeenCalledWith('second-data', { data: 'second-data' });
    });

    test('should not call onScan when no QR found', async () => {
      mockJsQR.mockReturnValue(null);

      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 0);

      await scanner.start(mockVideoElement);

      // Simulate RAF callback
      if (rafCallbacks.length > 0) {
        rafCallbacks[0]();
      }

      expect(mockOnScan).not.toHaveBeenCalled();
    });
  });

  describe('stop behavior', () => {
    let scanner;
    let mockJsQR;
    let mockVideoElement;
    let mockMediaStream;
    let mockNavigator;
    let mockDocument;
    let trackStopMock;

    beforeEach(() => {
      jest.clearAllMocks();

      mockJsQR = jest.fn();
      trackStopMock = jest.fn();

      mockVideoElement = {
        srcObject: null,
        setAttribute: jest.fn(),
        play: jest.fn().mockResolvedValue(undefined),
        onloadedmetadata: null,
        onerror: null,
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480
      };

      mockMediaStream = {
        getTracks: jest.fn(() => [{
          stop: trackStopMock
        }]),
        getVideoTracks: jest.fn(() => [{
          stop: jest.fn(),
          getSettings: jest.fn(() => ({ facingMode: 'environment' }))
        }])
      };

      mockNavigator = {
        mediaDevices: {
          getUserMedia: jest.fn().mockResolvedValue(mockMediaStream),
          enumerateDevices: jest.fn().mockResolvedValue([])
        }
      };

      const mockCanvasContext = {
        drawImage: jest.fn(),
        getImageData: jest.fn(() => ({
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480
        }))
      };

      mockDocument = {
        createElement: jest.fn((tag) => {
          if (tag === 'canvas') {
            return {
              getContext: jest.fn(() => mockCanvasContext),
              width: 0,
              height: 0
            };
          }
          return {};
        })
      };

      global.requestAnimationFrame = jest.fn((cb) => 1);
      global.cancelAnimationFrame = jest.fn();

      scanner = createQRScanner({
        jsQR: mockJsQR,
        navigator: mockNavigator,
        document: mockDocument
      });
    });

    test('should stop media tracks when stopping', async () => {
      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 0);

      await scanner.start(mockVideoElement);
      scanner.stop();

      expect(trackStopMock).toHaveBeenCalled();
    });

    test('should cancel animation frame when stopping', async () => {
      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 0);

      await scanner.start(mockVideoElement);
      scanner.stop();

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    test('should set state to STOPPED', async () => {
      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 0);

      await scanner.start(mockVideoElement);
      scanner.stop();

      expect(scanner.getState()).toBe(ScannerState.STOPPED);
    });
  });
});
