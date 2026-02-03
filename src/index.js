/**
 * P2P LLM Stream - Module Index
 * 
 * Central export point for all modules
 */

// Connection module
export {
  generateRoomId,
  validateRoomId,
  createConnectionManager,
  ConnectionState,
  DEFAULT_CONFIG
} from './modules/connection.js';

// Sync module
export {
  encodeUpdate,
  decodeUpdate,
  createSyncManager,
  createStreamHandler,
  SyncEvent
} from './modules/sync.js';

// QR Code module
export {
  createSessionData,
  encodeSessionData,
  decodeSessionData,
  validateSessionData,
  isSessionExpired,
  createQRManager,
  PROTOCOL_VERSION,
  QR_CONFIG
} from './modules/qrcode.js';

// Storage module
export {
  createStorageAdapter,
  createSessionStorage,
  createDocumentStorage,
  createSettingsStorage,
  STORAGE_KEYS
} from './modules/storage.js';

// Scanner module
export {
  createQRScanner,
  ScannerState
} from './modules/scanner.js';

// Direct WebRTC module (serverless)
export {
  DirectConnectionState,
  DEFAULT_ICE_SERVERS,
  compressSignaling,
  decompressSignaling,
  createDirectConnection
} from './modules/webrtc-direct.js';
