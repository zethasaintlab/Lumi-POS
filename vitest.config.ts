import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

// Load .env.local so tests can reach the linked Supabase project.
config({ path: '.env.local' })

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
