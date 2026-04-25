import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'server/services/**/*.ts',
        'server/validation/**/*.ts',
        'server/handlers/**/*.ts',
        'server/utils/**/*.ts',
        'server/yjs-utils.ts',
        'client/src/utils/**/*.ts'
      ],
      exclude: [
        'node_modules/**',
        'tests/**',
        'client/src/utils/fabricArrow.ts'
      ]
    }
  }
})
