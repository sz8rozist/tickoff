import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 127.0.0.1, nem localhost: a localhost IPv6-ra (::1) is feloldódhat, ahol Windowson a WSL-relay
      // egy másik folyamatot tarthat a 8080-as porton.
      '/api': 'http://127.0.0.1:8080',
      '/actuator': 'http://127.0.0.1:8080',
    },
  },
});
