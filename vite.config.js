/* global process */
import dns from 'node:dns'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

dns.setDefaultResultOrder('ipv4first')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, "")
  const lanServerUrl = env.VITE_LAN_SERVER_URL || "http://localhost:3000"

  return {
    plugins: [
      tailwindcss(),
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler", { target: "19" }]],
        },
      }),
    ],
    server: supabaseUrl
      ? {
          proxy: {
            "/api": {
              target: lanServerUrl,
              changeOrigin: true,
              secure: false,
            },
            "/supabase": {
              target: supabaseUrl,
              changeOrigin: true,
              secure: true,
              ws: true,
              rewrite: (path) => path.replace(/^\/supabase/, ""),
            },
          },
        }
      : undefined,
  }
})