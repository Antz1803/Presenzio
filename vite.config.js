/* global process */
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, "")

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
