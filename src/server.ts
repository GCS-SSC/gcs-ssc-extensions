import { z } from 'zod'
import type { Kysely, Migration } from 'kysely'
import type { GcsExtensionCreateOperation, GcsExtensionEntityTabTarget, GcsExtensionJsonConfig, GcsExtensionRbacRequirement, JsonValue } from './index'

export type GcsExtensionMigration = Migration

export const defineGcsExtensionMigration = <T extends GcsExtensionMigration>(migration: T): T => migration

export const GCS_EXTENSION_CREATE_OPERATION_HOOK = 'gcs:extension:create-operation'

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

export interface ExtensionStreamContext {
  agencyId: string
  profileId: string
  streamId: string
  scope: ExtensionScope
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

export interface GcsExtensionCreateOperationContext {
  operation: GcsExtensionCreateOperation
  phase: 'before-create' | 'after-create'
  extensionKey: string
  event: unknown
  db: Kysely<unknown>
  trx: Kysely<unknown>
  agreementId: string
  agencyId: string
  streamId: string
  scope: ExtensionScope
  config: GcsExtensionJsonConfig
  validatedBody: Record<string, unknown>
  createdRecord?: Record<string, unknown>
}

export type GcsExtensionCreateOperationResult =
  | {
    status: 'handled'
    response: unknown
  }
  | {
    status: 'continue'
  }

export type GcsExtensionCreateOperationHandler = (
  context: GcsExtensionCreateOperationContext
) => Promise<GcsExtensionCreateOperationResult | void> | GcsExtensionCreateOperationResult | void

export interface GcsExtensionCreateOperationHookPayload {
  operation: GcsExtensionCreateOperation
  enabledExtensionKeys: Set<string>
  contexts: Record<string, Omit<GcsExtensionCreateOperationContext, 'extensionKey' | 'config'> & {
    config: GcsExtensionJsonConfig
  }>
  results: Array<{
    extensionKey: string
    result: GcsExtensionCreateOperationResult
  }>
}

type NitroHookRegistrar = {
  hooks: {
    hook: (
      name: typeof GCS_EXTENSION_CREATE_OPERATION_HOOK,
      handler: (payload: GcsExtensionCreateOperationHookPayload) => Promise<void> | void
    ) => void
  }
}

export type GcsExtensionLocalizedMessage =
  | string
  | {
    en: string
    fr: string
  }

export interface GcsExtensionUserErrorDetail {
  /**
   * Stable field or domain path for the problem, such as `egcs_fc_paymentamount`
   * or `allocation.lines.0.amount`. The host serializes this path so clients can
   * show field-specific messages when they choose to.
   */
  path: string
  /**
   * Extension-owned user-facing message. Prefer `{ en, fr }` so the host can
   * select the request locale. Plain strings are treated as already-resolved
   * extension text and are not translated by the host.
   */
  message: GcsExtensionLocalizedMessage
  /**
   * Optional stable extension-owned detail code for logs, tests, and client-side
   * fallback handling.
   */
  code?: string
}

export interface GcsExtensionUserErrorOptions {
  /**
   * Stable extension-owned error code. Prefix with the extension key or another
   * unique namespace, for example `GCS_EXAMPLE_PAYMENT_RULES_MISSING`.
   */
  code: string
  /**
   * Helpful, user-correctable, extension-owned message. Prefer bilingual
   * messages. Do not pass host i18n keys here.
   */
  message: GcsExtensionLocalizedMessage
  /**
   * Defaults to 400. Use 409 for conflicts or another 4xx when it better
   * describes a user-correctable extension rule failure.
   */
  statusCode?: number
  /**
   * Field/domain-specific detail messages. The host resolves bilingual details
   * and returns them as `data.details[]` in the API error payload.
   */
  details?: GcsExtensionUserErrorDetail[]
}

const defaultLocalizedMessage = (message: GcsExtensionLocalizedMessage): string =>
  typeof message === 'string' ? message : message.en

export class GcsExtensionUserError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly localizedMessage: GcsExtensionLocalizedMessage
  readonly details?: GcsExtensionUserErrorOptions['details']

  constructor(options: GcsExtensionUserErrorOptions) {
    super(defaultLocalizedMessage(options.message))
    this.name = 'GcsExtensionUserError'
    this.code = options.code
    this.statusCode = options.statusCode ?? 400
    this.localizedMessage = options.message
    this.details = options.details
  }
}

export const createGcsExtensionUserError = (options: GcsExtensionUserErrorOptions): GcsExtensionUserError =>
  new GcsExtensionUserError(options)

export const isGcsExtensionUserError = (error: unknown): error is GcsExtensionUserError =>
  error instanceof GcsExtensionUserError
  || (
    Boolean(error)
    && typeof error === 'object'
    && (error as { name?: unknown }).name === 'GcsExtensionUserError'
    && typeof (error as { code?: unknown }).code === 'string'
    && typeof (error as { message?: unknown }).message === 'string'
  )

export const registerGcsExtensionCreateOperationHandler = (
  extensionKey: string,
  operation: GcsExtensionCreateOperation,
  handler: GcsExtensionCreateOperationHandler,
  nitroApp?: NitroHookRegistrar
) => {
  const resolvedNitroApp = nitroApp ?? (globalThis as typeof globalThis & {
    useNitroApp?: () => NitroHookRegistrar
  }).useNitroApp?.()

  if (!resolvedNitroApp) {
    throw new Error('GCS extension create operation handlers must be registered from a Nitro plugin.')
  }

  resolvedNitroApp.hooks.hook(GCS_EXTENSION_CREATE_OPERATION_HOOK, async payload => {
    if (payload.operation !== operation || !payload.enabledExtensionKeys.has(extensionKey)) {
      return
    }

    const context = payload.contexts[extensionKey]
    if (!context) {
      return
    }

    const result = await handler({
      ...context,
      extensionKey
    })

    if (result) {
      payload.results.push({
        extensionKey,
        result
      })
    }
  })
}

type ExtensionKvDatabase = {
  'extensions.kv_entry': {
    id: unknown
    extension_key: string
    owner_type: string
    owner_id: string
    config_key: string
    value: JsonValue
    _deleted: boolean
  }
}

type ExtensionSecretDatabase = {
  'extensions.secret_entry': {
    id: unknown
    extension_key: string
    owner_type: string
    owner_id: string
    secret_key: string
    ciphertext: string
    iv: string
    auth_tag: string
    algorithm: string
    key_version: number
    metadata: JsonValue
    created_at: unknown
    updated_at: unknown
    _deleted: boolean
  }
}

interface ExtensionSecretOptions {
  rootKey: string
  extensionKey: string
  ownerType: string
  ownerId: string
  secretKey: string
}

interface SetExtensionSecretOptions extends ExtensionSecretOptions {
  value: JsonValue
  metadata?: JsonValue
}

const EXTENSION_SECRET_ALGORITHM = 'AES-256-GCM'
const EXTENSION_SECRET_KEY_VERSION = 1
const EXTENSION_SECRET_IV_BYTES = 12
const EXTENSION_SECRET_TAG_BYTES = 16

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const bytesToBase64 = (bytes: Uint8Array): string => {
  let output = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0
    const packed = (first << 16) | (second << 8) | third

    output += base64Alphabet[(packed >> 18) & 63]
    output += base64Alphabet[(packed >> 12) & 63]
    output += index + 1 < bytes.length ? base64Alphabet[(packed >> 6) & 63] : '='
    output += index + 2 < bytes.length ? base64Alphabet[packed & 63] : '='
  }

  return output
}

const normalizeBase64Secret = (value: string, fieldName: string): string => {
  const normalized = value.replace(/\s/g, '')
  if (normalized.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error(`${fieldName} must be base64 encoded.`)
  }

  return normalized
}

const decodeBase64SecretChunk = (chunk: string, fieldName: string): number[] => {
  const values = [...chunk].map(character => character === '=' ? 0 : base64Alphabet.indexOf(character))
  // Defensive in case this helper is ever called without normalizeBase64Secret.
  if (values.some(item => item < 0)) {
    throw new Error(`${fieldName} must be base64 encoded.`)
  }

  const packed = ((values[0] ?? 0) << 18) | ((values[1] ?? 0) << 12) | ((values[2] ?? 0) << 6) | (values[3] ?? 0)
  return [
    (packed >> 16) & 255,
    ...(chunk[2] !== '=' ? [(packed >> 8) & 255] : []),
    ...(chunk[3] !== '=' ? [packed & 255] : [])
  ]
}

const base64ToBytes = (value: string, fieldName: string): Uint8Array<ArrayBuffer> => {
  const normalized = normalizeBase64Secret(value, fieldName)
  const bytes: number[] = []
  for (let index = 0; index < normalized.length; index += 4) {
    bytes.push(...decodeBase64SecretChunk(normalized.slice(index, index + 4), fieldName))
  }

  const output = new Uint8Array(new ArrayBuffer(bytes.length))
  output.set(bytes)
  return output
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const importExtensionSecretRootKey = async (rootKey: string): Promise<CryptoKey> => {
  const keyBytes = base64ToBytes(rootKey, 'Extension secret root key')
  if (keyBytes.byteLength !== 32) {
    throw new Error('Extension secret root key must decode to 32 bytes.')
  }

  return await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

const extensionSecretAdditionalData = (options: ExtensionSecretOptions): Uint8Array =>
  new TextEncoder().encode([
    options.extensionKey,
    options.ownerType,
    options.ownerId,
    options.secretKey,
    String(EXTENSION_SECRET_KEY_VERSION)
  ].join('\u001f'))

const encryptExtensionSecretValue = async (
  options: SetExtensionSecretOptions
): Promise<{ ciphertext: string; iv: string; authTag: string }> => {
  const key = await importExtensionSecretRootKey(options.rootKey)
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(EXTENSION_SECRET_IV_BYTES)))
  const encoded = new TextEncoder().encode(JSON.stringify(options.value))
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(extensionSecretAdditionalData(options)),
      tagLength: EXTENSION_SECRET_TAG_BYTES * 8
    },
    key,
    toArrayBuffer(encoded)
  ))
  const ciphertext = encrypted.slice(0, encrypted.length - EXTENSION_SECRET_TAG_BYTES)
  const authTag = encrypted.slice(encrypted.length - EXTENSION_SECRET_TAG_BYTES)

  return {
    ciphertext: bytesToBase64(ciphertext),
    iv: bytesToBase64(iv),
    authTag: bytesToBase64(authTag)
  }
}

const decryptExtensionSecretValue = async (
  options: ExtensionSecretOptions & {
    ciphertext: string
    iv: string
    authTag: string
  }
): Promise<JsonValue> => {
  const key = await importExtensionSecretRootKey(options.rootKey)
  const ciphertext = base64ToBytes(options.ciphertext, 'Extension secret ciphertext')
  const authTag = base64ToBytes(options.authTag, 'Extension secret authentication tag')
  const encrypted = new Uint8Array(new ArrayBuffer(ciphertext.length + authTag.length))
  encrypted.set(ciphertext)
  encrypted.set(authTag, ciphertext.length)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(base64ToBytes(options.iv, 'Extension secret initialization vector')),
      additionalData: toArrayBuffer(extensionSecretAdditionalData(options)),
      tagLength: EXTENSION_SECRET_TAG_BYTES * 8
    },
    key,
    toArrayBuffer(encrypted)
  )

  return JSON.parse(new TextDecoder().decode(decrypted)) as JsonValue
}

export interface ExtensionStreamContextDatabase {
  Transfer_Payment_Profile: {
    id: unknown
    egcs_tp_agency: unknown
    _deleted: boolean
  }
  Transfer_Payment_Stream: {
    id: unknown
    egcs_tp_transferpaymentprofile: unknown
    _deleted: boolean
  }
}

export interface ExtensionStreamContextQueryBuilder {
  innerJoin(
    table: 'Transfer_Payment_Profile',
    leftColumn: 'Transfer_Payment_Profile.id',
    rightColumn: 'Transfer_Payment_Stream.egcs_tp_transferpaymentprofile'
  ): ExtensionStreamContextQueryBuilder
  select(columns: [
    'Transfer_Payment_Profile.id as profile_id',
    'Transfer_Payment_Profile.egcs_tp_agency as agency_id'
  ]): ExtensionStreamContextQueryBuilder
  where(
    column:
      | 'Transfer_Payment_Stream.id'
      | 'Transfer_Payment_Stream._deleted'
      | 'Transfer_Payment_Profile._deleted',
    operator: '=',
    value: string | boolean
  ): ExtensionStreamContextQueryBuilder
  executeTakeFirst(): Promise<{
    profile_id: unknown
    agency_id: unknown
  } | undefined>
}

export interface ExtensionStreamContextDatabaseClient {
  selectFrom(table: 'Transfer_Payment_Stream'): ExtensionStreamContextQueryBuilder
}

export type ReviewSchemaContentSource = {
  egcs_cn_scoringmatrix?: JsonValue | null
  egcs_cn_assessmentschema?: JsonValue | null
  egcs_cn_publishedscoringmatrix?: JsonValue | null
  egcs_cn_publishedassessmentschema?: JsonValue | null
}

export type ReviewSchemaContent = {
  scoringMatrix: JsonValue | null
  assessmentSchema: JsonValue | null
}

export const EnFrLabelSchema = z.object({
  en: z.string(),
  fr: z.string()
})

const DependencyValueSchema = z.boolean().or(z.coerce.number().or(z.string()))

const HelpersDependencySchema = z.object({
  type: z.literal('helpers'),
  field: z.string()
})

const AnswerDependencySchema = z.object({
  type: z.literal('answers'),
  section: z.string(),
  subsection: z.string(),
  question: z.string()
})

const DependencyOnSchema = z.discriminatedUnion('type', [HelpersDependencySchema, AnswerDependencySchema])

const DependencySchemaBase = z.object({
  on: DependencyOnSchema,
  value: DependencyValueSchema
})

const DependencySchema = DependencySchemaBase.or(z.array(DependencySchemaBase))

const AdjustableWeightSchema = z.object({
  adjustable: z.literal(true),
  on: DependencyOnSchema,
  weights: z.record(z.string(), z.coerce.number())
})

const FixedWeightSchema = z.object({
  adjustable: z.literal(false),
  weight: z.coerce.number()
})

const AdjustableWeightArraySchema = z.tuple([z.coerce.number(), z.array(AdjustableWeightSchema)])

const WeightSchema = AdjustableWeightSchema.or(FixedWeightSchema)

const HelpSchema = z.object({
  title: EnFrLabelSchema,
  description: EnFrLabelSchema
})

const QuestionSchema = z.object({
  type: z.literal('question'),
  name: z.string(),
  question: EnFrLabelSchema,
  weight: WeightSchema,
  commentThreshold: z.object({
    min: z.coerce.number(),
    max: z.coerce.number()
  }),
  options: z.array(z.object({
    value: z.coerce.number(),
    label: EnFrLabelSchema,
    description: EnFrLabelSchema
  })),
  help: z.array(HelpSchema),
  depends: z.optional(z.array(DependencySchema)),
  assistance: z.optional(z.literal('fundingHistory'))
})

const CalculationSchema = z.object({
  type: z.literal('calculation'),
  name: z.string(),
  question: EnFrLabelSchema,
  weight: WeightSchema,
  help: z.array(HelpSchema),
  depends: z.optional(z.array(DependencySchema)),
  formula: z.unknown()
})

const AssessmentQuestionItemSchema = z.discriminatedUnion('type', [QuestionSchema, CalculationSchema])

const ScoringMatrixItemSchema = z.object({
  max: z.coerce.number(),
  label: EnFrLabelSchema,
  indicator: z.string()
})

const OutcomeOptionSchema = z.object({
  max: z.coerce.number(),
  value: z.string(),
  label: EnFrLabelSchema
})

export const AssessmentDefinitionSchema = z.object({
  helpers: z.optional(z.record(z.string(), DependencyValueSchema)),
  sections: z.array(z.object({
    weight: z.coerce.number(),
    number: z.string(),
    label: EnFrLabelSchema,
    name: z.string(),
    icon: z.string(),
    subSections: z.array(z.object({
      name: z.string(),
      weight: WeightSchema.or(AdjustableWeightArraySchema),
      label: EnFrLabelSchema,
      questions: z.array(AssessmentQuestionItemSchema),
      depends: z.optional(z.array(DependencySchema))
    }))
  })),
  sectionMatrix: z.array(ScoringMatrixItemSchema),
  outcomes: z.array(z.object({
    label: EnFrLabelSchema,
    name: z.string(),
    strategies: z.array(z.object({
      name: z.string(),
      label: EnFrLabelSchema,
      options: z.array(OutcomeOptionSchema)
    }))
  })),
  impactors: z.optional(z.array(z.object({
    weight: z.coerce.number(),
    on: DependencyOnSchema,
    scoringMatrix: z.array(z.object({
      max: z.coerce.number(),
      value: z.coerce.number()
    })),
    label: z.optional(EnFrLabelSchema)
  })))
})

export type AssessmentDefinition = z.infer<typeof AssessmentDefinitionSchema>

export const getReviewSchemaEffectiveContent = (schema: ReviewSchemaContentSource): ReviewSchemaContent => ({
  scoringMatrix: schema.egcs_cn_scoringmatrix ?? schema.egcs_cn_publishedscoringmatrix ?? null,
  assessmentSchema: schema.egcs_cn_assessmentschema ?? schema.egcs_cn_publishedassessmentschema ?? null
})

/**
 * Resolves the host stream, transfer payment profile, agency, and extension scope for an extension route.
 *
 * @param db Minimal Kysely-compatible host database client.
 * @param streamId Transfer payment stream id from the extension route.
 * @returns The resolved extension stream context, or null when the stream is unavailable.
 */
export const resolveExtensionStreamContext = async (
  db: ExtensionStreamContextDatabaseClient,
  streamId: string
): Promise<ExtensionStreamContext | null> => {
  const stream = await db
    .selectFrom('Transfer_Payment_Stream')
    .innerJoin('Transfer_Payment_Profile', 'Transfer_Payment_Profile.id', 'Transfer_Payment_Stream.egcs_tp_transferpaymentprofile')
    .select([
      'Transfer_Payment_Profile.id as profile_id',
      'Transfer_Payment_Profile.egcs_tp_agency as agency_id'
    ])
    .where('Transfer_Payment_Stream.id', '=', streamId)
    .where('Transfer_Payment_Stream._deleted', '=', false)
    .where('Transfer_Payment_Profile._deleted', '=', false)
    .executeTakeFirst()

  if (!stream) return null

  const agencyId = String(stream.agency_id)
  const profileId = String(stream.profile_id)
  return {
    agencyId,
    profileId,
    streamId,
    scope: {
      type: 'entity',
      agencyId,
      path: [
        { type: 'transfer_payment', id: profileId },
        { type: 'transfer_payment_stream', id: streamId }
      ]
    }
  }
}

/**
 * Creates or updates a host-managed extension key-value entry.
 *
 * @param db Minimal Kysely-compatible host database client.
 * @param extensionKey Extension manifest key.
 * @param ownerType Host entity owner type.
 * @param ownerId Host entity owner id.
 * @param configKey Extension-owned value key.
 * @param value JSON value to store.
 * @returns Inserted or updated row when the host adapter returns it.
 */
export const setExtensionKvEntry = async (
  db: Kysely<ExtensionKvDatabase>,
  extensionKey: string,
  ownerType: string,
  ownerId: string,
  configKey: string,
  value: JsonValue
) => {
  const existing = await db
    .selectFrom('extensions.kv_entry')
    .select('id')
    .where('extension_key', '=', extensionKey)
    .where('owner_type', '=', ownerType)
    .where('owner_id', '=', ownerId)
    .where('config_key', '=', configKey)
    .where('_deleted', '=', false)
    .executeTakeFirst()

  if (existing) {
    return await db
      .updateTable('extensions.kv_entry')
      .set({ value })
      .where('id', '=', existing.id)
      .returningAll()
      .executeTakeFirst()
  }

  return await db
    .insertInto('extensions.kv_entry')
    .values({
      extension_key: extensionKey,
      owner_type: ownerType,
      owner_id: ownerId,
      config_key: configKey,
      value,
      _deleted: false
    })
    .returningAll()
    .executeTakeFirst()
}

/**
 * Reads a host-managed extension key-value entry.
 *
 * @param db Minimal Kysely-compatible host database client.
 * @param extensionKey Extension manifest key.
 * @param ownerType Host entity owner type.
 * @param ownerId Host entity owner id.
 * @param configKey Extension-owned value key.
 * @returns Stored JSON value, or null when absent.
 */
export const getExtensionKvEntry = async (
  db: Kysely<ExtensionKvDatabase>,
  extensionKey: string,
  ownerType: string,
  ownerId: string,
  configKey: string
): Promise<JsonValue | null> => {
  const row = await db
    .selectFrom('extensions.kv_entry')
    .select('value')
    .where('extension_key', '=', extensionKey)
    .where('owner_type', '=', ownerType)
    .where('owner_id', '=', ownerId)
    .where('config_key', '=', configKey)
    .where('_deleted', '=', false)
    .executeTakeFirst()

  return row ? row.value : null
}

/**
 * Soft-deletes a host-managed extension key-value entry.
 *
 * @param db Minimal Kysely-compatible host database client.
 * @param extensionKey Extension manifest key.
 * @param ownerType Host entity owner type.
 * @param ownerId Host entity owner id.
 * @param configKey Extension-owned value key.
 */
export const deleteExtensionKvEntry = async (
  db: Kysely<ExtensionKvDatabase>,
  extensionKey: string,
  ownerType: string,
  ownerId: string,
  configKey: string
) => {
  await db
    .updateTable('extensions.kv_entry')
    .set({ _deleted: true })
    .where('extension_key', '=', extensionKey)
    .where('owner_type', '=', ownerType)
    .where('owner_id', '=', ownerId)
    .where('config_key', '=', configKey)
    .where('_deleted', '=', false)
    .execute()
}

/**
 * Creates or updates an encrypted host-managed extension secret.
 *
 * @param db Minimal Kysely-compatible host database client.
 * @param options Secret owner, key, root encryption key, value, and optional metadata.
 * @returns Inserted or updated row when the host adapter returns it.
 */
export const setEncryptedExtensionSecret = async (
  db: Kysely<ExtensionSecretDatabase>,
  options: SetExtensionSecretOptions
) => {
  const encrypted = await encryptExtensionSecretValue(options)
  const existing = await db
    .selectFrom('extensions.secret_entry')
    .select('id')
    .where('extension_key', '=', options.extensionKey)
    .where('owner_type', '=', options.ownerType)
    .where('owner_id', '=', options.ownerId)
    .where('secret_key', '=', options.secretKey)
    .where('_deleted', '=', false)
    .executeTakeFirst()

  const values = {
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    auth_tag: encrypted.authTag,
    algorithm: EXTENSION_SECRET_ALGORITHM,
    key_version: EXTENSION_SECRET_KEY_VERSION,
    metadata: options.metadata ?? {},
    updated_at: new Date()
  }

  if (existing) {
    return await db
      .updateTable('extensions.secret_entry')
      .set(values)
      .where('id', '=', existing.id)
      .returningAll()
      .executeTakeFirst()
  }

  return await db
    .insertInto('extensions.secret_entry')
    .values({
      extension_key: options.extensionKey,
      owner_type: options.ownerType,
      owner_id: options.ownerId,
      secret_key: options.secretKey,
      ...values,
      _deleted: false
    })
    .returningAll()
    .executeTakeFirst()
}

/**
 * Reads and decrypts a host-managed extension secret.
 *
 * @param db Minimal Kysely-compatible host database client.
 * @param options Secret owner, key, and root encryption key.
 * @returns Decrypted JSON value, or null when absent.
 */
export const getEncryptedExtensionSecret = async (
  db: Kysely<ExtensionSecretDatabase>,
  options: ExtensionSecretOptions
): Promise<JsonValue | null> => {
  const row = await db
    .selectFrom('extensions.secret_entry')
    .select(['ciphertext', 'iv', 'auth_tag', 'algorithm', 'key_version'])
    .where('extension_key', '=', options.extensionKey)
    .where('owner_type', '=', options.ownerType)
    .where('owner_id', '=', options.ownerId)
    .where('secret_key', '=', options.secretKey)
    .where('_deleted', '=', false)
    .executeTakeFirst()

  if (!row) {
    return null
  }

  if (row.algorithm !== EXTENSION_SECRET_ALGORITHM || row.key_version !== EXTENSION_SECRET_KEY_VERSION) {
    throw new Error('Unsupported extension secret encryption metadata.')
  }

  return await decryptExtensionSecretValue({
    ...options,
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.auth_tag
  })
}

/**
 * Soft-deletes a host-managed extension secret.
 *
 * @param db Minimal Kysely-compatible host database client.
 * @param extensionKey Extension manifest key.
 * @param ownerType Host or extension owner type.
 * @param ownerId Host or extension owner id.
 * @param secretKey Extension-owned secret key.
 */
export const deleteEncryptedExtensionSecret = async (
  db: Kysely<ExtensionSecretDatabase>,
  extensionKey: string,
  ownerType: string,
  ownerId: string,
  secretKey: string
) => {
  await db
    .updateTable('extensions.secret_entry')
    .set({ _deleted: true, updated_at: new Date() })
    .where('extension_key', '=', extensionKey)
    .where('owner_type', '=', ownerType)
    .where('owner_id', '=', ownerId)
    .where('secret_key', '=', secretKey)
    .where('_deleted', '=', false)
    .execute()
}
