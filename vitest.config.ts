import { defineConfig } from 'vitest/config'

export const EXTENSION_SDK_COVERAGE_INCLUDE = [
  'src/audit-ownership.ts',
  'src/index.ts',
  'src/messages.ts',
  'src/nuxt.ts',
  'src/server.ts',
  'src/testing.ts',
  'src/ui.ts'
]

export const EXTENSION_SDK_COVERAGE_THRESHOLDS = {
  lines: 80,
  functions: 80,
  branches: 80,
  statements: 80
} as const

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      reportsDirectory: 'coverage/unit',
      include: EXTENSION_SDK_COVERAGE_INCLUDE,
      thresholds: EXTENSION_SDK_COVERAGE_THRESHOLDS
    }
  }
})
