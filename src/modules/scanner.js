/**
 * QR Scanner Module
 * Handles camera-based QR code scanning for session joining
 * 
 * @module scanner
 */

/**
 * Scanner states
 */
export const ScannerState = {
  IDLE: 'idle',
  STARTING: 'starting',
  SCANNING: 'scanning',
  STOPPED: 'stopped',
  ERROR: 'error'
};

/**
 * Creates a QR code scanner
 * @param {Object} options - Scanner options
 * @param {Function} options.onScan - Callback when QR code is scanned
 * @param {Function} options.onError - Callback on scanner error
 * @param {Function} options.onStateChange - Callback when scanner state changes
 * @param {Object} options.jsQR - jsQR library (injected for testability)
 * @param {Object} options.navigator - Navigator object (injected for testability)
 * @param {Object} options.document - Document object (injected for testability)
 * @returns {Object} Scanner instance
 */
export function createQRScanner(options = {}) {
  let state = ScannerState.IDLE;
  let videoStream = null;
  let videoElement = null;
  let canvasElement = null;
  let canvasContext = null;
  let animationFrameId = null;
  let isScanning = false;
  let lastScannedData = null; // For deduplication

  const callbacks = {
    onScan: options.onScan || (() => {}),
    onError: options.onError || (() => {}),
    onStateChange: options.onStateChange || (() => {})
  };

  // jsQR library reference (can be injected or dynamically loaded)
  let jsQRLib = options.jsQR || null;
  
  // Browser APIs (can be injected for testing)
  const nav = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  const doc = options.document || (typeof document !== 'undefined' ? document : null);

  /**
   * Updates scanner state
   * @param {string} newState - New state
   */
  function setState(newState) {
    if (state !== newState) {
      state = newState;
      callbacks.onStateChange(newState);
    }
  }

  /**
   * Loads jsQR library dynamically if not provided
   * @returns {Promise<Function>} jsQR function
   */
  async function loadJsQR() {
    if (jsQRLib) return jsQRLib;
    
    // Try to load from global (if script tag loaded)
    if (typeof window !== 'undefined' && window.jsQR) {
      jsQRLib = window.jsQR;
      return jsQRLib;
    }

    // Dynamic import
    try {
      const module = await import('https://esm.sh/jsqr@1.4.0');
      jsQRLib = module.default;
      return jsQRLib;
    } catch (error) {
      throw new Error('Failed to load jsQR library: ' + error.message);
    }
  }

  /**
   * Requests camera access
   * @param {string} facingMode - 'environment' for back camera, 'user' for front
   * @returns {Promise<MediaStream>} Camera stream
   */
  async function requestCamera(facingMode = 'environment') {
    if (!nav || !nav.mediaDevices || !nav.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser');
    }

    try {
      const stream = await nav.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      return stream;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera permission denied');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found');
      }
      throw new Error('Failed to access camera: ' + error.message);
    }
  }

  /**
   * Starts the QR scanner
   * @param {HTMLVideoElement} video - Video element to display camera feed
   * @param {HTMLCanvasElement} canvas - Canvas for image processing (optional)
   * @returns {Promise<void>}
   */
  async function start(video, canvas = null) {
    if (isScanning) {
      return;
    }

    setState(ScannerState.STARTING);

    try {
      // Load jsQR if needed
      await loadJsQR();

      // Get camera stream
      videoStream = await requestCamera();
      
      // Set up video element
      videoElement = video;
      videoElement.srcObject = videoStream;
      videoElement.setAttribute('playsinline', 'true');
      
      await new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play()
            .then(resolve)
            .catch(reject);
        };
        videoElement.onerror = reject;
      });

      // Set up canvas for frame capture
      if (canvas) {
        canvasElement = canvas;
      } else {
        canvasElement = doc.createElement('canvas');
      }
      canvasContext = canvasElement.getContext('2d', { willReadFrequently: true });

      // Start scanning loop
      isScanning = true;
      setState(ScannerState.SCANNING);
      scanFrame();

    } catch (error) {
      setState(ScannerState.ERROR);
      callbacks.onError(error);
      throw error;
    }
  }

  /**
   * Scans a single video frame for QR codes
   */
  function scanFrame() {
    if (!isScanning || !videoElement || !jsQRLib) {
      return;
    }

    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
      // Update canvas size to match video
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;

      // Draw video frame to canvas
      canvasContext.drawImage(
        videoElement,
        0, 0,
        canvasElement.width,
        canvasElement.height
      );

      // Get image data and scan for QR
      const imageData = canvasContext.getImageData(
        0, 0,
        canvasElement.width,
        canvasElement.height
      );

      const code = jsQRLib(
        imageData.data,
        imageData.width,
        imageData.height,
        { inversionAttempts: 'dontInvert' }
      );

      if (code && code.data) {
        // QR code found! Only report if it's different from the last one
        if (code.data !== lastScannedData) {
          lastScannedData = code.data;
          callbacks.onScan(code.data, code);
        }
      } else {
        // No QR found - reset deduplication so next scan will trigger callback
        lastScannedData = null;
      }
    }

    // Continue scanning
    animationFrameId = requestAnimationFrame(scanFrame);
  }

  /**
   * Stops the scanner
   */
  function stop() {
    isScanning = false;

    // Cancel animation frame
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Stop video stream
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }

    // Clear video element
    if (videoElement) {
      videoElement.srcObject = null;
      videoElement = null;
    }

    canvasElement = null;
    canvasContext = null;

    setState(ScannerState.STOPPED);
  }

  /**
   * Gets current scanner state
   * @returns {string} Current state
   */
  function getState() {
    return state;
  }

  /**
   * Checks if scanner is active
   * @returns {boolean} True if scanning
   */
  function isActive() {
    return isScanning;
  }

  /**
   * Scans a QR code from an image file
   * @param {File|Blob} imageFile - Image file to scan
   * @returns {Promise<string|null>} QR code data or null
   */
  async function scanImage(imageFile) {
    await loadJsQR();

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);

      img.onload = () => {
        const canvas = doc.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQRLib(imageData.data, imageData.width, imageData.height);
        
        URL.revokeObjectURL(url);
        resolve(code ? code.data : null);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Switches between front and back camera
   * @param {string} facingMode - 'environment' or 'user'
   * @returns {Promise<void>}
   */
  async function switchCamera(facingMode) {
    if (!isScanning) return;

    const wasScanning = isScanning;
    const video = videoElement;
    const canvas = canvasElement;

    stop();

    if (wasScanning && video) {
      // Restart with new camera
      videoStream = await requestCamera(facingMode);
      await start(video, canvas);
    }
  }

  return {
    start,
    stop,
    getState,
    isActive,
    scanImage,
    switchCamera
  };
}
