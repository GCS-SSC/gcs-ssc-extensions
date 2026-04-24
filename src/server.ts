import { z } from 'zod'
import type { JsonValue } from './index'

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
