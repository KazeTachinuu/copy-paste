import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          list: resolve(__dirname, 'list.html'),
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || '/api'
      ),
    },
  };
});
