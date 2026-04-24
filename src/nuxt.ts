export interface GcsRef<T> {
  value: T
}

export interface GcsI18nComposer {
  locale: GcsRef<string>
  t: (key: string, params?: Record<string, unknown>) => string
}

export type GcsFetchStatus = 'idle' | 'pending' | 'success' | 'error'

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

declare global {
  type EventHandler<T = unknown> = (event: GcsExtensionEvent) => T | Promise<T>

  const useI18n: () => GcsI18nComposer

  const useFetch: <T = unknown>(
    url: string | (() => string),
    options?: Record<string, unknown>
  ) => GcsFetchResult<T>
}

export {}
