import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { createExtensionTestUiRuntime } from '../../src/testing'
import {
  buildExtensionApiPath,
  buildHostApiPath,
  clearExtensionUiRuntime,
  createExtensionApiClient,
  createHostApiClient,
  setExtensionUiRuntime,
  useExtensionConfirmDialog,
  useExtensionFetch,
  useExtensionGroupedTableExpansion
} from '../../src/ui'
import type {
  GcsExtensionFetchResult,
  GcsGroupedTableExpandedState,
  GcsGroupedTableExpansionResult
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

describe('extension SDK UI runtime adapters', () => {
  it('preserves undefined Nuxt fetch data and forwards required confirmation options', async () => {
    const runtime = createExtensionTestUiRuntime()
    const confirm = vi.fn(async ({ title }: { title: string }) => title === 'Continue')
    runtime.composables.useConfirmDialog = () => confirm
    runtime.composables.useFetch = () => ({
      data: ref(undefined),
      status: ref('idle'),
      pending: ref(false),
      error: ref(undefined),
      refresh: async () => undefined
    })
    setExtensionUiRuntime(runtime)

    const fetchResult = useExtensionFetch<{ id: string }>('/api/example')
    const confirmed = await useExtensionConfirmDialog()({ title: 'Continue' })

    expect(fetchResult.data.value).toBeUndefined()
    expect(confirmed).toBe(true)
    expect(confirm).toHaveBeenCalledWith({ title: 'Continue' })
    expectTypeOf(fetchResult.data).toEqualTypeOf<Ref<{ id: string } | null | undefined>>()
    expectTypeOf(fetchResult.pending).toEqualTypeOf<Ref<boolean>>()
    expectTypeOf(fetchResult.error).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(fetchResult).toEqualTypeOf<GcsExtensionFetchResult<{ id: string }>>()

    clearExtensionUiRuntime()
  })

  it('forwards TanStack-compatible expanded state without an SDK assertion', () => {
    const runtime = createExtensionTestUiRuntime()
    const baseGroupedTable = runtime.composables.useGroupedTableExpansion
    const updateExpandedRows = vi.fn<(value: GcsGroupedTableExpandedState) => void>()
    runtime.composables.useGroupedTableExpansion = <Row>(options) => ({
      ...baseGroupedTable<Row>(options),
      updateExpandedRows
    })
    setExtensionUiRuntime(runtime)

    const groupedTable = useExtensionGroupedTableExpansion<{ id: string }>({
      rows: [],
      groups: [{ id: 'group', getValue: row => row.id }]
    })
    groupedTable.updateExpandedRows(true)
    groupedTable.updateExpandedRows({ group: false })

    expect(updateExpandedRows).toHaveBeenNthCalledWith(1, true)
    expect(updateExpandedRows).toHaveBeenNthCalledWith(2, { group: false })
    expectTypeOf(groupedTable).toEqualTypeOf<GcsGroupedTableExpansionResult<{ id: string }>>()
    expectTypeOf(groupedTable.updateExpandedRows)
      .parameter(0)
      .toEqualTypeOf<GcsGroupedTableExpandedState>()

    clearExtensionUiRuntime()
  })
})
