import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The server's CORS default only allows this port, so fail instead of picking another.
  server: { port: 5173, strictPort: true },
});
