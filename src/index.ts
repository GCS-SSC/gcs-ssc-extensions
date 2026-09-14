export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export const GCS_EXTENSION_SDK_VERSION = '0.2.2'

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
    const nestedData = data && typeof data === 'object' && 'data' in data
      ? (data as { data?: { details?: unknown; message?: unknown } }).data
      : undefined
    const nestedDetails = Array.isArray(nestedData?.details) ? nestedData.details : []
    const flatDetails = data && typeof data === 'object' && 'details' in data && Array.isArray((data as { details?: unknown }).details)
      ? (data as { details: unknown[] }).details
      : []
    const firstDetailMessage = [...nestedDetails, ...flatDetails]
      .map(detail => detail && typeof detail === 'object' && 'message' in detail ? (detail as { message?: unknown }).message : undefined)
      .find(message => typeof message === 'string' && message.length > 0)
    const nestedMessage = nestedData?.message
    const flatMessage = data && typeof data === 'object' && 'message' in data
      ? (data as { message?: unknown }).message
      : undefined
    const rawMessage = firstDetailMessage ?? nestedMessage ?? flatMessage
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
  const responseWithOptionalClone = response as Response & {
    clone?: () => Response
  }
  const responseForJson = responseWithOptionalClone.clone?.() ?? response
  let payload: unknown
  try {
    payload = await responseForJson.json() as unknown
  } catch {
    payload = undefined
  }

  if (payload !== undefined) {
    throw new FetchResponseError(response, payload)
  }

  const responseForText = responseWithOptionalClone.clone?.() ?? response
  const textBody = await responseForText.text().catch(() => '')
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
  | 'system'
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

export type GcsExtensionEntityType =
  | 'fundingopportunity'
  | 'transferpaymentstream'
  | 'fundingcaseintake'
  | 'fundingcaseagreement'
  | 'applicantrecipient'
  | 'commonreview'
  | 'commonrecommendation'
  | 'fundingcaseamendment'
  | 'fundingcasecommitment'
  | 'fundingcasemonitor'
  | 'fundingclaimreconcile'
  | 'fundingcaseforecast'
  | 'fundingcasepayment'
  | 'fundingcaserecommendation'

export interface GcsExtensionEntityDefinition {
  type: GcsExtensionEntityType
  label: GcsExtensionBilingualLabel
}

export interface GcsExtensionEntityFieldDefinition {
  entityType: GcsExtensionEntityType
  key: string
  label: GcsExtensionBilingualLabel
  required: boolean
  collection?: string
  valueType: 'string' | 'number' | 'date' | 'boolean' | 'json'
}

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

export interface GcsAgreementProfileExtensionContext {
  kind: 'agreement.profile'
  mode: 'create' | 'read' | 'update'
  agreementId?: string
  streamId?: string
  ownerType: 'fundingcaseagreement'
  ownerId?: string
  profile: Record<string, unknown>
  extensions?: Record<string, Record<string, unknown>>
  setExtensionPayload?: (extensionKey: string, payloadKey: string, value: unknown) => void
}

export interface GcsAgreementDescriptionsExtensionContext {
  kind: 'agreement.descriptions'
  agreementId?: string
  streamId?: string
  descriptions: Record<GcsTextareaTargetLocale, string>
  extensions?: Record<string, Record<string, unknown>>
  setExtensionPayload?: (extensionKey: string, payloadKey: string, value: unknown) => void
}

export interface GcsExtensionUnknownSlotContext {
  kind?: string
  [key: string]: unknown
}

export type GcsExtensionSlotContext =
  | GcsTextareaExtensionContext
  | GcsAgreementProfileExtensionContext
  | GcsAgreementDescriptionsExtensionContext
  | GcsExtensionUnknownSlotContext

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

export const GCS_EXTENSION_ENTITIES: GcsExtensionEntityDefinition[] = [
  { type: 'fundingopportunity', label: { en: 'Funding Opportunities', fr: 'Possibilités de financement' } },
  { type: 'transferpaymentstream', label: { en: 'Streams', fr: 'Volets' } },
  { type: 'fundingcaseintake', label: { en: 'Intakes', fr: 'Admissions' } },
  { type: 'fundingcaseagreement', label: { en: 'Agreements', fr: 'Ententes' } },
  { type: 'applicantrecipient', label: { en: 'Proponents', fr: 'Promoteurs' } },
  { type: 'commonreview', label: { en: 'Reviews', fr: 'Examens' } },
  { type: 'commonrecommendation', label: { en: 'Recommendations', fr: 'Recommandations' } },
  { type: 'fundingcaseamendment', label: { en: 'Amendments', fr: 'Modifications' } },
  { type: 'fundingcasecommitment', label: { en: 'Commitments', fr: 'Engagements' } },
  { type: 'fundingcasemonitor', label: { en: 'Monitors', fr: 'Surveillances' } },
  { type: 'fundingclaimreconcile', label: { en: 'Claims', fr: 'Réclamations' } },
  { type: 'fundingcaseforecast', label: { en: 'Forecasts', fr: 'Prévisions' } },
  { type: 'fundingcasepayment', label: { en: 'Payments', fr: 'Paiements' } },
  { type: 'fundingcaserecommendation', label: { en: 'Case Recommendations', fr: 'Recommandations de dossier' } }
]

export const GCS_EXTENSION_CLAIM_FIELDS: GcsExtensionEntityFieldDefinition[] = [
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_fundingagreement',
    label: { en: 'Agreement number', fr: 'Numéro d’entente' },
    required: true,
    valueType: 'string'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_fiscalyear',
    label: { en: 'Fiscal year', fr: 'Exercice financier' },
    required: true,
    valueType: 'string'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_periodstart',
    label: { en: 'Claim period start month', fr: 'Mois de début de la période de réclamation' },
    required: true,
    valueType: 'number'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_periodend',
    label: { en: 'Claim period end month', fr: 'Mois de fin de la période de réclamation' },
    required: true,
    valueType: 'number'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_receiveddate',
    label: { en: 'Received date', fr: 'Date de réception' },
    required: true,
    valueType: 'date'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_isfinalforyear',
    label: { en: 'Final for year', fr: 'Finale pour l’exercice' },
    required: false,
    valueType: 'boolean'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_submittedcostcategory',
    label: { en: 'Cost category', fr: 'Catégorie de coût' },
    required: true,
    collection: 'submitted_line_items',
    valueType: 'string'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_submittedcostsubsection',
    label: { en: 'Subsection', fr: 'Sous-section' },
    required: true,
    collection: 'submitted_line_items',
    valueType: 'string'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_submittedlineitem',
    label: { en: 'Line item', fr: 'Poste' },
    required: true,
    collection: 'submitted_line_items',
    valueType: 'string'
  },
  {
    entityType: 'fundingclaimreconcile',
    key: 'egcs_fc_amount',
    label: { en: 'Submitted amount', fr: 'Montant soumis' },
    required: true,
    collection: 'submitted_line_items',
    valueType: 'number'
  }
]

export interface GcsExtensionComponentDefinition {
  path: string
  componentName?: string
}

/** Business entity identity supplied by the host to a storage provider. */
export interface GcsFileStorageTarget {
  entityType: string
  entityId: string
}

export type GcsFileStoragePurpose = 'attachment' | 'document-template' | 'generated-document'
export type GcsFileStorageMetadataPersistence = 'host' | 'provider'
export type GcsFileStorageMetadataMutability = 'upload-only' | 'editable'

export interface GcsFileStorageMetadataContributionDefinition {
  component: GcsExtensionComponentDefinition
  validator: {
    path: string
  }
  persistence: GcsFileStorageMetadataPersistence
  mutability: GcsFileStorageMetadataMutability
  /** Positive integer identifying the provider-owned metadata contract. */
  contractVersion: number
}

/** Singular object-storage contribution. The containing extension key is its permanent provider ID. */
export interface GcsFileStorageProviderDefinition {
  adapter: {
    path: string
  }
  metadata?: GcsFileStorageMetadataContributionDefinition
}

export interface GcsExtensionSlotDefinition extends GcsExtensionComponentDefinition {
  slot: GcsExtensionSlot
}

type GcsExtensionAgreementEntityTabTarget = Exclude<GcsExtensionEntityTabTarget, 'proponent'>

type GcsExtensionEntityTabAuthorization =
  | {
    target: 'proponent'
    rbac: GcsExtensionRbacRequirement & { subject: 'applicant_recipient' }
  }
  | {
    target: GcsExtensionAgreementEntityTabTarget
    rbac: GcsExtensionRbacRequirement & { subject: 'agreement' }
  }

export type GcsExtensionEntityTabDefinition = GcsExtensionComponentDefinition & GcsExtensionEntityTabAuthorization & {
  id: string
  label: GcsExtensionBilingualLabel
  icon?: string
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

export interface GcsExtensionAssetDefinition {
  baseURL: string
  path?: string
  package?: string
  packagePath?: string
}

export type GcsExtensionServerEntityRbacRequirement =
  | (GcsExtensionRbacRequirement & {
    subject: 'applicant_recipient'
    entity: {
      target: 'proponent'
      param: string
    }
  })
  | (GcsExtensionRbacRequirement & {
    subject: 'agreement'
    entity: {
      target: GcsExtensionAgreementEntityTabTarget
      param: string
    }
  })

export interface GcsExtensionServerHandlerDefinition {
  route: string
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
  path: string
  /**
   * Use `manual` only when the handler performs domain authorization itself.
   * Prefer `rbac`, which lets the host resolve entity config and enforce access
   * before extension code runs.
   */
  auth?: 'manual'
  rbac?:
    | GcsExtensionServerEntityRbacRequirement
    | (GcsExtensionRbacRequirement & {
      stream: {
        param: string
      }
    })
    | (GcsExtensionRbacRequirement & {
      agency: {
        param: string
      }
    })
}

export interface GcsExtensionRuntimeResolverDefinition {
  path: string
}

export interface GcsExtensionMigrationDefinition {
  path: string
}

export type GcsLifecycleEntityCompletionCapability = 'supported' | 'none'
export type GcsLifecycleEntityApprovalSubmissionCapability = 'on_completion' | 'none'
export type GcsLifecycleEntityStandardWorkflowCapability = 'explicit'
export type GcsLifecycleEntityOwnerKind = 'agreement' | 'proponent'
export type GcsLifecycleEntityAssignmentMode = 'independent' | 'inherited'
export type GcsQualifiedExtensionEntityType = `${string}:${string}`

/**
 * Declares one extension-owned business entity to the host lifecycle engine.
 * The host qualifies `type` as `<extension-key>:<local-type>`; extensions must
 * persist and exchange the qualified identity rather than inventing aliases.
 */
export interface GcsExtensionLifecycleEntityDefinition {
  type: string
  label: GcsExtensionBilingualLabel
  completion: GcsLifecycleEntityCompletionCapability
  approvalSubmission: GcsLifecycleEntityApprovalSubmissionCapability
  standardWorkflow: GcsLifecycleEntityStandardWorkflowCapability
  supportsDirectReviews: boolean
  ownerKind: GcsLifecycleEntityOwnerKind
  assignmentMode: GcsLifecycleEntityAssignmentMode
  adapter: {
    path: string
  }
}

export interface GcsResolvedExtensionLifecycleEntityDefinition extends Omit<
  GcsExtensionLifecycleEntityDefinition,
  'type' | 'adapter'
> {
  localType: string
  type: GcsQualifiedExtensionEntityType
  adapter: {
    path: string
  }
}

export interface GcsRegisteredExtensionLifecycleEntityDefinition extends Omit<
  GcsResolvedExtensionLifecycleEntityDefinition,
  'adapter'
> {
  adapter: {
    id: string
  }
}

export type GcsExtensionHostCapability =
  | 'agency-config'
  | 'stream-config-modal'
  | 'stream-config-page'
  | 'entity-tabs'
  | 'textarea-slots'
  | 'create-actions'
  | 'payment-amount-calculators'
  | 'server-handlers'
  | 'server-handler-rbac'
  | 'migrations'
  | 'runtime-resolution'
  | 'public-assets'
  | 'extension-ui'
  | 'extension-api-client'
  | 'host-api-client'
  | 'extension-kv'
  | 'extension-secrets'
  | 'extension-create-operation-hooks'
  | 'extension-lifecycle-hooks'
  | 'lifecycle-entities'
  | 'file-storage-provider'
  | 'agreement-number-provider'
  | 'configuration-access'

/** Minimum host role for changing extension enablement or JSON configuration. */
export type GcsExtensionConfigurationAccess = 'contributor' | 'manager'

export interface GcsExtensionAdminDefinition {
  agency?: GcsExtensionComponentDefinition
  streamConfig?: GcsExtensionComponentDefinition
  streamConfigPage?: GcsExtensionComponentDefinition
}

export interface GcsExtensionDefinition {
  key: string
  /** Defaults to Contributor; explicit values require the configuration-access capability. */
  configurationAccess?: GcsExtensionConfigurationAccess
  sdkVersion: string
  requiredHostCapabilities: GcsExtensionHostCapability[]
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
  assets?: GcsExtensionAssetDefinition[]
  serverHandlers?: GcsExtensionServerHandlerDefinition[]
  migrations?: GcsExtensionMigrationDefinition[]
  entities?: GcsExtensionLifecycleEntityDefinition[]
  runtime?: GcsExtensionRuntimeResolverDefinition
  nitroPlugin?: string
  agreementNumberProvider?: { path: string }
  fileStorageProvider?: GcsFileStorageProviderDefinition
}

export interface GcsResolvedFileStorageProviderDefinition extends Omit<GcsFileStorageProviderDefinition, 'metadata'> {
  adapter: { path: string }
  metadata?: Omit<GcsFileStorageMetadataContributionDefinition, 'component' | 'validator'> & {
    component: GcsExtensionComponentDefinition
    validator: { path: string }
  }
}

export interface GcsRegisteredFileStorageProviderDefinition {
  adapter: { id: string }
  metadata?: Omit<GcsFileStorageMetadataContributionDefinition, 'component' | 'validator'> & {
    component: GcsClientExtensionComponentDefinition
    validator: { id: string }
  }
}

export interface GcsResolvedExtension extends Omit<GcsExtensionDefinition, 'admin' | 'client' | 'css' | 'assets' | 'serverHandlers' | 'migrations' | 'entities' | 'runtime' | 'nitroPlugin' | 'fileStorageProvider'> {
  packageName: string
  rootDir: string
  sdkVersion: string
  requiredHostCapabilities: GcsExtensionHostCapability[]
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
  assets: Array<{
    baseURL: string
    dir: string
  }>
  serverHandlers: Array<{
    route: string
    method?: 'get' | 'post' | 'put' | 'patch' | 'delete'
    path: string
    auth?: 'manual'
    rbac?: GcsExtensionServerHandlerDefinition['rbac']
  }>
  migrations: Array<{
    key: string
    path: string
  }>
  entities?: GcsResolvedExtensionLifecycleEntityDefinition[]
  runtime?: GcsExtensionRuntimeResolverDefinition
  nitroPlugin?: string
  fileStorageProvider?: GcsResolvedFileStorageProviderDefinition
}

export type GcsClientExtensionComponentDefinition = Omit<GcsExtensionComponentDefinition, 'path'> & {
  componentName?: string
}

export type GcsClientExtensionSlotDefinition = Omit<GcsExtensionSlotDefinition, 'path'> & {
  componentName?: string
}

export type GcsClientExtensionEntityTabDefinition = Omit<GcsExtensionEntityTabDefinition, 'path'> & {
  value?: string
  componentName?: string
}

export type GcsClientExtensionCreateActionDefinition = Omit<GcsExtensionCreateActionDefinition, 'path'> & {
  value?: string
  componentName?: string
}

export type GcsClientExtensionPaymentAmountCalculatorDefinition = Omit<GcsExtensionPaymentAmountCalculatorDefinition, 'path'> & {
  value?: string
  componentName?: string
}

export interface GcsClientExtensionManifest {
  key: string
  configurationAccess?: GcsExtensionConfigurationAccess
  name: {
    en: string
    fr: string
  }
  description?: {
    en: string
    fr: string
  }
  sdkVersion: string
  admin: {
    agency?: GcsClientExtensionComponentDefinition
    streamConfig?: GcsClientExtensionComponentDefinition
    streamConfigPage?: GcsClientExtensionComponentDefinition
  }
  client: {
    slots: GcsClientExtensionSlotDefinition[]
    tabs: GcsClientExtensionEntityTabDefinition[]
    createActions: GcsClientExtensionCreateActionDefinition[]
    paymentAmountCalculators: GcsClientExtensionPaymentAmountCalculatorDefinition[]
  }
  fileStorageProvider?: {
    metadata?: Omit<GcsFileStorageMetadataContributionDefinition, 'component' | 'validator'> & {
      component: GcsClientExtensionComponentDefinition
    }
  }
}

export type GcsExtensionJsonConfig = Record<string, JsonValue>

export type ExtensionScope =
  | { type: 'global' }
  | { type: 'agency'; agencyId: string }
  | {
    type: 'entity'
    agencyId: string
    path: Array<{
      type: string
      id: string
    }>
  }

export type ExtensionEntityOwnerType =
  | 'fundingcaseagreement'
  | 'applicantrecipient'
  | 'fundingcaseagreementclaim'
  | 'fundingcaseagreementmonitor'

export interface ExtensionEntityTabContext {
  target: GcsExtensionEntityTabTarget
  agencyId: string
  streamId?: string
  agreementId?: string
  applicantRecipientId?: string
  claimId?: string
  monitorId?: string
  ownerType: ExtensionEntityOwnerType
  ownerId: string
  scope: ExtensionScope
  rbac: GcsExtensionRbacRequirement
}

export interface GcsExtensionRuntimeContext {
  slot: GcsExtensionSlot
  streamId?: string
  agencyId?: string
  applicantRecipientId?: string
}

export interface GcsExtensionRuntimeHostContext {
  event: unknown
  db: unknown
  auth?: unknown
}

export type GcsExtensionRuntimeResolver = (
  host: GcsExtensionRuntimeHostContext,
  context: GcsExtensionRuntimeContext
) => Promise<GcsExtensionRuntimeResolution | null | undefined> | GcsExtensionRuntimeResolution | null | undefined

export interface GcsExtensionRuntimeResolution {
  enabled: boolean
  config?: GcsExtensionJsonConfig
}

/**
 * Marks an extension definition for host discovery without transforming its manifest.
 */
export const defineGcsExtension = (definition: GcsExtensionDefinition): GcsExtensionDefinition => definition

/** Stable creation-time sources. Bilingual values are selected explicitly, never by request locale. */
export const GCS_AGREEMENT_NUMBER_FIELDS = [
  'agreement.title_en', 'agreement.title_fr', 'agreement.startDate', 'agreement.endDate',
  'agreement.financialSystemNumber', 'agency.id', 'agency.name_en', 'agency.name_fr',
  'program.id', 'program.name_en', 'program.name_fr', 'stream.id', 'stream.name_en', 'stream.name_fr',
  'agency.abbreviation_en', 'agency.abbreviation_fr', 'program.abbreviation_en', 'program.abbreviation_fr',
  'stream.abbreviation_en', 'stream.abbreviation_fr'
] as const
export type GcsAgreementNumberField = typeof GCS_AGREEMENT_NUMBER_FIELDS[number]
export type GcsAgreementNumberSources = Record<GcsAgreementNumberField, string>
export interface GcsAgreementNumberMode { mode: 'manual' | 'generated' }
