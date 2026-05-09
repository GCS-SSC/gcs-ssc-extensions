import type { Component } from 'vue'

export interface GcsRef<T> {
  value: T
}

export interface GcsI18nComposer {
  locale: GcsRef<string>
  t: (key: string, params?: Record<string, unknown>) => string
}

export type GcsFetchStatus = 'idle' | 'pending' | 'success' | 'error'

export type GcsExtensionRbacAction = 'create' | 'read' | 'update' | 'delete'

export type GcsExtensionRbacSubject =
  | 'all'
  | 'agency'
  | 'transfer_payment'
  | 'role'
  | 'user'
  | 'applicant_recipient'
  | 'agreement'

export type GcsExtensionScope =
  | { type: 'global' }
  | { type: 'agency'; agencyId: string }
  | { type: 'program'; agencyId: string; transferPaymentId: string }
  | { type: 'entity'; agencyId: string; path: Array<{ type: string; id: string }> }

export interface GcsFetchResult<T> {
  data: GcsRef<T | null>
  status: GcsRef<GcsFetchStatus>
  error: GcsRef<unknown | null>
  refresh: () => Promise<void>
}

export interface GcsExtensionEvent {
  context: {
    $db: unknown
    $authContext?: {
      userAbilities: {
        authorizeWithTeam: (...args: unknown[]) => Promise<boolean>
        authorize: (...args: unknown[]) => boolean
      }
      userId: string
    }
    params?: Record<string, string | undefined>
  }
  node?: {
    res?: {
      statusCode?: number
      statusMessage?: string
    }
  }
}

export interface GcsNitroApp {
  hooks: {
    hook: (name: string, handler: (...args: unknown[]) => unknown) => void
  }
}

declare global {
  type EventHandler<T = unknown> = (event: GcsExtensionEvent) => T | Promise<T>

  const useI18n: () => GcsI18nComposer

  const useFetch: <T = unknown>(
    url: string | (() => string),
    options?: Record<string, unknown>
  ) => GcsFetchResult<T>

  const defineNitroPlugin: (plugin: (nitroApp: GcsNitroApp) => unknown) => unknown

  const useNitroApp: () => GcsNitroApp

  const useCan: () => {
    can: (
      subject: GcsExtensionRbacSubject,
      action: GcsExtensionRbacAction,
      scope?: GcsExtensionScope
    ) => boolean
    canGrant: (
      subject: GcsExtensionRbacSubject,
      action: GcsExtensionRbacAction,
      scope?: GcsExtensionScope
    ) => boolean
    canAny: (checks: Array<{
      subject: GcsExtensionRbacSubject
      action: GcsExtensionRbacAction
      scope?: GcsExtensionScope
    }>) => boolean
  }

  const CommonSaveButton: Component
  const UBadge: Component
  const UButton: Component
  const UCheckbox: Component
  const UFormField: Component
  const UIcon: Component
  const UInput: Component
  const UModal: Component
  const USelect: Component
  const USelectMenu: Component
  const UTable: Component
}

export {}
