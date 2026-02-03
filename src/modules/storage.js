/**
 * Storage Module
 * Handles browser storage for P2P session persistence
 * 
 * @module storage
 */

/**
 * Storage keys namespace
 */
export const STORAGE_KEYS = {
  SESSION: 'p2p_session',
  DOCUMENT: 'p2p_document',
  SETTINGS: 'p2p_settings',
  HISTORY: 'p2p_history'
};

/**
 * Creates a storage adapter interface
 * @param {Object} backend - Storage backend (localStorage, sessionStorage, or custom)
 * @returns {Object} Storage adapter
 */
export function createStorageAdapter(backend) {
  if (!backend) {
    // Create in-memory fallback for testing/SSR
    const memoryStore = new Map();
    backend = {
      getItem: (key) => memoryStore.get(key) || null,
      setItem: (key, value) => memoryStore.set(key, value),
      removeItem: (key) => memoryStore.delete(key),
      clear: () => memoryStore.clear(),
      keys: () => Array.from(memoryStore.keys())
    };
  }

  /**
   * Gets an item from storage
   * @param {string} key - Storage key
   * @returns {any} Parsed value or null
   */
  function get(key) {
    try {
      const value = backend.getItem(key);
      if (value === null) return null;
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /**
   * Sets an item in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {boolean} Success status
   */
  function set(key, value) {
    try {
      backend.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  /**
   * Removes an item from storage
   * @param {string} key - Storage key
   * @returns {boolean} Success status
   */
  function remove(key) {
    try {
      backend.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clears all storage
   * @returns {boolean} Success status
   */
  function clear() {
    try {
      backend.clear();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if key exists
   * @param {string} key - Storage key
   * @returns {boolean} Exists status
   */
  function has(key) {
    return backend.getItem(key) !== null;
  }

  return {
    get,
    set,
    remove,
    clear,
    has
  };
}

/**
 * Creates a session storage manager
 * @param {Object} adapter - Storage adapter
 * @returns {Object} Session storage manager
 */
export function createSessionStorage(adapter) {
  const prefix = STORAGE_KEYS.SESSION + '_';

  /**
   * Saves a session
   * @param {string} sessionId - Session ID
   * @param {Object} data - Session data
   * @returns {boolean} Success status
   */
  function saveSession(sessionId, data) {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Session ID is required');
    }
    
    const sessionData = {
      ...data,
      id: sessionId,
      savedAt: Date.now()
    };
    
    return adapter.set(prefix + sessionId, sessionData);
  }

  /**
   * Loads a session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data
   */
  function loadSession(sessionId) {
    if (!sessionId) return null;
    return adapter.get(prefix + sessionId);
  }

  /**
   * Deletes a session
   * @param {string} sessionId - Session ID
   * @returns {boolean} Success status
   */
  function deleteSession(sessionId) {
    if (!sessionId) return false;
    return adapter.remove(prefix + sessionId);
  }

  /**
   * Checks if session exists
   * @param {string} sessionId - Session ID
   * @returns {boolean} Exists status
   */
  function hasSession(sessionId) {
    if (!sessionId) return false;
    return adapter.has(prefix + sessionId);
  }

  /**
   * Gets all session IDs
   * @returns {string[]} Array of session IDs
   */
  function getAllSessionIds() {
    // This is a simplified implementation
    // In production, you'd iterate through storage keys
    return [];
  }

  return {
    saveSession,
    loadSession,
    deleteSession,
    hasSession,
    getAllSessionIds
  };
}

/**
 * Creates a document storage manager for persisting CRDT documents
 * @param {Object} adapter - Storage adapter
 * @returns {Object} Document storage manager
 */
export function createDocumentStorage(adapter) {
  const prefix = STORAGE_KEYS.DOCUMENT + '_';

  /**
   * Saves document state
   * @param {string} docId - Document ID
   * @param {Object} state - Document state
   * @returns {boolean} Success status
   */
  function saveDocument(docId, state) {
    if (!docId || typeof docId !== 'string') {
      throw new Error('Document ID is required');
    }

    const docData = {
      id: docId,
      state,
      savedAt: Date.now(),
      version: state.version || 0
    };

    // Also save to history
    saveToHistory(docId, state);

    return adapter.set(prefix + docId, docData);
  }

  /**
   * Loads document state
   * @param {string} docId - Document ID
   * @returns {Object|null} Document data
   */
  function loadDocument(docId) {
    if (!docId) return null;
    const data = adapter.get(prefix + docId);
    return data ? data.state : null;
  }

  /**
   * Deletes document
   * @param {string} docId - Document ID
   * @returns {boolean} Success status
   */
  function deleteDocument(docId) {
    if (!docId) return false;
    return adapter.remove(prefix + docId);
  }

  /**
   * Gets document metadata without full state
   * @param {string} docId - Document ID
   * @returns {Object|null} Metadata
   */
  function getDocumentMeta(docId) {
    const data = adapter.get(prefix + docId);
    if (!data) return null;
    return {
      id: data.id,
      savedAt: data.savedAt,
      version: data.version
    };
  }

  /**
   * Saves state to history (last N versions)
   * @param {string} docId - Document ID
   * @param {Object} state - State to save
   */
  function saveToHistory(docId, state) {
    const historyKey = STORAGE_KEYS.HISTORY + '_' + docId;
    let history = adapter.get(historyKey) || [];
    
    history.push({
      state,
      timestamp: Date.now(),
      version: state.version || 0
    });

    // Keep only last 10 versions
    if (history.length > 10) {
      history = history.slice(-10);
    }

    adapter.set(historyKey, history);
  }

  /**
   * Gets document history
   * @param {string} docId - Document ID
   * @returns {Array} History entries
   */
  function getHistory(docId) {
    const historyKey = STORAGE_KEYS.HISTORY + '_' + docId;
    return adapter.get(historyKey) || [];
  }

  /**
   * Restores from history
   * @param {string} docId - Document ID
   * @param {number} index - History index
   * @returns {Object|null} Restored state
   */
  function restoreFromHistory(docId, index) {
    const history = getHistory(docId);
    if (index < 0 || index >= history.length) return null;
    return history[index].state;
  }

  return {
    saveDocument,
    loadDocument,
    deleteDocument,
    getDocumentMeta,
    getHistory,
    restoreFromHistory
  };
}

/**
 * Creates a settings storage manager
 * @param {Object} adapter - Storage adapter
 * @returns {Object} Settings storage manager
 */
export function createSettingsStorage(adapter) {
  const key = STORAGE_KEYS.SETTINGS;

  const defaults = {
    theme: 'system',
    autoSave: true,
    autoSaveInterval: 5000,
    maxPeers: 10,
    notificationsEnabled: true
  };

  /**
   * Gets all settings
   * @returns {Object} Settings object
   */
  function getSettings() {
    const stored = adapter.get(key);
    return { ...defaults, ...stored };
  }

  /**
   * Gets a single setting
   * @param {string} name - Setting name
   * @returns {any} Setting value
   */
  function getSetting(name) {
    const settings = getSettings();
    return settings[name];
  }

  /**
   * Sets a single setting
   * @param {string} name - Setting name
   * @param {any} value - Setting value
   * @returns {boolean} Success status
   */
  function setSetting(name, value) {
    const settings = getSettings();
    settings[name] = value;
    return adapter.set(key, settings);
  }

  /**
   * Sets multiple settings
   * @param {Object} newSettings - Settings to merge
   * @returns {boolean} Success status
   */
  function setSettings(newSettings) {
    const settings = getSettings();
    Object.assign(settings, newSettings);
    return adapter.set(key, settings);
  }

  /**
   * Resets settings to defaults
   * @returns {boolean} Success status
   */
  function resetSettings() {
    return adapter.set(key, { ...defaults });
  }

  /**
   * Gets default settings
   * @returns {Object} Default settings
   */
  function getDefaults() {
    return { ...defaults };
  }

  return {
    getSettings,
    getSetting,
    setSetting,
    setSettings,
    resetSettings,
    getDefaults
  };
}
