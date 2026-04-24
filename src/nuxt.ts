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

declare global {
  const useI18n: () => GcsI18nComposer

  const useFetch: <T = unknown>(
    url: string | (() => string),
    options?: Record<string, unknown>
  ) => GcsFetchResult<T>
}

export {}
