import { vi } from 'vitest'

vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto')
  return {
    ...actual,
    randomBytes: vi.fn((size) => Buffer.alloc(size, 'a'))
  }
})

global.localStorage = {
  store: {},
  getItem: vi.fn((key) => global.localStorage.store[key] || null),
  setItem: vi.fn((key, value) => { global.localStorage.store[key] = value }),
  removeItem: vi.fn((key) => { delete global.localStorage.store[key] }),
  clear: vi.fn(() => { global.localStorage.store = {} })
}

global.window = {
  location: {
    pathname: '/w/test-workspace-id'
  }
}
