/**
 * Sync Module - CRDT-based data synchronization
 * Uses Yjs for conflict-free replicated data types
 * 
 * @module sync
 */

/**
 * Sync event types
 */
export const SyncEvent = {
  UPDATE: 'update',
  SNAPSHOT: 'snapshot',
  TEXT_CHANGE: 'text-change'
};

/**
 * Creates a Yjs-compatible update encoder
 * This is a lightweight implementation for testing without full Yjs
 * @param {Object} doc - Document state
 * @returns {Uint8Array} Encoded update
 */
export function encodeUpdate(doc) {
  const json = JSON.stringify(doc);
  const encoder = new TextEncoder();
  return encoder.encode(json);
}

/**
 * Decodes an update back to document state
 * @param {Uint8Array} update - Encoded update
 * @returns {Object} Decoded document state
 */
export function decodeUpdate(update) {
  const decoder = new TextDecoder();
  const json = decoder.decode(update);
  return JSON.parse(json);
}

/**
 * Creates a sync manager for document synchronization
 * @param {Object} options - Configuration options
 * @param {Function} options.onTextChange - Callback when text changes
 * @param {Function} options.onSync - Callback when sync occurs
 * @returns {Object} Sync manager object
 */
export function createSyncManager(options = {}) {
  let documentState = {
    text: '',
    chunks: [],
    version: 0,
    lastUpdated: null
  };
  
  const callbacks = {
    onTextChange: options.onTextChange || (() => {}),
    onSync: options.onSync || (() => {})
  };

  const observers = new Set();

  /**
   * Adds an observer for document changes
   * @param {Function} callback - Observer callback
   * @returns {Function} Unsubscribe function
   */
  function observe(callback) {
    observers.add(callback);
    return () => observers.delete(callback);
  }

  /**
   * Notifies all observers of changes
   * @param {string} event - Event type
   * @param {any} data - Event data
   */
  function notifyObservers(event, data) {
    observers.forEach(callback => callback(event, data));
  }

  /**
   * Appends text to the document (for LLM streaming)
   * @param {string} text - Text to append
   * @returns {Object} Updated document state
   */
  function appendText(text) {
    if (typeof text !== 'string') {
      throw new TypeError('Text must be a string');
    }

    documentState.text += text;
    documentState.chunks.push({
      content: text,
      timestamp: Date.now(),
      index: documentState.chunks.length
    });
    documentState.version++;
    documentState.lastUpdated = Date.now();

    callbacks.onTextChange(documentState.text);
    notifyObservers(SyncEvent.TEXT_CHANGE, { text, fullText: documentState.text });

    return { ...documentState };
  }

  /**
   * Sets the entire text content (replaces)
   * @param {string} text - New text content
   * @returns {Object} Updated document state
   */
  function setText(text) {
    if (typeof text !== 'string') {
      throw new TypeError('Text must be a string');
    }

    documentState.text = text;
    documentState.chunks = [{
      content: text,
      timestamp: Date.now(),
      index: 0
    }];
    documentState.version++;
    documentState.lastUpdated = Date.now();

    callbacks.onTextChange(documentState.text);
    notifyObservers(SyncEvent.TEXT_CHANGE, { text, fullText: text });

    return { ...documentState };
  }

  /**
   * Gets the current text content
   * @returns {string} Current text
   */
  function getText() {
    return documentState.text;
  }

  /**
   * Gets the full document state
   * @returns {Object} Document state copy
   */
  function getState() {
    return { ...documentState };
  }

  /**
   * Gets the document version
   * @returns {number} Current version
   */
  function getVersion() {
    return documentState.version;
  }

  /**
   * Creates an encoded snapshot for transmission
   * @returns {Uint8Array} Encoded snapshot
   */
  function createSnapshot() {
    return encodeUpdate(documentState);
  }

  /**
   * Applies a received snapshot
   * @param {Uint8Array} snapshot - Encoded snapshot to apply
   * @returns {Object} Updated document state
   */
  function applySnapshot(snapshot) {
    const decoded = decodeUpdate(snapshot);
    
    // Only apply if newer version
    if (decoded.version > documentState.version) {
      documentState = { ...decoded };
      callbacks.onTextChange(documentState.text);
      callbacks.onSync(documentState);
      notifyObservers(SyncEvent.SNAPSHOT, documentState);
    }
    
    return { ...documentState };
  }

  /**
   * Applies an incremental update
   * @param {Object} update - Update object with text delta
   * @returns {Object} Updated document state
   */
  function applyUpdate(update) {
    if (update.type === 'append' && update.text) {
      return appendText(update.text);
    } else if (update.type === 'set' && update.text !== undefined) {
      return setText(update.text);
    }
    return { ...documentState };
  }

  /**
   * Merges remote state with local state (CRDT-style)
   * Uses last-write-wins for simplicity
   * @param {Object} remoteState - Remote document state
   * @returns {Object} Merged document state
   */
  function merge(remoteState) {
    if (!remoteState || typeof remoteState !== 'object') {
      return { ...documentState };
    }

    // Simple LWW merge - take the newer version
    if (remoteState.version > documentState.version) {
      documentState = { ...remoteState };
      callbacks.onTextChange(documentState.text);
      callbacks.onSync(documentState);
      notifyObservers(SyncEvent.SNAPSHOT, documentState);
    } else if (remoteState.version === documentState.version && 
               remoteState.lastUpdated > documentState.lastUpdated) {
      documentState = { ...remoteState };
      callbacks.onTextChange(documentState.text);
      callbacks.onSync(documentState);
      notifyObservers(SyncEvent.SNAPSHOT, documentState);
    }

    return { ...documentState };
  }

  /**
   * Resets the document state
   */
  function reset() {
    documentState = {
      text: '',
      chunks: [],
      version: 0,
      lastUpdated: null
    };
    notifyObservers(SyncEvent.TEXT_CHANGE, { text: '', fullText: '' });
  }

  /**
   * Gets chunk count
   * @returns {number} Number of chunks
   */
  function getChunkCount() {
    return documentState.chunks.length;
  }

  return {
    appendText,
    setText,
    getText,
    getState,
    getVersion,
    createSnapshot,
    applySnapshot,
    applyUpdate,
    merge,
    reset,
    observe,
    getChunkCount
  };
}

/**
 * Creates a text stream handler for LLM token streaming
 * @param {Object} syncManager - Sync manager instance
 * @param {Object} connectionManager - Connection manager instance
 * @returns {Object} Stream handler
 */
export function createStreamHandler(syncManager, connectionManager) {
  let isStreaming = false;
  let tokenCount = 0;

  /**
   * Handles incoming LLM token
   * @param {string} token - Token to process
   */
  function onToken(token) {
    if (!isStreaming) return;
    
    tokenCount++;
    syncManager.appendText(token);
    
    // Broadcast update to peers
    if (connectionManager && connectionManager.broadcast) {
      connectionManager.broadcast({
        type: 'append',
        text: token,
        tokenIndex: tokenCount
      });
    }
  }

  /**
   * Starts streaming mode
   */
  function startStream() {
    isStreaming = true;
    tokenCount = 0;
    syncManager.reset();
  }

  /**
   * Stops streaming mode
   */
  function stopStream() {
    isStreaming = false;
  }

  /**
   * Checks if currently streaming
   * @returns {boolean} Streaming state
   */
  function isActive() {
    return isStreaming;
  }

  /**
   * Gets token count
   * @returns {number} Number of tokens processed
   */
  function getTokenCount() {
    return tokenCount;
  }

  return {
    onToken,
    startStream,
    stopStream,
    isActive,
    getTokenCount
  };
}
