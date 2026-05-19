/* eslint-disable jsdoc/require-jsdoc */
import { defineComponent, h } from 'vue'
import type { Component, Ref } from 'vue'
import { throwFetchResponseError } from './index'
import type {
  GcsExtensionBilingualLabel,
  GcsExtensionCreateActionMode,
  GcsExtensionCreateOperation,
  GcsClientExtensionManifest,
  ExtensionEntityTabContext,
  GcsExtensionJsonConfig,
  GcsExtensionRbacRequirement,
  JsonValue
} from './index'

export type GcsGroupedTableRow<Row> = {
  id: string
  depth?: number
  groupingColumnId?: string
  original: Row
  subRows?: GcsGroupedTableRow<Row>[]
  leafRows?: GcsGroupedTableRow<Row>[]
  getIsExpanded?: () => boolean
  getIsGrouped?: () => boolean
  toggleExpanded?: () => void
}

export interface GcsGroupedTableExpansionResult<Row> {
  expandedRows: Ref<unknown>
  grouping: Ref<string[]>
  columnVisibility: Ref<Record<string, boolean>>
  groupingOptions: Record<string, unknown>
  getGroupRowId: (row: Row, groupIndex: number) => string
  isGroupedRow: (row: GcsGroupedTableRow<Row>) => boolean
  isGroupRow: (row: GcsGroupedTableRow<Row>, groupColumnId: string) => boolean
  getLeafRows: (row: GcsGroupedTableRow<Row>) => GcsGroupedTableRow<Row>[]
  getGroupedRowCount: (row: GcsGroupedTableRow<Row>) => number
  canExpandGroupedRow: (row: GcsGroupedTableRow<Row>) => boolean
  updateExpandedRows: (value: unknown) => void
}

export interface GcsExtensionI18n {
  locale: Ref<string>
  t: (key: string, values?: Record<string, unknown>) => string
  n: (value: number, options?: Intl.NumberFormatOptions) => string
}

export interface GcsExtensionToast {
  add: (notification: Record<string, unknown>) => void
}

export type GcsExtensionConfirmDialog = (options: Record<string, unknown>) => Promise<boolean>

export interface GcsExtensionFetchResult<T> {
  data: Ref<T | null>
  status: Ref<'idle' | 'pending' | 'success' | 'error'>
  pending?: Ref<boolean>
  error: Ref<unknown>
  refresh: () => Promise<unknown>
}

export type GcsExtensionHostComponentName =
  | 'CommonEntityEditorWorkspace'
  | 'CommonAssessmentSchemaAccordionSection'
  | 'CommonResourceLayoutCard'
  | 'CommonRouteTabs'
  | 'CommonSaveButton'
  | 'CommonSection'
  | 'CommonStatusBadge'
  | 'UAccordion'
  | 'UAlert'
  | 'UBadge'
  | 'UButton'
  | 'UCheckbox'
  | 'UFormField'
  | 'UIcon'
  | 'UInput'
  | 'UInputTags'
  | 'UModal'
  | 'UProgress'
  | 'USelect'
  | 'USelectMenu'
  | 'USwitch'
  | 'UTable'
  | 'UTextarea'
  | 'UTooltip'

export interface GcsExtensionUiRuntime {
  components: Record<GcsExtensionHostComponentName, Component>
  composables: {
    useConfirmDialog: () => GcsExtensionConfirmDialog
    useFetch: <T = unknown>(url: string | (() => string), options?: Record<string, unknown>) => GcsExtensionFetchResult<T>
    useGroupedTableExpansion: <Row>(options: {
      rows: Row[] | Ref<Row[]> | (() => Row[])
      groups: Array<{
        id: string
        getValue: (row: Row) => string
      }>
      isPlaceholder?: (row: Row) => boolean
      defaultExpanded?: boolean
    }) => unknown
    useI18n: () => GcsExtensionI18n
    useToast: () => GcsExtensionToast
  }
}

const uiRuntimeKey = '__gcsExtensionUiRuntime'

const getGlobalUiRuntimeHolder = (): typeof globalThis & {
  __gcsExtensionUiRuntime?: GcsExtensionUiRuntime
} => globalThis as typeof globalThis & {
  __gcsExtensionUiRuntime?: GcsExtensionUiRuntime
}

export const setExtensionUiRuntime = (runtime: GcsExtensionUiRuntime): void => {
  getGlobalUiRuntimeHolder()[uiRuntimeKey] = runtime
}

export const clearExtensionUiRuntime = (): void => {
  delete getGlobalUiRuntimeHolder()[uiRuntimeKey]
}

export const getExtensionUiRuntime = (): GcsExtensionUiRuntime => {
  const runtime = getGlobalUiRuntimeHolder()[uiRuntimeKey]
  if (!runtime) {
    throw new Error(
      'GCS extension UI runtime is not installed. The host app must call setExtensionUiRuntime before rendering extension UI.'
    )
  }

  return runtime
}

const createExtensionHostComponent = (name: GcsExtensionHostComponentName): Component =>
  defineComponent({
    name: `Gcs${name}`,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(getExtensionUiRuntime().components[name], attrs, slots)
    }
  })

export const ExtensionEntityEditorWorkspace = createExtensionHostComponent('CommonEntityEditorWorkspace')
export const ExtensionAssessmentSchemaAccordionSection = createExtensionHostComponent('CommonAssessmentSchemaAccordionSection')
export const ExtensionResourceLayoutCard = createExtensionHostComponent('CommonResourceLayoutCard')
export const ExtensionRouteTabs = createExtensionHostComponent('CommonRouteTabs')
export const ExtensionSaveButton = createExtensionHostComponent('CommonSaveButton')
export const ExtensionSection = createExtensionHostComponent('CommonSection')
export const ExtensionStatusBadge = createExtensionHostComponent('CommonStatusBadge')
export const ExtensionTextarea = createExtensionHostComponent('UTextarea')

export const ExtensionAccordion = createExtensionHostComponent('UAccordion')
export const ExtensionAlert = createExtensionHostComponent('UAlert')
export const ExtensionBadge = createExtensionHostComponent('UBadge')
export const ExtensionButton = createExtensionHostComponent('UButton')
export const ExtensionCheckbox = createExtensionHostComponent('UCheckbox')
export const ExtensionFormField = createExtensionHostComponent('UFormField')
export const ExtensionIcon = createExtensionHostComponent('UIcon')
export const ExtensionInput = createExtensionHostComponent('UInput')
export const ExtensionInputTags = createExtensionHostComponent('UInputTags')
export const ExtensionModal = createExtensionHostComponent('UModal')
export const ExtensionProgress = createExtensionHostComponent('UProgress')
export const ExtensionSelect = createExtensionHostComponent('USelect')
export const ExtensionSelectMenu = createExtensionHostComponent('USelectMenu')
export const ExtensionSwitch = createExtensionHostComponent('USwitch')
export const ExtensionTable = createExtensionHostComponent('UTable')
export const ExtensionRawTextarea = createExtensionHostComponent('UTextarea')
export const ExtensionTooltip = createExtensionHostComponent('UTooltip')

export interface GcsStreamConfigComponentProps {
  extension: GcsClientExtensionManifest
  streamId: string
  transferPaymentId?: string
  agencyId?: string
  streamEnabled?: boolean
  hostLayout?: boolean
}

export interface GcsAgencyConfigComponentProps {
  extension: GcsClientExtensionManifest
  agencyId: string
}

export interface GcsEntityTabComponentProps {
  extensionKey: string
  context: ExtensionEntityTabContext
  config: GcsExtensionJsonConfig
  rbac: GcsExtensionRbacRequirement
}

export interface GcsCreateActionComponentProps extends GcsEntityTabComponentProps {
  operation: GcsExtensionCreateOperation
  agencyId: string
  streamId: string
  agreementId: string
  label: GcsExtensionBilingualLabel
  icon?: string
  mode: GcsExtensionCreateActionMode
  onCreated: () => void
}

export interface GcsPaymentAmountCalculatorComponentProps {
  extensionKey: string
  calculatorId: string
  config: GcsExtensionJsonConfig
  context: {
    agreementId: string
  }
  model: Record<string, unknown>
}

export interface GcsExtensionApiClientOptions {
  extensionKey: string
  basePath?: string
  fetch?: typeof fetch
}

export interface GcsExtensionRequestOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | boolean | null | undefined>
  body?: BodyInit | JsonValue | Record<string, unknown>
}

export const buildExtensionApiPath = (
  extensionKey: string,
  path: string,
  query: GcsExtensionRequestOptions['query'] = {}
): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`/api/extensions/${extensionKey}${normalizedPath}`, 'http://localhost')
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }

  return `${url.pathname}${url.search}`
}

export const buildHostApiPath = (
  path: string,
  query: GcsExtensionRequestOptions['query'] = {}
): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!normalizedPath.startsWith('/api/')) {
    throw new Error('Host API paths must start with /api/.')
  }

  const url = new URL(normalizedPath, 'http://localhost')
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }

  return `${url.pathname}${url.search}`
}

const parseSuccessfulJsonResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T
  }

  if (typeof response.text !== 'function') {
    return await response.json() as T
  }

  const text = await response.text()
  if (!text.trim()) {
    return undefined as T
  }

  return JSON.parse(text) as T
}

const requestJson = async <T>(
  fetcher: typeof fetch,
  url: string,
  requestOptions: GcsExtensionRequestOptions = {}
): Promise<T> => {
  const { query: _query, body, headers, ...init } = requestOptions
  const finalHeaders = new Headers(headers)
  const isJsonBody = body !== undefined && !(body instanceof FormData) && !(body instanceof Blob) && typeof body !== 'string'
  if (isJsonBody && !finalHeaders.has('content-type')) {
    finalHeaders.set('content-type', 'application/json')
  }

  const initWithHeaders: RequestInit = {
    ...init,
    headers: finalHeaders
  }
  if (body !== undefined) {
    initWithHeaders.body = isJsonBody ? JSON.stringify(body) : body as BodyInit
  }

  const response = await fetcher(url, initWithHeaders)
  if (!response.ok) {
    await throwFetchResponseError(response)
  }

  return await parseSuccessfulJsonResponse<T>(response)
}

export const createExtensionApiClient = (options: GcsExtensionApiClientOptions) => {
  const fetcher = options.fetch ?? fetch
  const basePath = options.basePath ?? ''

  const request = async <T>(path: string, requestOptions: GcsExtensionRequestOptions = {}): Promise<T> => {
    const { query = {} } = requestOptions
    const url = buildExtensionApiPath(options.extensionKey, `${basePath}${path}`, query)
    return await requestJson<T>(fetcher, url, requestOptions)
  }

  return {
    path: (path: string, query: GcsExtensionRequestOptions['query'] = {}) => buildExtensionApiPath(options.extensionKey, `${basePath}${path}`, query),
    request,
    get: <T>(path: string, requestOptions: Omit<GcsExtensionRequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...requestOptions, method: 'GET' }),
    post: <T>(path: string, body?: GcsExtensionRequestOptions['body'], requestOptions: Omit<GcsExtensionRequestOptions, 'method' | 'body'> = {}) =>
      body === undefined
        ? request<T>(path, { ...requestOptions, method: 'POST' })
        : request<T>(path, { ...requestOptions, method: 'POST', body }),
    put: <T>(path: string, body?: GcsExtensionRequestOptions['body'], requestOptions: Omit<GcsExtensionRequestOptions, 'method' | 'body'> = {}) =>
      body === undefined
        ? request<T>(path, { ...requestOptions, method: 'PUT' })
        : request<T>(path, { ...requestOptions, method: 'PUT', body }),
    patch: <T>(path: string, body?: GcsExtensionRequestOptions['body'], requestOptions: Omit<GcsExtensionRequestOptions, 'method' | 'body'> = {}) =>
      body === undefined
        ? request<T>(path, { ...requestOptions, method: 'PATCH' })
        : request<T>(path, { ...requestOptions, method: 'PATCH', body }),
    delete: <T>(path: string, requestOptions: Omit<GcsExtensionRequestOptions, 'method'> = {}) =>
      request<T>(path, { ...requestOptions, method: 'DELETE' })
  }
}

export const useExtensionApi = (extensionKey: string) =>
  createExtensionApiClient({ extensionKey })

export const createHostApiClient = (options: { fetch?: typeof fetch } = {}) => {
  const fetcher = options.fetch ?? fetch
  const request = async <T>(path: string, requestOptions: GcsExtensionRequestOptions = {}): Promise<T> => {
    const { query = {} } = requestOptions
    return await requestJson<T>(fetcher, buildHostApiPath(path, query), requestOptions)
  }

  return {
    path: buildHostApiPath,
    request,
    get: <T>(path: string, requestOptions: Omit<GcsExtensionRequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...requestOptions, method: 'GET' }),
    post: <T>(path: string, body?: GcsExtensionRequestOptions['body'], requestOptions: Omit<GcsExtensionRequestOptions, 'method' | 'body'> = {}) =>
      body === undefined
        ? request<T>(path, { ...requestOptions, method: 'POST' })
        : request<T>(path, { ...requestOptions, method: 'POST', body }),
    put: <T>(path: string, body?: GcsExtensionRequestOptions['body'], requestOptions: Omit<GcsExtensionRequestOptions, 'method' | 'body'> = {}) =>
      body === undefined
        ? request<T>(path, { ...requestOptions, method: 'PUT' })
        : request<T>(path, { ...requestOptions, method: 'PUT', body }),
    patch: <T>(path: string, body?: GcsExtensionRequestOptions['body'], requestOptions: Omit<GcsExtensionRequestOptions, 'method' | 'body'> = {}) =>
      body === undefined
        ? request<T>(path, { ...requestOptions, method: 'PATCH' })
        : request<T>(path, { ...requestOptions, method: 'PATCH', body }),
    delete: <T>(path: string, requestOptions: Omit<GcsExtensionRequestOptions, 'method'> = {}) =>
      request<T>(path, { ...requestOptions, method: 'DELETE' })
  }
}

export const useHostApi = () => createHostApiClient()

export const useExtensionI18n = () => getExtensionUiRuntime().composables.useI18n()

export const useExtensionToast = () => getExtensionUiRuntime().composables.useToast()

export const useExtensionFetch = <T = unknown>(
  url: string | (() => string),
  options?: Record<string, unknown>
) => getExtensionUiRuntime().composables.useFetch<T>(url, options)

export const useExtensionConfirmDialog = () => getExtensionUiRuntime().composables.useConfirmDialog()

export const useExtensionGroupedTableExpansion = <Row>(options: {
  rows: Row[] | Ref<Row[]> | (() => Row[])
  groups: Array<{
    id: string
    getValue: (row: Row) => string
  }>
  isPlaceholder?: (row: Row) => boolean
  defaultExpanded?: boolean
}): GcsGroupedTableExpansionResult<Row> =>
  getExtensionUiRuntime().composables.useGroupedTableExpansion<Row>(options) as GcsGroupedTableExpansionResult<Row>
