import { defineComponent, h, ref } from 'vue'
import type { Component, Ref } from 'vue'
import {
  setExtensionUiRuntime
} from './ui'
import type {
  GcsExtensionHostComponentName,
  GcsExtensionUiRuntime
} from './ui'

export interface ExtensionTestRouteResponse {
  statusCode: number
  message: string
  data: {
    message: string
    code: string
  }
}

/**
 * Creates a stable error-like response shape for extension route unit tests.
 *
 * @param statusCode HTTP status code to include in the response.
 * @param code Machine-readable extension error code.
 * @param message Human-readable test message.
 * @returns A response object matching the host extension route error shape.
 */
export const createExtensionTestRouteResponse = (
  statusCode: number,
  code: string,
  message: string
): ExtensionTestRouteResponse => ({
  statusCode,
  message,
  data: {
    message,
    code
  }
})

const resolveItemLabel = (item: unknown): string => {
  if (item && typeof item === 'object' && 'label' in item) {
    return String((item as { label?: unknown }).label ?? '')
  }

  return String(item ?? '')
}

const resolveItemValue = (item: unknown): string => {
  if (item && typeof item === 'object' && 'value' in item) {
    return String((item as { value?: unknown }).value ?? '')
  }

  return String(item ?? '')
}

const createExtensionTestComponent = (name: GcsExtensionHostComponentName): Component => {
  if (name === 'USelect' || name === 'USelectMenu') {
    return defineComponent({
      name,
      inheritAttrs: false,
      emits: ['update:modelValue'],
      setup(_, { attrs, emit }) {
        return () => h('select', {
          value: String(attrs.modelValue ?? ''),
          onChange: (event: Event) => {
            emit('update:modelValue', (event.target as HTMLSelectElement).value)
          }
        }, (Array.isArray(attrs.items) ? attrs.items : []).map(item =>
          h('option', { value: resolveItemValue(item) }, resolveItemLabel(item))
        ))
      }
    })
  }

  if (name === 'USwitch' || name === 'UCheckbox') {
    return defineComponent({
      name,
      inheritAttrs: false,
      emits: ['update:modelValue'],
      setup(_, { attrs, emit }) {
        return () => h('input', {
          type: 'checkbox',
          checked: attrs.modelValue === true,
          onChange: (event: Event) => {
            emit('update:modelValue', (event.target as HTMLInputElement).checked)
          }
        })
      }
    })
  }

  if (name === 'UInput' || name === 'UInputTags') {
    return defineComponent({
      name,
      inheritAttrs: false,
      emits: ['update:modelValue'],
      setup(_, { attrs, emit }) {
        const value = Array.isArray(attrs.modelValue) ? attrs.modelValue.join(',') : String(attrs.modelValue ?? '')
        return () => h('input', {
          value,
          onInput: (event: Event) => {
            const nextValue = (event.target as HTMLInputElement).value
            emit('update:modelValue', name === 'UInputTags'
              ? nextValue.split(',').map(item => item.trim()).filter(Boolean)
              : nextValue)
          }
        })
      }
    })
  }

  if (name === 'UTextarea') {
    return defineComponent({
      name,
      inheritAttrs: false,
      emits: ['update:modelValue'],
      setup(_, { attrs, emit }) {
        return () => h('textarea', {
          value: String(attrs.modelValue ?? ''),
          onInput: (event: Event) => {
            emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
          }
        })
      }
    })
  }

  if (name === 'UButton' || name === 'CommonSaveButton') {
    return defineComponent({
      name,
      inheritAttrs: false,
      emits: ['click'],
      setup(_, { attrs, emit, slots }) {
        return () => h('button', {
          type: 'button',
          disabled: attrs.disabled === true || attrs.loading === true,
          onClick: () => emit('click')
        }, slots.default?.() ?? String(attrs.label ?? attrs.icon ?? ''))
      }
    })
  }

  if (name === 'UAccordion') {
    return defineComponent({
      name,
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        return () => h('div', attrs, slots.default?.({ item: attrs.items, open: true }) ?? slots.default?.())
      }
    })
  }

  if (name === 'UModal') {
    return defineComponent({
      name,
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        if (attrs.open === false) {
          return () => null
        }

        return () => h('div', attrs, [
          slots.header?.(),
          slots.body?.(),
          slots.footer?.(),
          slots.default?.()
        ])
      }
    })
  }

  if (name === 'UTable') {
    return defineComponent({
      name,
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        return () => h('table', attrs, [
          h('tbody', (Array.isArray(attrs.data) ? attrs.data : []).map((row, index) =>
            h('tr', { key: index }, slots.default?.({ row }) ?? h('td', JSON.stringify(row)))
          ))
        ])
      }
    })
  }

  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default?.())
    }
  })
}

const hostComponentNames: GcsExtensionHostComponentName[] = [
  'CommonEntityEditorWorkspace',
  'CommonAssessmentSchemaAccordionSection',
  'CommonResourceLayoutCard',
  'CommonRouteTabs',
  'CommonSaveButton',
  'CommonSection',
  'CommonStatusBadge',
  'UAccordion',
  'UAlert',
  'UBadge',
  'UButton',
  'UCheckbox',
  'UFormField',
  'UIcon',
  'UInput',
  'UInputTags',
  'UModal',
  'UProgress',
  'USelect',
  'USelectMenu',
  'USwitch',
  'UTable',
  'UTextarea',
  'UTooltip'
]

export const createExtensionTestUiRuntime = (
  overrides: Partial<GcsExtensionUiRuntime> = {}
): GcsExtensionUiRuntime => {
  const components = Object.fromEntries(
    hostComponentNames.map(name => [name, createExtensionTestComponent(name)])
  ) as Record<GcsExtensionHostComponentName, Component>

  return {
    components: {
      ...components,
      ...overrides.components
    },
    composables: {
      useConfirmDialog: () => async () => true,
      useFetch: <T = unknown>(url: string | (() => string), options?: Record<string, unknown>) => {
        const globalFetch = (globalThis as typeof globalThis & {
          useFetch?: (url: string | (() => string), options?: Record<string, unknown>) => unknown
        }).useFetch
        if (globalFetch) {
          return globalFetch(url, options) as import('./ui').GcsExtensionFetchResult<T>
        }

        return {
          data: ref(null) as Ref<T | null>,
          status: ref('idle' as const),
          pending: ref(false),
          error: ref(null),
          refresh: async () => undefined
        }
      },
      useGroupedTableExpansion: () => ({
        expandedRows: ref({}),
        grouping: ref([]),
        columnVisibility: ref({}),
        groupingOptions: {},
        getGroupRowId: () => 'group',
        isGroupedRow: () => false,
        isGroupRow: () => false,
        getLeafRows: () => [],
        getGroupedRowCount: () => 0,
        canExpandGroupedRow: () => false,
        updateExpandedRows: () => undefined
      }),
      useI18n: () => {
        const globalI18n = (globalThis as typeof globalThis & {
          useI18n?: () => unknown
        }).useI18n
        if (globalI18n) {
          return globalI18n() as ReturnType<GcsExtensionUiRuntime['composables']['useI18n']>
        }

        return {
          t: (key: string) => key,
          n: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-CA', options).format(value),
          locale: ref('en')
        }
      },
      useToast: () => ({
        add: () => undefined
      }),
      ...overrides.composables
    }
  }
}

export const installExtensionTestUiRuntime = (
  overrides: Partial<GcsExtensionUiRuntime> = {}
): GcsExtensionUiRuntime => {
  const runtime = createExtensionTestUiRuntime(overrides)
  setExtensionUiRuntime(runtime)

  return runtime
}
