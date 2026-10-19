import path from 'path';
import { Script } from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleGeminiApiMiddleware } from './server/api';
import { upgradeLive } from './api/gemini/live';

function vertexAiApiPlugin(): Plugin {
  return {
    name: 'vertex-ai-api-plugin',
    configureServer(server) {
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.split('?')[0] === '/api/gemini/live') upgradeLive(req, socket, head);
      });
      server.middlewares.use((req, res, next) => {
        handleGeminiApiMiddleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url?.split('?')[0] === '/api/gemini/live') upgradeLive(req, socket, head);
      });
      server.middlewares.use((req, res, next) => {
        handleGeminiApiMiddleware(req, res, next);
      });
    },
  };
}

function offlineShellPlugin(): Plugin {
  return {
    name: 'offline-shell-assets',
    apply: 'build',
    writeBundle(options, bundle) {
      const assets = Object.keys(bundle).filter(file => /\.(js|css)$/.test(file)).map(file => `/${file}`);
      const worker = readFileSync('public/sw.js', 'utf8').replace('/* BUILD_ASSETS */ []', JSON.stringify(assets));
      new Script(worker); // Fail the build if injected worker code is invalid.
      writeFileSync(path.join(options.dir || 'dist', 'sw.js'), worker);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Only the VITE_ prefix is public; credentials stay in the Node process.
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('VITE_') && process.env[key] === undefined) process.env[key] = value;
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    preview: {
      headers: Object.fromEntries(JSON.parse(readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf8')).headers[0].headers.map(({ key, value }: { key: string; value: string }) => [key, value])),
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), vertexAiApiPlugin(), offlineShellPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('commonjsHelpers')) return 'vendor-other';
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('@google/genai')) {
                return 'vendor-genai';
              }
              return 'vendor-other';
            }
          },
        },
      },
    }
  };
});
