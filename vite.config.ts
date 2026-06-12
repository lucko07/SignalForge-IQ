import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined
          }

          if (
            id.includes("/react/")
            || id.includes("/react-dom/")
            || id.includes("/scheduler/")
          ) {
            return "vendor-react"
          }

          if (
            id.includes("/react-router/")
            || id.includes("/react-router-dom/")
          ) {
            return "vendor-router"
          }

          if (
            id.includes("/firebase/")
            || id.includes("/@firebase/")
          ) {
            return "vendor-firebase"
          }

          if (id.includes("/@stripe/")) {
            return "vendor-stripe"
          }

          if (id.includes("/react-helmet-async/")) {
            return "vendor-helmet"
          }

          return "vendor"
        },
      },
    },
  },
})
