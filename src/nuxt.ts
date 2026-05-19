import type { Component } from 'vue'

export interface GcsRef<T> {
  value: T
}

export interface GcsI18nComposer {
  locale: GcsRef<string>
  t: (key: string, params?: Record<string, unknown>) => string
  n: (value: number, options?: Record<string, unknown>) => string
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

export interface GcsGroupedTableExpansionOptions<Row> {
  rows: Row[] | GcsRef<Row[]> | (() => Row[])
  groups: Array<{
    id: string
    getValue: (row: Row) => string
  }>
  isPlaceholder?: (row: Row) => boolean
  defaultExpanded?: boolean
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

  const CommonSaveButton: Component
  const CommonEntityEditorWorkspace: Component
  const CommonResourceLayoutCard: Component
  const CommonRouteTabs: Component
  const CommonSection: Component
  const CommonStatusBadge: Component
  const UAccordion: Component
  const UAlert: Component
  const UBadge: Component
  const UButton: Component
  const UCheckbox: Component
  const UFormField: Component
  const UIcon: Component
  const UInput: Component
  const UInputTags: Component
  const UModal: Component
  const UProgress: Component
  const USelect: Component
  const USelectMenu: Component
  const USwitch: Component
  const UTable: Component
  const UTextarea: Component
  const UTooltip: Component
}

export {}
