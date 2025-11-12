// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import inject from '@rollup/plugin-inject';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'fs';
import path from 'path';

// ✅ mkcert-generated certificate names
const CERT_BASENAME = 'localhost+3';
const CERT_DIR = path.resolve(__dirname, 'certs');
const CERT_PATH = path.join(CERT_DIR, `${CERT_BASENAME}.pem`);
const KEY_PATH = path.join(CERT_DIR, `${CERT_BASENAME}-key.pem`);

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      protocolImports: true
    }),
    inject({
      Buffer: ['buffer', 'Buffer'],
      process: ['process', 'process']
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH)
    }
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser'
    }
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_DEBUG': 'false',
    'process': JSON.stringify({
      env: {},
      browser: true,
      version: 'v1.0.0',
      platform: 'browser'
    })
  }
});
