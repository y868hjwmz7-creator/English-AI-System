
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ envDir: "/tmp/eas-res-PaGcnV", cacheDir: "/tmp/eas-res-PaGcnV/vite", plugins:[react()], server:{ port:5181, strictPort:true } })
