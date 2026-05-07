export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type GcsExtensionSlot =
  | 'textarea.after'
  | 'agreement.descriptions.after'
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
  admin?: {
    agency?: GcsExtensionComponentDefinition
    streamConfig?: GcsExtensionComponentDefinition
  }
  client?: {
    slots?: GcsExtensionSlotDefinition[]
    tabs?: GcsExtensionEntityTabDefinition[]
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
  admin: {
    agency?: GcsExtensionComponentDefinition
    streamConfig?: GcsExtensionComponentDefinition
  }
  client: {
    slots: GcsExtensionSlotDefinition[]
    tabs: Array<GcsExtensionEntityTabDefinition & {
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
