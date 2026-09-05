import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleGeminiApiMiddleware } from './server/api';

function vertexAiApiPlugin(): Plugin {
  return {
    name: 'vertex-ai-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleGeminiApiMiddleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        handleGeminiApiMiddleware(req, res, next);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Populate server-side Google Cloud environment variables from .env if defined
  if (env.GOOGLE_CLOUD_PROJECT && !process.env.GOOGLE_CLOUD_PROJECT) {
    process.env.GOOGLE_CLOUD_PROJECT = env.GOOGLE_CLOUD_PROJECT;
  }
  if (env.GOOGLE_CLOUD_LOCATION && !process.env.GOOGLE_CLOUD_LOCATION) {
    process.env.GOOGLE_CLOUD_LOCATION = env.GOOGLE_CLOUD_LOCATION;
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), vertexAiApiPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
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
