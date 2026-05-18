export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const FETCH_ERROR_TEXT_LIMIT = 2_000

/**
 * Error thrown for failed browser fetch responses with parsed API payloads.
 */
export class FetchResponseError extends Error {
  /** Parsed response payload. */
  readonly data: unknown
  /** Failed browser response. */
  readonly response: Response

  /**
   * Creates a fetch response error.
   *
   * @param response - Failed browser response.
   * @param data - Parsed response payload.
   */
  constructor(response: Response, data: unknown) {
    const nestedMessage = data && typeof data === 'object' && 'data' in data
      ? (data as { data?: { message?: unknown } }).data?.message
      : undefined
    const flatMessage = data && typeof data === 'object' && 'message' in data
      ? (data as { message?: unknown }).message
      : undefined
    const rawMessage = nestedMessage ?? flatMessage
    const message = rawMessage !== undefined && rawMessage !== null && String(rawMessage).length > 0
      ? String(rawMessage)
      : response.statusText || `HTTP ${response.status}`

    super(message)
    this.name = 'FetchResponseError'
    this.data = data
    this.response = response
  }
}

/**
 * Builds an absolute URL for browser fetch calls while keeping component tests
 * usable in non-window environments.
 *
 * @param path - Relative or absolute request path.
 * @returns URL object suitable for fetch.
 */
export const getClientRequestUrl = (path: string | URL): URL => {
  if (path instanceof URL) {
    return path
  }

  const browserGlobal = globalThis as {
    window?: {
      location?: {
        origin?: string
      }
    }
  }
  const origin = typeof browserGlobal.window?.location?.origin === 'string'
    ? browserGlobal.window.location.origin
    : 'http://localhost'

  return new URL(path, origin)
}

/**
 * Throws a normalized error for failed browser fetch responses.
 *
 * @param response - Failed fetch response.
 * @returns Never returns.
 */
export const throwFetchResponseError = async (response: Response): Promise<never> => {
  let payload: unknown
  try {
    payload = await response.clone().json() as unknown
  } catch {
    payload = undefined
  }

  if (payload !== undefined) {
    throw new FetchResponseError(response, payload)
  }

  const textBody = await response.clone().text().catch(() => '')
  const trimmedTextBody = textBody.trim()
  const truncatedTextBody = trimmedTextBody.length > FETCH_ERROR_TEXT_LIMIT
    ? `${trimmedTextBody.slice(0, FETCH_ERROR_TEXT_LIMIT)}...`
    : trimmedTextBody
  const message = truncatedTextBody.length > 0
    ? truncatedTextBody
    : response.statusText.length > 0
      ? response.statusText
      : `HTTP ${response.status}`
  throw new FetchResponseError(response, {
    data: {
      message
    },
    status: response.status,
    statusText: response.statusText,
    text: truncatedTextBody
  })
}

export type GcsExtensionSlot =
  | 'textarea.after'
  | 'agreement.descriptions.after'
  | 'agreement.profile.classification.fields'
  | 'agreement.profile.profile.fields'
  | 'agreement.profile.risk-management.fields'
  | 'agreement.profile.sections.after'
  | 'proponent.descriptions.after'

export type GcsExtensionRbacAction = 'create' | 'read' | 'update' | 'delete'

export type GcsExtensionRbacSubject =
  | 'all'
  | 'agency'
  | 'transfer_payment'
  | 'role'
  | 'user'
  | 'applicant_recipient'
  | 'agreement'

export interface GcsExtensionRbacRequirement {
  subject: GcsExtensionRbacSubject
  action: GcsExtensionRbacAction
}

export type GcsExtensionEntityTabTarget = 'agreement' | 'proponent' | 'claim' | 'monitor'

export type GcsExtensionCreateOperation =
  | 'agreement.commitments.create'
  | 'agreement.payments.create'

export type GcsExtensionCreateActionMode = 'append' | 'replace'

export interface GcsExtensionBilingualLabel {
  en: string
  fr: string
}

export type GcsTextareaTargetLocale = 'en' | 'fr'

export type GcsTextareaKnownTargetKey =
  | 'agreement.description'
  | 'proponent.description'

export type GcsTextareaTargetKey = GcsTextareaKnownTargetKey | (string & {})

export interface GcsTextareaTargetDefinition {
  key: GcsTextareaKnownTargetKey
  label: Record<GcsTextareaTargetLocale, string>
  description: Record<GcsTextareaTargetLocale, string>
}

export interface GcsTextareaTargetContext {
  kind: GcsTextareaTargetKey
  targetKey?: GcsTextareaTargetKey
  locale: GcsTextareaTargetLocale
  label?: string
  text: string
  streamId?: string
  agencyId?: string
  entityType?: string
  entityId?: string
  ownerType?: string
  ownerId?: string
  extensions?: Record<string, Record<string, unknown>>
  setExtensionPayload?: (extensionKey: string, payloadKey: string, value: unknown) => void
}

export interface GcsTextareaExtensionContext {
  textarea: GcsTextareaTargetContext
}

export const GCS_TEXTAREA_TARGETS: GcsTextareaTargetDefinition[] = [
  {
    key: 'agreement.description',
    label: {
      en: 'Agreement descriptions',
      fr: 'Descriptions d’entente'
    },
    description: {
      en: 'Targets the English and French agreement description fields.',
      fr: 'Cible les champs de description français et anglais de l’entente.'
    }
  },
  {
    key: 'proponent.description',
    label: {
      en: 'Proponent descriptions',
      fr: 'Descriptions de promoteur'
    },
    description: {
      en: 'Targets the English and French proponent description fields.',
      fr: 'Cible les champs de description français et anglais du promoteur.'
    }
  }
]

export interface GcsExtensionComponentDefinition {
  path: string
  name?: string
  componentName?: string
}

export interface GcsExtensionSlotDefinition extends GcsExtensionComponentDefinition {
  slot: GcsExtensionSlot
}

export interface GcsExtensionEntityTabDefinition extends GcsExtensionComponentDefinition {
  target: GcsExtensionEntityTabTarget
  id: string
  label: GcsExtensionBilingualLabel
  icon?: string
  rbac: GcsExtensionRbacRequirement
}

export interface GcsExtensionCreateActionDefinition extends GcsExtensionComponentDefinition {
  operation: GcsExtensionCreateOperation
  id: string
  mode: GcsExtensionCreateActionMode
  label: GcsExtensionBilingualLabel
  icon?: string
  rbac: GcsExtensionRbacRequirement
}

export interface GcsExtensionPaymentAmountCalculatorDefinition extends GcsExtensionComponentDefinition {
  operation: 'agreement.payments.create'
  id: string
  label: GcsExtensionBilingualLabel
  rbac: GcsExtensionRbacRequirement
}

export interface GcsExtensionI18nDefinition {
  en?: string
  fr?: string
}

export interface GcsExtensionAssetDefinition {
  baseURL: string
  path?: string
  package?: string
  packagePath?: string
}

export interface GcsExtensionServerHandlerDefinition {
  route: string
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
  path: string
  rbac?: GcsExtensionRbacRequirement & {
    entity: {
      target: GcsExtensionEntityTabTarget
      param: string
    }
  }
}

export interface GcsExtensionRuntimeResolverDefinition {
  path: string
}

export interface GcsExtensionMigrationDefinition {
  path: string
}

export interface GcsExtensionAdminDefinition {
  agency?: GcsExtensionComponentDefinition
  streamConfig?: GcsExtensionComponentDefinition
  streamConfigPage?: GcsExtensionComponentDefinition
}

export interface GcsExtensionDefinition {
  key: string
  name: {
    en: string
    fr: string
  }
  description?: {
    en: string
    fr: string
  }
  admin?: GcsExtensionAdminDefinition
  client?: {
    slots?: GcsExtensionSlotDefinition[]
    tabs?: GcsExtensionEntityTabDefinition[]
    createActions?: GcsExtensionCreateActionDefinition[]
    paymentAmountCalculators?: GcsExtensionPaymentAmountCalculatorDefinition[]
  }
  css?: string[]
  i18n?: GcsExtensionI18nDefinition
  assets?: GcsExtensionAssetDefinition[]
  serverHandlers?: GcsExtensionServerHandlerDefinition[]
  migrations?: GcsExtensionMigrationDefinition[]
  runtime?: GcsExtensionRuntimeResolverDefinition
  nitroPlugin?: string
}

export interface GcsResolvedExtension extends Omit<GcsExtensionDefinition, 'admin' | 'client' | 'css' | 'i18n' | 'assets' | 'serverHandlers' | 'migrations' | 'runtime' | 'nitroPlugin'> {
  packageName: string
  rootDir: string
  admin: GcsExtensionAdminDefinition
  client: {
    slots: GcsExtensionSlotDefinition[]
    tabs: Array<GcsExtensionEntityTabDefinition & {
      value?: string
    }>
    createActions: Array<GcsExtensionCreateActionDefinition & {
      value?: string
    }>
    paymentAmountCalculators: Array<GcsExtensionPaymentAmountCalculatorDefinition & {
      value?: string
    }>
  }
  css: string[]
  i18n: GcsExtensionI18nDefinition
  assets: Array<{
    baseURL: string
    dir: string
  }>
  serverHandlers: Array<{
    route: string
    method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
    path: string
    rbac?: GcsExtensionServerHandlerDefinition['rbac']
  }>
  migrations: Array<{
    key: string
    path: string
  }>
  runtime?: GcsExtensionRuntimeResolverDefinition
  nitroPlugin?: string
}

export type GcsExtensionJsonConfig = Record<string, JsonValue>

export interface GcsExtensionRuntimeContext {
  slot: GcsExtensionSlot
  streamId?: string
  agencyId?: string
  applicantRecipientId?: string
}

export interface GcsExtensionRuntimeResolution {
  enabled: boolean
  config?: GcsExtensionJsonConfig
}

export const defineGcsExtension = (definition: GcsExtensionDefinition): GcsExtensionDefinition => definition
