export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type GcsExtensionSlot =
  | 'textarea.after'

export interface GcsExtensionComponentDefinition {
  path: string
  name?: string
  componentName?: string
}

export interface GcsExtensionSlotDefinition extends GcsExtensionComponentDefinition {
  slot: GcsExtensionSlot
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
  }
  css?: string[]
  i18n?: GcsExtensionI18nDefinition
  assets?: GcsExtensionAssetDefinition[]
  serverHandlers?: GcsExtensionServerHandlerDefinition[]
  nitroPlugin?: string
}

export interface GcsResolvedExtension extends Omit<GcsExtensionDefinition, 'admin' | 'client' | 'css' | 'i18n' | 'assets' | 'serverHandlers' | 'nitroPlugin'> {
  packageName: string
  rootDir: string
  admin: {
    agency?: GcsExtensionComponentDefinition
    streamConfig?: GcsExtensionComponentDefinition
  }
  client: {
    slots: GcsExtensionSlotDefinition[]
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
  }>
  nitroPlugin?: string
}

export type GcsExtensionJsonConfig = Record<string, JsonValue>

export const defineGcsExtension = (definition: GcsExtensionDefinition): GcsExtensionDefinition => definition
