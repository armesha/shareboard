import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: './client',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './client/src')
    }
  },
  optimizeDeps: {
    include: [
      '@mui/icons-material/Delete',
      '@mui/icons-material/Create',
      '@mui/icons-material/TextFields',
      '@mui/icons-material/Mouse',
      '@mui/icons-material/Computer',
      '@mui/icons-material/Lock',
      '@mui/icons-material/Home',
      '@mui/icons-material/CropSquare',
      '@mui/icons-material/ChangeHistory',
      '@mui/icons-material/CircleOutlined',
      '@mui/icons-material/HorizontalRule',
      '@mui/icons-material/ArrowRightAlt',
      '@mui/icons-material/Add',
      '@mui/icons-material/Remove',
      '@mui/icons-material/HelpOutline',
      '@mui/icons-material/Share',
      '@mui/icons-material/Download',
      '@mui/icons-material/ExitToApp',
      '@mui/icons-material/ExpandMore'
    ],
    force: true
  }
});
