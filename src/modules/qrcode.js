/**
 * QR Code Module
 * Handles QR code generation and parsing for P2P session sharing
 * 
 * @module qrcode
 */

/**
 * QR Code configuration defaults
 */
export const QR_CONFIG = {
  errorCorrectionLevel: 'M',
  width: 256,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#ffffff'
  }
};

/**
 * Session data structure for QR encoding
 * @typedef {Object} SessionData
 * @property {string} roomId - Unique room identifier
 * @property {string} [encryptionKey] - Optional encryption key
 * @property {number} timestamp - Creation timestamp
 * @property {string} version - Protocol version
 */

/**
 * Protocol version for compatibility checking
 */
export const PROTOCOL_VERSION = '1.0';

/**
 * Creates session data for QR encoding
 * @param {string} roomId - Room ID to encode
 * @param {Object} options - Additional options
 * @param {string} options.encryptionKey - Optional encryption key
 * @returns {SessionData} Session data object
 */
export function createSessionData(roomId, options = {}) {
  if (!roomId || typeof roomId !== 'string') {
    throw new Error('Room ID is required and must be a string');
  }

  return {
    roomId,
    encryptionKey: options.encryptionKey || null,
    timestamp: Date.now(),
    version: PROTOCOL_VERSION
  };
}

/**
 * Encodes session data to a string for QR code
 * @param {SessionData} sessionData - Session data to encode
 * @returns {string} Encoded string
 */
export function encodeSessionData(sessionData) {
  if (!sessionData || !sessionData.roomId) {
    throw new Error('Invalid session data');
  }
  
  // Use base64 encoding of JSON for compact representation
  const json = JSON.stringify(sessionData);
  
  // Browser-compatible base64 encoding
  if (typeof btoa === 'function') {
    return btoa(json);
  }
  
  // Node.js fallback
  return Buffer.from(json).toString('base64');
}

/**
 * Decodes session data from a QR code string
 * @param {string} encoded - Encoded string from QR code
 * @returns {SessionData} Decoded session data
 */
export function decodeSessionData(encoded) {
  if (!encoded || typeof encoded !== 'string') {
    throw new Error('Invalid encoded data');
  }

  try {
    // Browser-compatible base64 decoding
    let json;
    if (typeof atob === 'function') {
      json = atob(encoded);
    } else {
      // Node.js fallback
      json = Buffer.from(encoded, 'base64').toString('utf-8');
    }
    
    const data = JSON.parse(json);
    
    // Validate required fields
    if (!data.roomId) {
      throw new Error('Missing roomId in session data');
    }
    
    return data;
  } catch (error) {
    if (error.message.includes('roomId')) {
      throw error;
    }
    throw new Error('Failed to decode session data: ' + error.message);
  }
}

/**
 * Validates session data structure
 * @param {SessionData} sessionData - Data to validate
 * @returns {Object} Validation result
 */
export function validateSessionData(sessionData) {
  const errors = [];
  
  if (!sessionData) {
    return { valid: false, errors: ['Session data is required'] };
  }
  
  if (!sessionData.roomId || typeof sessionData.roomId !== 'string') {
    errors.push('roomId is required and must be a string');
  }
  
  if (!sessionData.version) {
    errors.push('version is required');
  } else if (sessionData.version !== PROTOCOL_VERSION) {
    errors.push(`Incompatible protocol version: ${sessionData.version}, expected ${PROTOCOL_VERSION}`);
  }
  
  if (!sessionData.timestamp || typeof sessionData.timestamp !== 'number') {
    errors.push('timestamp is required and must be a number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Checks if session data is expired
 * @param {SessionData} sessionData - Session data to check
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @returns {boolean} True if expired
 */
export function isSessionExpired(sessionData, maxAgeMs = 3600000) {
  if (!sessionData || !sessionData.timestamp) {
    return true;
  }
  
  const age = Date.now() - sessionData.timestamp;
  return age > maxAgeMs;
}

/**
 * Creates a QR code manager
 * @param {Object} qrcodeLib - QR code library (injected for testability)
 * @returns {Object} QR code manager
 */
export function createQRManager(qrcodeLib = null) {
  let lastGeneratedData = null;
  
  /**
   * Generates QR code data URL
   * @param {string} roomId - Room ID to encode
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Data URL of QR code
   */
  async function generate(roomId, options = {}) {
    const sessionData = createSessionData(roomId, options);
    const encoded = encodeSessionData(sessionData);
    
    lastGeneratedData = sessionData;
    
    if (qrcodeLib && qrcodeLib.toDataURL) {
      return await qrcodeLib.toDataURL(encoded, {
        ...QR_CONFIG,
        ...options.qrOptions
      });
    }
    
    // Return mock data URL for testing
    return `data:image/png;base64,mock_qr_${encoded}`;
  }

  /**
   * Generates QR code to canvas element
   * @param {HTMLCanvasElement} canvas - Target canvas
   * @param {string} roomId - Room ID to encode
   * @param {Object} options - Generation options
   * @returns {Promise<SessionData>} Session data
   */
  async function generateToCanvas(canvas, roomId, options = {}) {
    const sessionData = createSessionData(roomId, options);
    const encoded = encodeSessionData(sessionData);
    
    lastGeneratedData = sessionData;
    
    if (qrcodeLib && qrcodeLib.toCanvas) {
      await qrcodeLib.toCanvas(canvas, encoded, {
        ...QR_CONFIG,
        ...options.qrOptions
      });
    }
    
    return sessionData;
  }

  /**
   * Parses QR code content
   * @param {string} content - Scanned QR content
   * @returns {SessionData} Parsed session data
   */
  function parse(content) {
    const sessionData = decodeSessionData(content);
    const validation = validateSessionData(sessionData);
    
    if (!validation.valid) {
      throw new Error('Invalid QR code: ' + validation.errors.join(', '));
    }
    
    return sessionData;
  }

  /**
   * Gets the last generated session data
   * @returns {SessionData|null} Last generated data
   */
  function getLastGenerated() {
    return lastGeneratedData;
  }

  /**
   * Creates a shareable URL with session data
   * @param {string} baseUrl - Base URL of the application
   * @param {string} roomId - Room ID
   * @param {Object} options - Options
   * @returns {string} Shareable URL
   */
  function createShareUrl(baseUrl, roomId, options = {}) {
    const sessionData = createSessionData(roomId, options);
    const encoded = encodeSessionData(sessionData);
    const url = new URL(baseUrl);
    url.searchParams.set('session', encoded);
    return url.toString();
  }

  /**
   * Parses session from URL
   * @param {string} url - URL to parse
   * @returns {SessionData|null} Session data or null
   */
  function parseFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const encoded = urlObj.searchParams.get('session');
      if (!encoded) return null;
      return parse(encoded);
    } catch {
      return null;
    }
  }

  return {
    generate,
    generateToCanvas,
    parse,
    getLastGenerated,
    createShareUrl,
    parseFromUrl
  };
}
