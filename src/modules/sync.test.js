/**
 * Sync Module Tests
 */

import { jest } from '@jest/globals';

import {
  encodeUpdate,
  decodeUpdate,
  createSyncManager,
  createStreamHandler,
  SyncEvent
} from './sync.js';

describe('Sync Module', () => {
  describe('encodeUpdate / decodeUpdate', () => {
    test('should encode and decode object correctly', () => {
      const original = { text: 'hello', version: 1 };
      const encoded = encodeUpdate(original);
      const decoded = decodeUpdate(encoded);
      
      expect(decoded).toEqual(original);
    });

    test('should handle complex objects', () => {
      const original = {
        text: 'test',
        chunks: [{ content: 'a', timestamp: 123 }],
        nested: { deep: { value: true } }
      };
      const encoded = encodeUpdate(original);
      const decoded = decodeUpdate(encoded);
      
      expect(decoded).toEqual(original);
    });

    test('should produce Uint8Array', () => {
      const encoded = encodeUpdate({ test: true });
      // Check for ArrayBuffer backing and proper structure
      expect(encoded.constructor.name).toBe('Uint8Array');
      expect(encoded.buffer.constructor.name).toBe('ArrayBuffer');
    });
  });

  describe('SyncEvent', () => {
    test('should have all event types', () => {
      expect(SyncEvent.UPDATE).toBe('update');
      expect(SyncEvent.SNAPSHOT).toBe('snapshot');
      expect(SyncEvent.TEXT_CHANGE).toBe('text-change');
    });
  });

  describe('createSyncManager', () => {
    let syncManager;

    beforeEach(() => {
      syncManager = createSyncManager();
    });

    describe('initial state', () => {
      test('should start with empty text', () => {
        expect(syncManager.getText()).toBe('');
      });

      test('should start with version 0', () => {
        expect(syncManager.getVersion()).toBe(0);
      });

      test('should start with no chunks', () => {
        expect(syncManager.getChunkCount()).toBe(0);
      });
    });

    describe('appendText', () => {
      test('should append text correctly', () => {
        syncManager.appendText('Hello');
        expect(syncManager.getText()).toBe('Hello');
      });

      test('should append multiple times', () => {
        syncManager.appendText('Hello');
        syncManager.appendText(' World');
        expect(syncManager.getText()).toBe('Hello World');
      });

      test('should increment version on append', () => {
        syncManager.appendText('a');
        expect(syncManager.getVersion()).toBe(1);
        syncManager.appendText('b');
        expect(syncManager.getVersion()).toBe(2);
      });

      test('should add chunks on append', () => {
        syncManager.appendText('a');
        syncManager.appendText('b');
        expect(syncManager.getChunkCount()).toBe(2);
      });

      test('should throw on non-string input', () => {
        expect(() => syncManager.appendText(123)).toThrow(TypeError);
        expect(() => syncManager.appendText(null)).toThrow(TypeError);
      });

      test('should call onTextChange callback', () => {
        const onTextChange = jest.fn();
        const manager = createSyncManager({ onTextChange });
        
        manager.appendText('test');
        
        expect(onTextChange).toHaveBeenCalledWith('test');
      });
    });

    describe('setText', () => {
      test('should set text completely', () => {
        syncManager.setText('New text');
        expect(syncManager.getText()).toBe('New text');
      });

      test('should replace existing text', () => {
        syncManager.appendText('Old');
        syncManager.setText('New');
        expect(syncManager.getText()).toBe('New');
      });

      test('should reset chunks to one', () => {
        syncManager.appendText('a');
        syncManager.appendText('b');
        syncManager.setText('new');
        expect(syncManager.getChunkCount()).toBe(1);
      });

      test('should throw on non-string input', () => {
        expect(() => syncManager.setText(123)).toThrow(TypeError);
      });
    });

    describe('getState', () => {
      test('should return state copy', () => {
        syncManager.appendText('test');
        const state = syncManager.getState();
        
        expect(state.text).toBe('test');
        expect(state.version).toBe(1);
        expect(state.chunks).toHaveLength(1);
      });

      test('should not allow mutation of internal state', () => {
        syncManager.appendText('test');
        const state = syncManager.getState();
        state.text = 'modified';
        
        expect(syncManager.getText()).toBe('test');
      });
    });

    describe('createSnapshot / applySnapshot', () => {
      test('should create snapshot that can be applied', () => {
        syncManager.appendText('Hello');
        syncManager.appendText(' World');
        
        const snapshot = syncManager.createSnapshot();
        
        const newManager = createSyncManager();
        newManager.applySnapshot(snapshot);
        
        expect(newManager.getText()).toBe('Hello World');
      });

      test('should only apply newer snapshots', () => {
        syncManager.appendText('a');
        syncManager.appendText('b');
        syncManager.appendText('c');
        
        const olderManager = createSyncManager();
        olderManager.appendText('x');
        const olderSnapshot = olderManager.createSnapshot();
        
        syncManager.applySnapshot(olderSnapshot);
        
        // Should not apply because version is lower
        expect(syncManager.getText()).toBe('abc');
      });
    });

    describe('applyUpdate', () => {
      test('should apply append update', () => {
        syncManager.applyUpdate({ type: 'append', text: 'Hello' });
        expect(syncManager.getText()).toBe('Hello');
      });

      test('should apply set update', () => {
        syncManager.appendText('existing');
        syncManager.applyUpdate({ type: 'set', text: 'new' });
        expect(syncManager.getText()).toBe('new');
      });

      test('should handle unknown update type', () => {
        const state = syncManager.applyUpdate({ type: 'unknown' });
        expect(state.text).toBe('');
      });
    });

    describe('merge', () => {
      test('should merge newer remote state', () => {
        syncManager.appendText('local');
        
        const remoteState = {
          text: 'remote',
          chunks: [],
          version: 10,
          lastUpdated: Date.now()
        };
        
        syncManager.merge(remoteState);
        
        expect(syncManager.getText()).toBe('remote');
      });

      test('should not merge older remote state', () => {
        syncManager.appendText('local');
        syncManager.appendText('more');
        
        const remoteState = {
          text: 'remote',
          chunks: [],
          version: 1,
          lastUpdated: Date.now() - 10000
        };
        
        syncManager.merge(remoteState);
        
        expect(syncManager.getText()).toBe('localmore');
      });

      test('should handle same version with newer timestamp', () => {
        syncManager.appendText('local');
        
        const remoteState = {
          text: 'remote',
          chunks: [],
          version: 1,
          lastUpdated: Date.now() + 1000
        };
        
        syncManager.merge(remoteState);
        
        expect(syncManager.getText()).toBe('remote');
      });

      test('should handle null/invalid input', () => {
        syncManager.appendText('test');
        const state = syncManager.merge(null);
        expect(state.text).toBe('test');
      });
    });

    describe('reset', () => {
      test('should reset all state', () => {
        syncManager.appendText('some text');
        syncManager.reset();
        
        expect(syncManager.getText()).toBe('');
        expect(syncManager.getVersion()).toBe(0);
        expect(syncManager.getChunkCount()).toBe(0);
      });
    });

    describe('observe', () => {
      test('should notify observers on text change', () => {
        const observer = jest.fn();
        syncManager.observe(observer);
        
        syncManager.appendText('test');
        
        expect(observer).toHaveBeenCalledWith(
          SyncEvent.TEXT_CHANGE,
          { text: 'test', fullText: 'test' }
        );
      });

      test('should allow unsubscribe', () => {
        const observer = jest.fn();
        const unsubscribe = syncManager.observe(observer);
        
        unsubscribe();
        syncManager.appendText('test');
        
        expect(observer).not.toHaveBeenCalled();
      });
    });
  });

  describe('createStreamHandler', () => {
    let syncManager;
    let connectionManager;
    let streamHandler;

    beforeEach(() => {
      syncManager = createSyncManager();
      connectionManager = {
        broadcast: jest.fn()
      };
      streamHandler = createStreamHandler(syncManager, connectionManager);
    });

    test('should start inactive', () => {
      expect(streamHandler.isActive()).toBe(false);
    });

    test('should start with zero token count', () => {
      expect(streamHandler.getTokenCount()).toBe(0);
    });

    describe('startStream', () => {
      test('should activate streaming', () => {
        streamHandler.startStream();
        expect(streamHandler.isActive()).toBe(true);
      });

      test('should reset sync manager', () => {
        syncManager.appendText('existing');
        streamHandler.startStream();
        expect(syncManager.getText()).toBe('');
      });
    });

    describe('stopStream', () => {
      test('should deactivate streaming', () => {
        streamHandler.startStream();
        streamHandler.stopStream();
        expect(streamHandler.isActive()).toBe(false);
      });
    });

    describe('onToken', () => {
      test('should ignore tokens when not streaming', () => {
        streamHandler.onToken('test');
        expect(syncManager.getText()).toBe('');
      });

      test('should process tokens when streaming', () => {
        streamHandler.startStream();
        streamHandler.onToken('Hello');
        streamHandler.onToken(' World');
        
        expect(syncManager.getText()).toBe('Hello World');
      });

      test('should increment token count', () => {
        streamHandler.startStream();
        streamHandler.onToken('a');
        streamHandler.onToken('b');
        
        expect(streamHandler.getTokenCount()).toBe(2);
      });

      test('should broadcast to peers', () => {
        streamHandler.startStream();
        streamHandler.onToken('test');
        
        expect(connectionManager.broadcast).toHaveBeenCalledWith({
          type: 'append',
          text: 'test',
          tokenIndex: 1
        });
      });
    });

    test('should work without connection manager', () => {
      const handlerNoConn = createStreamHandler(syncManager, null);
      handlerNoConn.startStream();
      
      expect(() => handlerNoConn.onToken('test')).not.toThrow();
      expect(syncManager.getText()).toBe('test');
    });
  });
});
