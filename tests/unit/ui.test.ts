import { describe, expect, it, vi } from 'vitest'
import {
  buildExtensionApiPath,
  buildHostApiPath,
  createExtensionApiClient,
  createHostApiClient
} from '../../src/ui'

describe('extension SDK API clients', () => {
  it('builds normalized extension and host API paths', () => {
    expect(buildExtensionApiPath('example-extension', 'things', { page: 2, empty: null }))
      .toBe('/api/extensions/example-extension/things?page=2')
    expect(buildHostApiPath('/api/agreements/1', { include: 'lines' }))
      .toBe('/api/agreements/1?include=lines')
    expect(() => buildHostApiPath('/agreements/1')).toThrow('/api/')
  })

  it('serializes JSON requests and accepts empty success responses', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 204,
      text: async () => ''
    })) as unknown as typeof fetch
    const client = createExtensionApiClient({ extensionKey: 'example-extension', fetch: fetcher })

    await expect(client.post('/things', { name: 'Test' })).resolves.toBeUndefined()

    const [url, init] = vi.mocked(fetcher).mock.calls[0] ?? []
    expect(url).toBe('/api/extensions/example-extension/things')
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: 'Test' }))
    expect(new Headers((init as RequestInit).headers).get('content-type')).toBe('application/json')
  })

  it('supports host API requests through the SDK boundary', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [{ id: '1' }] })
    })) as unknown as typeof fetch
    const client = createHostApiClient({ fetch: fetcher })

    await expect(client.get('/api/transfer-payments/1/outcomes')).resolves.toEqual({ items: [{ id: '1' }] })
    expect(vi.mocked(fetcher).mock.calls[0]?.[0]).toBe('/api/transfer-payments/1/outcomes')
  })
})
