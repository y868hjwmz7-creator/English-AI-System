import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ envDir: "/tmp/eas-4-2aCLH2", cacheDir: "/tmp/eas-4-2aCLH2/vite", plugins: [react()], server: { port: 5240, strictPort: true } })
