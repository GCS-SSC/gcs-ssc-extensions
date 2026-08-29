import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import { createExtensionTestUiRuntime } from '../../src/testing'
import {
  buildExtensionApiPath,
  buildHostApiPath,
  clearExtensionUiRuntime,
  createExtensionApiClient,
  createHostApiClient,
  createHostLifecycleApiClient,
  ExtensionCompletionSection,
  ExtensionStatusSelect,
  ExtensionWorkflowSection,
  setExtensionUiRuntime,
  useExtensionApi,
  useExtensionConfirmDialog,
  useExtensionFetch,
  useExtensionGroupedTableExpansion,
  useExtensionI18n,
  useExtensionToast,
  useHostApi,
  useHostLifecycleApi
} from '../../src/ui'
import type {
  GcsExtensionFetchResult,
  GcsGroupedTableExpandedState,
  GcsGroupedTableExpansionResult
} from '../../src/ui'

describe('extension SDK API clients', () => {
  afterEach(() => vi.unstubAllGlobals())

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

  it('exposes typed host lifecycle requests without extension-owned URL assembly', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [] })
    })) as unknown as typeof fetch
    const lifecycle = createHostLifecycleApiClient({ fetch: fetcher })

    await lifecycle.getAvailableStandardWorkflows('sample:case', '42')
    await lifecycle.startStandardWorkflow({
      entityType: 'sample:case',
      entityId: '42',
      workflowSetupId: 'setup-1'
    })

    expect(vi.mocked(fetcher).mock.calls[0]?.[0])
      .toBe('/api/workflows/available?entityType=sample%3Acase&entityId=42')
    expect(vi.mocked(fetcher).mock.calls[1]?.[0]).toBe('/api/workflows/start')
    expect(JSON.parse(String((vi.mocked(fetcher).mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      entityType: 'sample:case',
      entityId: '42',
      workflowSetupId: 'setup-1',
      purpose: 'standard'
    })
  })

  it('executes every extension and host client method with normalized query and bodies', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })) as unknown as typeof fetch
    const extension = createExtensionApiClient({
      extensionKey: 'sample-extension',
      basePath: '/v1',
      fetch: fetcher
    })
    expect(extension.path('/items', { enabled: true, tags: 'one,two', empty: undefined }))
      .toBe('/api/extensions/sample-extension/v1/items?enabled=true&tags=one%2Ctwo')
    await extension.get('/items')
    await extension.post('/items', { name: 'created' })
    await extension.put('/items/1', { name: 'put' })
    await extension.patch('/items/1', { name: 'patch' })
    await extension.delete('/items/1', { body: { reason: 'delete' } })

    const host = createHostApiClient({ fetch: fetcher })
    await host.post('/api/items', { name: 'created' })
    await host.put('/api/items/1', { name: 'put' })
    await host.patch('/api/items/1', { name: 'patch' })
    await host.delete('/api/items/1', { body: { reason: 'delete' } })
    expect(fetcher).toHaveBeenCalledTimes(9)
  })

  it('surfaces failed and malformed successful JSON responses', async () => {
    const failedFetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Denied' }), {
      status: 403,
      headers: { 'content-type': 'application/json' }
    })) as unknown as typeof fetch
    await expect(createHostApiClient({ fetch: failedFetch }).get('/api/denied'))
      .rejects.toMatchObject({ message: 'Denied' })

    const malformedFetch = vi.fn(async () => new Response('not-json', { status: 200 })) as unknown as typeof fetch
    await expect(createHostApiClient({ fetch: malformedFetch }).get('/api/malformed'))
      .rejects.toBeInstanceOf(SyntaxError)
  })

  it('executes completion lifecycle calls and global convenience clients', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof fetch
    const lifecycle = createHostLifecycleApiClient({ fetch: fetcher })
    await lifecycle.getCompletion('sample:case', '1')
    await lifecycle.complete({ entityType: 'sample:case', entityId: '1', comments: 'Complete' })
    await lifecycle.getAvailableStandardWorkflows('sample:case', '1')
    await lifecycle.startStandardWorkflow({ entityType: 'sample:case', entityId: '1', workflowSetupId: '2' })

    vi.stubGlobal('fetch', fetcher)
    await useExtensionApi('sample-extension').get('/health')
    await useHostApi().get('/api/health')
    await useHostLifecycleApi().getCompletion('sample:case', '1')
    expect(fetcher).toHaveBeenCalledTimes(7)
  })
})

describe('extension SDK UI runtime adapters', () => {
  it('exposes the host status selector through the public UI runtime', () => {
    const runtime = createExtensionTestUiRuntime()
    setExtensionUiRuntime(runtime)

    expect(ExtensionStatusSelect).toBeTruthy()
    expect(ExtensionCompletionSection).toBeTruthy()
    expect(ExtensionWorkflowSection).toBeTruthy()
    expect(runtime.components.CommonCompletionSection).toBeTruthy()
    expect(runtime.components.CommonWorkflowSection).toBeTruthy()
    expect(runtime.components.CommonStatusSelect).toBeTruthy()

    clearExtensionUiRuntime()
  })

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

  it('forwards i18n and toast composables from the installed runtime', () => {
    const runtime = createExtensionTestUiRuntime()
    const add = vi.fn()
    runtime.composables.useToast = () => ({ add })
    setExtensionUiRuntime(runtime)

    expect(useExtensionI18n().t('key')).toBe('key')
    useExtensionToast().add({ title: 'Saved' })
    expect(add).toHaveBeenCalledWith({ title: 'Saved' })
    clearExtensionUiRuntime()
    expect(() => useExtensionI18n()).toThrow('runtime is not installed')
  })
})
