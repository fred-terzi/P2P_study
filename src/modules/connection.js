/**
 * P2P Connection Module
 * Handles WebRTC peer-to-peer connections using Trystero
 * 
 * @module connection
 */

/**
 * Connection configuration defaults
 */
export const DEFAULT_CONFIG = {
  appId: 'p2p-llm-stream',
  relayUrls: [
    'wss://relay.nostr.band',
    'wss://nostr.mutinywallet.com',
    'wss://relay.primal.net',
    'wss://purplepag.es'
  ],
  relayRedundancy: 2
};

/**
 * Connection states enum
 */
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

/**
 * Generates a unique room ID for P2P sessions
 * @returns {string} UUID v4 format room ID
 */
export function generateRoomId() {
  // Use crypto.randomUUID if available, fallback to manual generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validates a room ID format
 * @param {string} roomId - The room ID to validate
 * @returns {boolean} True if valid UUID format
 */
export function validateRoomId(roomId) {
  if (typeof roomId !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(roomId);
}

/**
 * Creates a connection manager instance
 * @param {Object} options - Configuration options
 * @param {string} options.appId - Application identifier
 * @param {Function} options.onPeerJoin - Callback when peer joins
 * @param {Function} options.onPeerLeave - Callback when peer leaves
 * @param {Function} options.onStateChange - Callback when connection state changes
 * @returns {Object} Connection manager object
 */
export function createConnectionManager(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  
  let state = ConnectionState.DISCONNECTED;
  let room = null;
  let peers = new Set();
  let actions = {};
  
  const callbacks = {
    onPeerJoin: options.onPeerJoin || (() => {}),
    onPeerLeave: options.onPeerLeave || (() => {}),
    onStateChange: options.onStateChange || (() => {}),
    onData: options.onData || (() => {})
  };

  /**
   * Updates connection state and notifies listeners
   * @param {string} newState - New connection state
   */
  function setState(newState) {
    if (state !== newState) {
      state = newState;
      callbacks.onStateChange(newState);
    }
  }

  /**
   * Joins a P2P room
   * @param {string} roomId - Room ID to join
   * @param {Function} joinRoom - Trystero joinRoom function (injected for testability)
   * @returns {Promise<Object>} Room object
   */
  async function join(roomId, joinRoom) {
    if (!validateRoomId(roomId)) {
      setState(ConnectionState.ERROR);
      throw new Error('Invalid room ID format');
    }

    setState(ConnectionState.CONNECTING);

    try {
      room = joinRoom({ 
        appId: config.appId,
        relayUrls: config.relayUrls,
        relayRedundancy: config.relayRedundancy
      }, roomId);
      
      // Set up peer tracking
      room.onPeerJoin((peerId) => {
        peers.add(peerId);
        callbacks.onPeerJoin(peerId);
        if (state !== ConnectionState.CONNECTED) {
          setState(ConnectionState.CONNECTED);
        }
      });

      room.onPeerLeave((peerId) => {
        peers.delete(peerId);
        callbacks.onPeerLeave(peerId);
        if (peers.size === 0) {
          setState(ConnectionState.CONNECTING);
        }
      });

      // Create data action for sync
      const [sendData, getData] = room.makeAction('sync');
      actions.sendData = sendData;
      getData((data, peerId) => callbacks.onData(data, peerId));

      return room;
    } catch (error) {
      setState(ConnectionState.ERROR);
      throw error;
    }
  }

  /**
   * Leaves the current room
   */
  function leave() {
    if (room) {
      room.leave();
      room = null;
      peers.clear();
      actions = {};
      setState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Sends data to all connected peers
   * @param {any} data - Data to send
   */
  function broadcast(data) {
    if (actions.sendData) {
      actions.sendData(data);
    }
  }

  /**
   * Gets current connection state
   * @returns {string} Current state
   */
  function getState() {
    return state;
  }

  /**
   * Gets list of connected peer IDs
   * @returns {string[]} Array of peer IDs
   */
  function getPeers() {
    return Array.from(peers);
  }

  /**
   * Gets peer count
   * @returns {number} Number of connected peers
   */
  function getPeerCount() {
    return peers.size;
  }

  return {
    join,
    leave,
    broadcast,
    getState,
    getPeers,
    getPeerCount,
    config
  };
}
