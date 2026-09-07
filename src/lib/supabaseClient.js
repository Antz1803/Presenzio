import { createClient } from '@supabase/supabase-js'

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "")
const supabaseUrl = import.meta.env.DEV && typeof window !== "undefined"
  ? `${window.location.origin}/supabase`
  : configuredSupabaseUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isTransientFetchError(error) {
  return error?.name === "TypeError" && /failed to fetch/i.test(error.message || "")
}

async function fetchWithRetry(input, init) {
  let lastError

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(input, init)
    } catch (error) {
      lastError = error
      if (!isTransientFetchError(error) || attempt === 2) throw error
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }

  throw lastError
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: fetchWithRetry },
    })
  : null

