import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist47", assetsInlineLimit: 10000000, rollupOptions: { output: { format: 'iife', entryFileNames: 'app.js', assetFileNames: 'app.[ext]' } } }
})
