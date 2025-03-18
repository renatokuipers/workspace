// openmanus/client/vite.config.ts
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
        configure: (proxy, _options) => {
          console.log('Configuring WebSocket proxy');

          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy server error:', err);
          });

          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`Proxying request: ${req.method} ${req.url}`);
          });

          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(`Proxy response: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
          });

          proxy.on('open', () => {
            console.log('WebSocket connection opened through proxy');
          });

          proxy.on('close', (req, socket, head) => {
            console.log('WebSocket connection closed through proxy', {
              bytesRead: socket.bytesRead,
              bytesWritten: socket.bytesWritten,
              readyState: socket.readyState
            });
          });
        }
      }
    },
    allowedHosts: [
      'localhost',
      '.deployments.pythagora.ai'
    ],
  },
})