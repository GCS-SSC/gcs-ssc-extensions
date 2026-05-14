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
