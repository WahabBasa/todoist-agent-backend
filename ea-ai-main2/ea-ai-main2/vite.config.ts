import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    hmr: {
      // Reduce HMR aggressiveness to prevent unnecessary reloads
      timeout: 5000,
    },
    // Watch options to reduce file system noise
    watch: {
      // Ignore certain directories to reduce churn
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/convex/_generated/**',
        '**/dist/**',
        '**/.convex/**'
      ],
      // Use polling for Windows file system stability
      usePolling: process.platform === 'win32',
      interval: 1000,
    }
  },
  optimizeDeps: {
    // Prevent frequent re-optimizations that can trigger reloads
    include: [
      'react',
      'react-dom',
      'convex/react',
      '@ai-sdk/react',
      'sonner'
    ],
  },
  build: {
    rollupOptions: {
      // Reduce bundle churn
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          convex: ['convex/react'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    }
  }
});
