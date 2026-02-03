/**
 * Jest Setup File
 * 
 * Global setup for test environment
 */

import { TextEncoder, TextDecoder } from 'util';
import { URL } from 'url';

// Mock crypto.randomUUID for Node.js < 19
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  };
}

// Mock TextEncoder/TextDecoder if not available
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock btoa/atob for Node.js
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'utf-8').toString('base64');
}

if (typeof global.atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('utf-8');
}

// Mock URL if needed
if (typeof global.URL === 'undefined') {
  global.URL = URL;
}
