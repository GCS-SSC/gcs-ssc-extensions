import { computed, defineComponent, h, ref, toValue } from 'vue'
import type { Component, Ref } from 'vue'
import {
  setExtensionUiRuntime
} from './ui.js'
import type {
  GcsExtensionHostComponentName,
  GcsExtensionUiRuntime
} from './ui.js'

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

/**
 * Creates a lightweight interactive stub matching the selected host component's essential test behavior.
 */
const createExtensionTestComponent = (name: GcsExtensionHostComponentName): Component => {
  if (name === 'CommonStatusSelect' || name === 'USelect' || name === 'USelectMenu') {
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

  if (name === 'UInput' || name === 'UInputTags' || name === 'CommonCurrencyInput') {
    return defineComponent({
      name,
      inheritAttrs: false,
      emits: ['update:modelValue'],
      setup(_, { attrs, emit }) {
        return () => h('input', {
          ...(name === 'CommonCurrencyInput' ? { 'data-currency': attrs.currency, 'type': 'text', 'inputmode': 'decimal', 'disabled': attrs.disabled === true } : {}),
          value: Array.isArray(attrs.modelValue) ? attrs.modelValue.join(',') : String(attrs.modelValue ?? ''),
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
          'aria-label': attrs['aria-label'],
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

  if (name === 'CommonSelectableTable') {
    return defineComponent({
      name,
      inheritAttrs: false,
      emits: ['select'],
      props: ['items', 'selectedId', 'caption', 'getRowAriaLabel', 'isSelectable'],
      setup(props, { attrs, emit, slots }) {
        return () => {
          const { items, selectedId, caption, getRowAriaLabel } = props
          const canSelect = (item: { id: string | number }) => typeof props.isSelectable !== 'function' || props.isSelectable(item)
          return h('div', { ...attrs, role: 'group', tabindex: 0, 'aria-label': caption }, [
            h('table', {}, [
              h('caption', { class: 'sr-only' }, String(caption ?? '')),
              h('thead', {}, [h('tr', {}, slots.header?.())]),
              h('tbody', {}, (Array.isArray(items) ? items : []).map(item => {
                const selected = selectedId !== null && selectedId !== undefined && String(item.id) === String(selectedId)
                const selectable = canSelect(item)
                return h('tr', { key: String(item.id), 'aria-current': selected ? 'true' : undefined }, slots.row?.({
                  item,
                  selected,
                  selectable,
                  actionLabel: selectable && typeof getRowAriaLabel === 'function' ? getRowAriaLabel(item, selected) : undefined,
                  select: () => { if (canSelect(item)) emit('select', item) }
                }))
              }))
            ])
          ])
        }
      }
    })
  }

  if (name === 'CommonCompactTable' || name === 'CommonResourceLayout') {
    return defineComponent({
      name,
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        return () => {
          const columns = (Array.isArray(attrs.columns) ? attrs.columns : []) as Array<{ id?: string; accessorKey?: string; header?: string }>
          const rows = (Array.isArray(attrs.data) ? attrs.data : []) as Array<Record<string, unknown>>
          return h('table', [
            h('thead', h('tr', columns.map(column => h('th', column.header)))),
            h('tbody', rows.length ? rows.map((original, index) => h('tr', columns.map(column => {
              const id = column.id ?? column.accessorKey ?? ''
              return h('td', slots[`${id}-cell`]?.({ row: { original, index } }) ?? String(original[id] ?? ''))
            }))) : h('tr', h('td', { colspan: columns.length }, slots.empty?.() ?? String(attrs.emptyText ?? ''))))
          ])
        }
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

  if (name === 'CommonDetailPage') {
    return defineComponent({
      name,
      inheritAttrs: false,
      setup(_, { attrs, slots }) {
        return () => h('div', attrs, slots.body?.() ?? slots.default?.())
      }
    })
  }

  if (name === 'CommonDetailWorkspace') {
    return defineComponent({
      name,
      inheritAttrs: false,
      setup(_, { attrs, slots, emit }) {
        return () => h('div', [
          h('nav', (Array.isArray(attrs.items) ? attrs.items : []).map(item => h('button', {
            'data-section': item.value,
            onClick: () => emit('update:modelValue', item.value)
          }, item.label ?? item.key))),
          slots.actions?.(),
          slots.notices?.(),
          slots.default?.()
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
  'CommonDetailPage',
  'CommonDetailWorkspace',
  'CommonEntityEditorWorkspace',
  'CommonEntityHero',
  'CommonAssessmentSchemaAccordionSection',
  'CommonAssessmentSchemaPageSection',
  'CommonCompletionSection',
  'CommonCompletionPanel',
  'CommonCompactTable',
  'CommonSelectableTable',
  'CommonCurrencyInput',
  'CommonFlowDiagram',
  'CommonPaymentCalculationBreakdown',
  'CommonResourceLayout',
  'CommonTranslatedTabs',
  'CommonSaveButton',
  'CommonSection',
  'CommonStatusBadge',
  'CommonStatusSelect',
  'CommonStreamWorkflowLinks',
  'CommonWorkflowSection',
  'CommonWorkflowSupplementaryInformation',
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

/**
 * Builds a complete test UI runtime from host-component stubs, default composables, and caller overrides.
 */
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

        const data: Ref<T | null | undefined> = ref(null)
        return {
          data,
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
          const runtime = globalI18n() as ReturnType<GcsExtensionUiRuntime['composables']['useI18n']>
          return { locale: runtime.locale, n: runtime.n }
        }

        return {
          n: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-CA', options).format(value),
          locale: ref('en')
        }
      },
      useToast: () => ({
        add: () => undefined
      }),
      useUrlTabState: options => {
        const tabs = computed(() => toValue(options.tabs))
        const defaultTab = computed(() => toValue(options.defaultTab) ?? tabs.value[0]?.value ?? '')
        const selectedTab = ref(defaultTab.value)
        return {
          tabs,
          selectedTab,
          selectedTabKey: computed(() => tabs.value.find(item => item.value === selectedTab.value)?.key ?? ''),
          defaultTab
        }
      },
      ...overrides.composables
    }
  }
}

/**
 * Builds and installs a test UI runtime in the process-global extension runtime holder.
 */
export const installExtensionTestUiRuntime = (
  overrides: Partial<GcsExtensionUiRuntime> = {}
): GcsExtensionUiRuntime => {
  const runtime = createExtensionTestUiRuntime(overrides)
  setExtensionUiRuntime(runtime)

  return runtime
}
