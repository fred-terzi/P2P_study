/**
 * Storage Module Tests
 */

import { jest } from '@jest/globals';

import {
  createStorageAdapter,
  createSessionStorage,
  createDocumentStorage,
  createSettingsStorage,
  STORAGE_KEYS
} from './storage.js';

describe('Storage Module', () => {
  describe('STORAGE_KEYS', () => {
    test('should have all required keys', () => {
      expect(STORAGE_KEYS.SESSION).toBe('p2p_session');
      expect(STORAGE_KEYS.DOCUMENT).toBe('p2p_document');
      expect(STORAGE_KEYS.SETTINGS).toBe('p2p_settings');
      expect(STORAGE_KEYS.HISTORY).toBe('p2p_history');
    });
  });

  describe('createStorageAdapter', () => {
    describe('with in-memory backend', () => {
      let adapter;

      beforeEach(() => {
        adapter = createStorageAdapter(null);
      });

      test('should set and get values', () => {
        adapter.set('key', { test: 'value' });
        expect(adapter.get('key')).toEqual({ test: 'value' });
      });

      test('should return null for missing keys', () => {
        expect(adapter.get('nonexistent')).toBeNull();
      });

      test('should remove values', () => {
        adapter.set('key', 'value');
        adapter.remove('key');
        expect(adapter.get('key')).toBeNull();
      });

      test('should clear all values', () => {
        adapter.set('key1', 'value1');
        adapter.set('key2', 'value2');
        adapter.clear();
        expect(adapter.get('key1')).toBeNull();
        expect(adapter.get('key2')).toBeNull();
      });

      test('should check existence with has', () => {
        adapter.set('key', 'value');
        expect(adapter.has('key')).toBe(true);
        expect(adapter.has('nonexistent')).toBe(false);
      });

      test('should handle complex objects', () => {
        const complex = {
          nested: { deep: { value: 'test' } },
          array: [1, 2, 3],
          number: 42
        };
        adapter.set('complex', complex);
        expect(adapter.get('complex')).toEqual(complex);
      });
    });

    describe('with custom backend', () => {
      test('should use provided backend', () => {
        const mockBackend = {
          getItem: jest.fn(() => JSON.stringify({ test: true })),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn()
        };

        const adapter = createStorageAdapter(mockBackend);
        adapter.get('key');

        expect(mockBackend.getItem).toHaveBeenCalledWith('key');
      });

      test('should handle getItem returning invalid JSON', () => {
        const mockBackend = {
          getItem: jest.fn(() => 'invalid json'),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn()
        };

        const adapter = createStorageAdapter(mockBackend);
        expect(adapter.get('key')).toBeNull();
      });

      test('should return false on setItem error', () => {
        const mockBackend = {
          getItem: jest.fn(),
          setItem: jest.fn(() => { throw new Error('Storage full'); }),
          removeItem: jest.fn(),
          clear: jest.fn()
        };

        const adapter = createStorageAdapter(mockBackend);
        expect(adapter.set('key', 'value')).toBe(false);
      });

      test('should return false on removeItem error', () => {
        const mockBackend = {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn(() => { throw new Error('Error'); }),
          clear: jest.fn()
        };

        const adapter = createStorageAdapter(mockBackend);
        expect(adapter.remove('key')).toBe(false);
      });

      test('should return false on clear error', () => {
        const mockBackend = {
          getItem: jest.fn(),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(() => { throw new Error('Error'); })
        };

        const adapter = createStorageAdapter(mockBackend);
        expect(adapter.clear()).toBe(false);
      });
    });
  });

  describe('createSessionStorage', () => {
    let adapter;
    let sessionStorage;

    beforeEach(() => {
      adapter = createStorageAdapter(null);
      sessionStorage = createSessionStorage(adapter);
    });

    describe('saveSession', () => {
      test('should save session data', () => {
        const result = sessionStorage.saveSession('session-1', { roomId: 'room-1' });
        expect(result).toBe(true);
      });

      test('should add metadata to saved session', () => {
        sessionStorage.saveSession('session-1', { roomId: 'room-1' });
        const loaded = sessionStorage.loadSession('session-1');
        
        expect(loaded.id).toBe('session-1');
        expect(loaded.savedAt).toBeDefined();
      });

      test('should throw on missing session ID', () => {
        expect(() => sessionStorage.saveSession(null, {})).toThrow('Session ID is required');
        expect(() => sessionStorage.saveSession('', {})).toThrow('Session ID is required');
      });

      test('should throw on non-string session ID', () => {
        expect(() => sessionStorage.saveSession(123, {})).toThrow('Session ID is required');
      });
    });

    describe('loadSession', () => {
      test('should load saved session', () => {
        sessionStorage.saveSession('session-1', { roomId: 'room-1', data: 'test' });
        const loaded = sessionStorage.loadSession('session-1');
        
        expect(loaded.roomId).toBe('room-1');
        expect(loaded.data).toBe('test');
      });

      test('should return null for missing session', () => {
        expect(sessionStorage.loadSession('nonexistent')).toBeNull();
      });

      test('should return null for null/undefined ID', () => {
        expect(sessionStorage.loadSession(null)).toBeNull();
        expect(sessionStorage.loadSession(undefined)).toBeNull();
      });
    });

    describe('deleteSession', () => {
      test('should delete session', () => {
        sessionStorage.saveSession('session-1', { data: 'test' });
        const result = sessionStorage.deleteSession('session-1');
        
        expect(result).toBe(true);
        expect(sessionStorage.loadSession('session-1')).toBeNull();
      });

      test('should return false for null ID', () => {
        expect(sessionStorage.deleteSession(null)).toBe(false);
      });
    });

    describe('hasSession', () => {
      test('should return true for existing session', () => {
        sessionStorage.saveSession('session-1', { data: 'test' });
        expect(sessionStorage.hasSession('session-1')).toBe(true);
      });

      test('should return false for missing session', () => {
        expect(sessionStorage.hasSession('nonexistent')).toBe(false);
      });

      test('should return false for null ID', () => {
        expect(sessionStorage.hasSession(null)).toBe(false);
      });
    });

    describe('getAllSessionIds', () => {
      test('should return array', () => {
        const ids = sessionStorage.getAllSessionIds();
        expect(Array.isArray(ids)).toBe(true);
      });
    });
  });

  describe('createDocumentStorage', () => {
    let adapter;
    let docStorage;

    beforeEach(() => {
      adapter = createStorageAdapter(null);
      docStorage = createDocumentStorage(adapter);
    });

    describe('saveDocument', () => {
      test('should save document state', () => {
        const state = { text: 'Hello', version: 1 };
        const result = docStorage.saveDocument('doc-1', state);
        
        expect(result).toBe(true);
      });

      test('should throw on missing doc ID', () => {
        expect(() => docStorage.saveDocument(null, {})).toThrow('Document ID is required');
        expect(() => docStorage.saveDocument('', {})).toThrow('Document ID is required');
      });

      test('should save to history', () => {
        docStorage.saveDocument('doc-1', { text: 'v1', version: 1 });
        docStorage.saveDocument('doc-1', { text: 'v2', version: 2 });
        
        const history = docStorage.getHistory('doc-1');
        expect(history).toHaveLength(2);
      });
    });

    describe('loadDocument', () => {
      test('should load saved document state', () => {
        docStorage.saveDocument('doc-1', { text: 'Hello', version: 1 });
        const state = docStorage.loadDocument('doc-1');
        
        expect(state.text).toBe('Hello');
      });

      test('should return null for missing document', () => {
        expect(docStorage.loadDocument('nonexistent')).toBeNull();
      });

      test('should return null for null ID', () => {
        expect(docStorage.loadDocument(null)).toBeNull();
      });
    });

    describe('deleteDocument', () => {
      test('should delete document', () => {
        docStorage.saveDocument('doc-1', { text: 'test' });
        const result = docStorage.deleteDocument('doc-1');
        
        expect(result).toBe(true);
        expect(docStorage.loadDocument('doc-1')).toBeNull();
      });

      test('should return false for null ID', () => {
        expect(docStorage.deleteDocument(null)).toBe(false);
      });
    });

    describe('getDocumentMeta', () => {
      test('should return metadata without full state', () => {
        docStorage.saveDocument('doc-1', { text: 'Hello', version: 5 });
        const meta = docStorage.getDocumentMeta('doc-1');
        
        expect(meta.id).toBe('doc-1');
        expect(meta.version).toBe(5);
        expect(meta.savedAt).toBeDefined();
        expect(meta.state).toBeUndefined();
      });

      test('should return null for missing document', () => {
        expect(docStorage.getDocumentMeta('nonexistent')).toBeNull();
      });
    });

    describe('history', () => {
      test('should limit history to 10 entries', () => {
        for (let i = 0; i < 15; i++) {
          docStorage.saveDocument('doc-1', { text: `v${i}`, version: i });
        }
        
        const history = docStorage.getHistory('doc-1');
        expect(history).toHaveLength(10);
      });

      test('should return empty array for no history', () => {
        const history = docStorage.getHistory('nonexistent');
        expect(history).toEqual([]);
      });

      test('should restore from history', () => {
        docStorage.saveDocument('doc-1', { text: 'v1', version: 1 });
        docStorage.saveDocument('doc-1', { text: 'v2', version: 2 });
        
        const restored = docStorage.restoreFromHistory('doc-1', 0);
        expect(restored.text).toBe('v1');
      });

      test('should return null for invalid history index', () => {
        docStorage.saveDocument('doc-1', { text: 'v1', version: 1 });
        
        expect(docStorage.restoreFromHistory('doc-1', -1)).toBeNull();
        expect(docStorage.restoreFromHistory('doc-1', 99)).toBeNull();
      });
    });
  });

  describe('createSettingsStorage', () => {
    let adapter;
    let settingsStorage;

    beforeEach(() => {
      adapter = createStorageAdapter(null);
      settingsStorage = createSettingsStorage(adapter);
    });

    describe('getDefaults', () => {
      test('should return default settings', () => {
        const defaults = settingsStorage.getDefaults();
        
        expect(defaults.theme).toBe('system');
        expect(defaults.autoSave).toBe(true);
        expect(defaults.autoSaveInterval).toBe(5000);
        expect(defaults.maxPeers).toBe(10);
        expect(defaults.notificationsEnabled).toBe(true);
      });
    });

    describe('getSettings', () => {
      test('should return defaults when nothing stored', () => {
        const settings = settingsStorage.getSettings();
        expect(settings.theme).toBe('system');
      });

      test('should merge stored settings with defaults', () => {
        settingsStorage.setSetting('theme', 'dark');
        const settings = settingsStorage.getSettings();
        
        expect(settings.theme).toBe('dark');
        expect(settings.autoSave).toBe(true); // default
      });
    });

    describe('getSetting', () => {
      test('should get individual setting', () => {
        expect(settingsStorage.getSetting('theme')).toBe('system');
      });

      test('should get stored setting', () => {
        settingsStorage.setSetting('theme', 'dark');
        expect(settingsStorage.getSetting('theme')).toBe('dark');
      });
    });

    describe('setSetting', () => {
      test('should set individual setting', () => {
        const result = settingsStorage.setSetting('maxPeers', 20);
        
        expect(result).toBe(true);
        expect(settingsStorage.getSetting('maxPeers')).toBe(20);
      });

      test('should preserve other settings', () => {
        settingsStorage.setSetting('theme', 'dark');
        settingsStorage.setSetting('maxPeers', 20);
        
        expect(settingsStorage.getSetting('theme')).toBe('dark');
        expect(settingsStorage.getSetting('maxPeers')).toBe(20);
      });
    });

    describe('setSettings', () => {
      test('should set multiple settings at once', () => {
        settingsStorage.setSettings({
          theme: 'light',
          maxPeers: 5
        });
        
        expect(settingsStorage.getSetting('theme')).toBe('light');
        expect(settingsStorage.getSetting('maxPeers')).toBe(5);
      });
    });

    describe('resetSettings', () => {
      test('should reset to defaults', () => {
        settingsStorage.setSetting('theme', 'dark');
        settingsStorage.setSetting('maxPeers', 99);
        
        settingsStorage.resetSettings();
        
        expect(settingsStorage.getSetting('theme')).toBe('system');
        expect(settingsStorage.getSetting('maxPeers')).toBe(10);
      });
    });
  });
});
