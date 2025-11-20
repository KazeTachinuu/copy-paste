import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load only VITE_* prefixed env variables for security
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          // No rewrite needed - backend expects /api prefix
        },
      },
    },
    define: {
      // Make env variables available to the app
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || '/api'
      ),
    },
  };
});
