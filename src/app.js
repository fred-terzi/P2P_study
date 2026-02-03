/**
 * P2P LLM Stream - Application Entry Point
 * 
 * This file demonstrates how to use the modular components together
 * to create a P2P LLM streaming application.
 */

import {
  generateRoomId,
  createConnectionManager,
  createSyncManager,
  createStreamHandler,
  createQRManager,
  createStorageAdapter,
  createDocumentStorage,
  ConnectionState
} from './index.js';

import { createQRScanner, ScannerState } from './modules/scanner.js';

/**
 * Creates the full P2P application instance
 * @param {Object} options - Application options
 * @returns {Object} Application instance
 */
export function createP2PApp(options = {}) {
  // Initialize storage
  const storageAdapter = createStorageAdapter(
    typeof localStorage !== 'undefined' ? localStorage : null
  );
  const docStorage = createDocumentStorage(storageAdapter);
  
  // Initialize QR manager
  const qrManager = createQRManager(options.qrLib || null);
  
  // Initialize sync manager
  const syncManager = createSyncManager({
    onTextChange: (text) => {
      options.onTextChange?.(text);
      // Auto-save to storage
      if (currentRoomId) {
        docStorage.saveDocument(currentRoomId, syncManager.getState());
      }
    },
    onSync: (state) => {
      options.onSync?.(state);
    }
  });
  
  // Initialize connection manager
  const connectionManager = createConnectionManager({
    onPeerJoin: (peerId) => {
      console.log('Peer joined:', peerId);
      options.onPeerJoin?.(peerId);
      // Send current state to new peer
      connectionManager.broadcast(syncManager.getState());
    },
    onPeerLeave: (peerId) => {
      console.log('Peer left:', peerId);
      options.onPeerLeave?.(peerId);
    },
    onStateChange: (state) => {
      console.log('Connection state:', state);
      options.onStateChange?.(state);
    },
    onData: (data, peerId) => {
      console.log('Received data from:', peerId);
      syncManager.merge(data);
    }
  });
  
  // Initialize stream handler
  const streamHandler = createStreamHandler(syncManager, connectionManager);
  
  // Initialize QR scanner
  let qrScanner = null;
  let scannerJoinRoom = null; // Store joinRoom function for use after scan
  
  let currentRoomId = null;

  /**
   * Creates a new hosting session
   * @param {Function} joinRoom - Trystero joinRoom function
   * @returns {Promise<Object>} Session info
   */
  async function createSession(joinRoom) {
    const roomId = generateRoomId();
    currentRoomId = roomId;
    
    await connectionManager.join(roomId, joinRoom);
    
    const qrDataUrl = await qrManager.generate(roomId);
    
    return {
      roomId,
      qrDataUrl,
      shareUrl: qrManager.createShareUrl(
        options.baseUrl || 'https://localhost:3000',
        roomId
      )
    };
  }

  /**
   * Joins an existing session from QR data
   * @param {string} qrContent - Scanned QR content
   * @param {Function} joinRoom - Trystero joinRoom function
   * @returns {Promise<Object>} Session info
   */
  async function joinSession(qrContent, joinRoom) {
    const sessionData = qrManager.parse(qrContent);
    currentRoomId = sessionData.roomId;
    
    // Load any persisted state
    const savedState = docStorage.loadDocument(currentRoomId);
    if (savedState) {
      syncManager.merge(savedState);
    }
    
    await connectionManager.join(sessionData.roomId, joinRoom);
    
    return {
      roomId: sessionData.roomId,
      sessionData
    };
  }

  /**
   * Joins an existing session by room ID directly
   * @param {string} roomId - Room ID to join
   * @param {Function} joinRoom - Trystero joinRoom function
   * @returns {Promise<Object>} Session info
   */
  async function joinSessionById(roomId, joinRoom) {
    currentRoomId = roomId;
    
    // Load any persisted state
    const savedState = docStorage.loadDocument(currentRoomId);
    if (savedState) {
      syncManager.merge(savedState);
    }
    
    await connectionManager.join(roomId, joinRoom);
    
    return {
      roomId,
      sessionData: { roomId }
    };
  }

  /**
   * Starts QR code scanner to join a session
   * @param {HTMLVideoElement} videoElement - Video element to display camera feed
   * @param {Function} joinRoom - Trystero joinRoom function
   * @param {Object} scanOptions - Scanner options
   * @returns {Promise<Object>} Scanner control object
   */
  async function startScanner(videoElement, joinRoom, scanOptions = {}) {
    // Store joinRoom for use when QR is scanned
    scannerJoinRoom = joinRoom;
    
    // Create scanner if not exists
    if (!qrScanner) {
      qrScanner = createQRScanner({
        onScan: async (qrData, codeInfo) => {
          console.log('QR Code scanned:', qrData);
          
          // Stop scanner
          qrScanner.stop();
          
          // Notify callback
          options.onQRScanned?.(qrData, codeInfo);
          
          // Auto-join if enabled (default: true)
          if (scanOptions.autoJoin !== false && scannerJoinRoom) {
            try {
              const result = await joinSession(qrData, scannerJoinRoom);
              options.onSessionJoined?.(result);
            } catch (error) {
              console.error('Failed to join session:', error);
              options.onError?.(error);
            }
          }
        },
        onError: (error) => {
          console.error('Scanner error:', error);
          options.onScannerError?.(error);
        },
        onStateChange: (state) => {
          options.onScannerStateChange?.(state);
        },
        jsQR: options.jsQR || null
      });
    }
    
    // Start scanning
    await qrScanner.start(videoElement);
    
    return {
      stop: () => qrScanner.stop(),
      isActive: () => qrScanner.isActive(),
      getState: () => qrScanner.getState(),
      switchCamera: (mode) => qrScanner.switchCamera(mode)
    };
  }

  /**
   * Stops the QR scanner
   */
  function stopScanner() {
    if (qrScanner) {
      qrScanner.stop();
    }
  }

  /**
   * Scans a QR code from an image file
   * @param {File|Blob} imageFile - Image file to scan
   * @param {Function} joinRoom - Trystero joinRoom function (optional, for auto-join)
   * @returns {Promise<Object>} Scan result with QR data
   */
  async function scanImageFile(imageFile, joinRoom = null) {
    if (!qrScanner) {
      qrScanner = createQRScanner({
        jsQR: options.jsQR || null
      });
    }
    
    const qrData = await qrScanner.scanImage(imageFile);
    
    if (!qrData) {
      throw new Error('No QR code found in image');
    }
    
    // Auto-join if joinRoom provided
    if (joinRoom) {
      const result = await joinSession(qrData, joinRoom);
      return { qrData, ...result };
    }
    
    return { qrData };
  }

  /**
   * Starts LLM streaming mode
   */
  function startStreaming() {
    streamHandler.startStream();
  }

  /**
   * Stops LLM streaming mode
   */
  function stopStreaming() {
    streamHandler.stopStream();
  }

  /**
   * Handles incoming LLM token
   * @param {string} token - Token to process
   */
  function onLLMToken(token) {
    streamHandler.onToken(token);
  }

  /**
   * Gets current text content
   * @returns {string} Current text
   */
  function getText() {
    return syncManager.getText();
  }

  /**
   * Gets current connection state
   * @returns {string} Connection state
   */
  function getConnectionState() {
    return connectionManager.getState();
  }

  /**
   * Gets number of connected peers
   * @returns {number} Peer count
   */
  function getPeerCount() {
    return connectionManager.getPeerCount();
  }

  /**
   * Disconnects from current session
   */
  function disconnect() {
    connectionManager.leave();
    currentRoomId = null;
  }

  /**
   * Cleans up resources
   */
  function destroy() {
    disconnect();
    syncManager.reset();
  }

  return {
    createSession,
    joinSession,
    joinSessionById,
    startScanner,
    stopScanner,
    scanImageFile,
    startStreaming,
    stopStreaming,
    onLLMToken,
    getText,
    getConnectionState,
    getPeerCount,
    disconnect,
    destroy,
    // Expose internals for advanced usage
    connectionManager,
    syncManager,
    streamHandler,
    qrManager,
    docStorage
  };
}

// Export ConnectionState and ScannerState for external use
export { ConnectionState, ScannerState };
