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
        'client/src/utils/**/*.ts',
        'client/src/hooks/**/*.ts'
      ],
      exclude: [
        'node_modules',
        'tests'
      ]
    }
  }
})
