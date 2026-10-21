import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const suppressViteHmrPlugin: Plugin = {
  name: 'suppress-vite-hmr-plugin',
  transformIndexHtml: {
    order: 'pre',
    handler() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `
            (function() {
              const origError = console.error;
              console.error = function(...args) {
                const isWs = args.some(function(arg) {
                  if (!arg) return false;
                  const str = typeof arg === 'string' ? arg : (arg.message || String(arg));
                  if (str.includes('WebSocket') || str.includes('[vite]') || str.includes('vite-hmr')) return true;
                  if (arg.stack && (String(arg.stack).includes('@vite/client') || String(arg.stack).includes('WebSocket'))) return true;
                  return false;
                });
                if (isWs) return;
                origError.apply(console, args);
              };

              const origWarn = console.warn;
              console.warn = function(...args) {
                const isWs = args.some(function(arg) {
                  if (!arg) return false;
                  const str = typeof arg === 'string' ? arg : (arg.message || String(arg));
                  return str.includes('WebSocket') || str.includes('[vite]') || str.includes('vite-hmr');
                });
                if (isWs) return;
                origWarn.apply(console, args);
              };

              window.addEventListener('error', function(e) {
                const msg = e.message || (e.error && e.error.message) || '';
                const src = e.filename || '';
                if (msg.includes('WebSocket') || msg.includes('[vite]') || src.includes('@vite/client')) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                  return true;
                }
              }, true);

              window.addEventListener('unhandledrejection', function(e) {
                const reason = e.reason || '';
                const msg = reason.message || String(reason);
                if (msg.includes('WebSocket') || msg.includes('[vite]')) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
              }, true);

              if (typeof window !== 'undefined' && window.WebSocket && !window._viteWsPatched) {
                window._viteWsPatched = true;
                const OrigWS = window.WebSocket;
                window.WebSocket = function(url, protocols) {
                  const urlStr = String(url || '');
                  const isViteHmr = urlStr.includes('vite-hmr') || protocols === 'vite-hmr' || (Array.isArray(protocols) && protocols.includes('vite-hmr'));
                  if (isViteHmr) {
                    return {
                      readyState: 3,
                      CONNECTING: 0,
                      OPEN: 1,
                      CLOSING: 2,
                      CLOSED: 3,
                      url: urlStr,
                      protocol: 'vite-hmr',
                      extensions: '',
                      bufferedAmount: 0,
                      binaryType: 'blob',
                      send: function() {},
                      close: function() {},
                      addEventListener: function() {},
                      removeEventListener: function() {},
                      dispatchEvent: function() { return false; },
                      onopen: null,
                      onclose: null,
                      onerror: null,
                      onmessage: null,
                    };
                  }
                  return protocols !== undefined ? new OrigWS(url, protocols) : new OrigWS(url);
                };
                window.WebSocket.prototype = OrigWS.prototype;
                window.WebSocket.CONNECTING = OrigWS.CONNECTING;
                window.WebSocket.OPEN = OrigWS.OPEN;
                window.WebSocket.CLOSING = OrigWS.CLOSING;
                window.WebSocket.CLOSED = OrigWS.CLOSED;
              }
            })();
          `,
        },
      ];
    },
  },
};

export default defineConfig(() => {
  return {
    plugins: [
      suppressViteHmrPlugin,
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'Digitale QR-Lernhilfen & Gestufte Tippkarten',
          short_name: 'Lernhilfen',
          description: 'Gestufte Tippkarten per QR-Code für den Schulunterricht',
          theme_color: '#4F46E5',
          background_color: '#312E81',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/tesseract/**', '**/*.traineddata'],
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex@.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'katex-cdn-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
