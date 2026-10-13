import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import {
  createExtensionTestRouteResponse,
  createExtensionTestUiRuntime,
  installExtensionTestUiRuntime
} from '../../src/testing'
import { clearExtensionUiRuntime, getExtensionUiRuntime } from '../../src/ui'

const renderComponent = (
  component: unknown,
  attrs: Record<string, unknown> = {},
  slots: Record<string, (...args: unknown[]) => unknown> = {},
  props: Record<string, unknown> = {}
) => {
  const emit = vi.fn()
  const render = (component as { setup: Function }).setup(props, { attrs, emit, slots }) as () => any
  return { emit, vnode: render() }
}

describe('extension SDK testing runtime', () => {
  afterEach(() => {
    clearExtensionUiRuntime()
    delete (globalThis as { useFetch?: unknown }).useFetch
    delete (globalThis as { useI18n?: unknown }).useI18n
  })

  it('provides interactive host component doubles for extension tests', () => {
    const runtime = createExtensionTestUiRuntime()

    expect(runtime.components.UInput).toBeTruthy()
    expect(runtime.components.CommonCurrencyInput).toBeTruthy()
    expect(runtime.components.UInputTags).toBeTruthy()
    expect(runtime.components.CommonSaveButton).toBeTruthy()
    expect(runtime.components.CommonAssessmentSchemaAccordionSection).toBeTruthy()
    expect(runtime.components.CommonAssessmentSchemaPageSection).toBeTruthy()
    expect(runtime.components.CommonStatusSelect).toBeTruthy()
    expect(h(runtime.components.UTable)).toBeTruthy()
  })

  it('renders compact table headers, data, named row slots and empty content', () => {
    const runtime = createExtensionTestUiRuntime()
    const actions = vi.fn(() => h('button', 'Edit'))
    const columns = [{ accessorKey: 'name', header: 'Name' }, { id: 'actions', header: 'Actions' }]
    const row = { name: 'Sample' }
    const table = renderComponent(runtime.components.CommonCompactTable, { data: [row], columns }, { 'actions-cell': actions })
    expect(table.vnode.type).toBe('table')
    expect(actions).toHaveBeenCalledWith({ row: { original: row, index: 0 } })
    expect(table.vnode.children[1].children[0].children[0].children).toBe('Sample')
    const empty = renderComponent(runtime.components.CommonCompactTable, { data: [], columns, emptyText: 'No items' })
    expect(empty.vnode.children[1].children[0].children[0].children).toBe('No items')
    const slot = renderComponent(runtime.components.CommonCompactTable, {}, { empty: () => 'Custom empty' })
    expect(slot.vnode.children[1].children[0].children[0].children).toBe('Custom empty')
  })

  it('renders selectable record captions and scoped row state, with selection gated at activation', () => {
    const runtime = createExtensionTestUiRuntime()
    const items = [{ id: '9007199254740993', label: 'Current' }, { id: '2', label: 'Previous' }]
    let enabled = true
    const rows = vi.fn((state: { item: typeof items[number]; selected: boolean; selectable: boolean; actionLabel?: string; select: () => void }) =>
      h('td', [h('button', { disabled: !state.selectable, 'aria-label': state.actionLabel, onClick: state.select }, state.item.label)]))
    const header = vi.fn(() => h('th', 'Version'))
    const table = renderComponent(runtime.components.CommonSelectableTable, {}, { header, row: rows } as never, {
      items, selectedId: items[0]!.id, caption: 'Versions de répartition',
      isSelectable: (item: typeof items[number]) => enabled && item.id === items[0]!.id,
      getRowAriaLabel: (item: typeof items[number], selected: boolean) => `${selected ? 'Selected' : 'View'} ${item.label}`
    })
    expect(table.vnode.props).toMatchObject({ role: 'group', tabindex: 0, 'aria-label': 'Versions de répartition' })
    const nativeTable = table.vnode.children[0]
    expect(nativeTable.children[0].children).toBe('Versions de répartition')
    expect(header).toHaveBeenCalledOnce()
    expect(nativeTable.children[2].children[0].props['aria-current']).toBe('true')
    expect(rows.mock.calls[0]![0]).toMatchObject({ item: items[0], selected: true, selectable: true, actionLabel: 'Selected Current' })
    expect(rows.mock.calls[1]![0]).toMatchObject({ item: items[1], selected: false, selectable: false, actionLabel: undefined })
    rows.mock.calls[0]![0].select()
    rows.mock.calls[1]![0].select()
    expect(table.emit).toHaveBeenCalledOnce()
    expect(table.emit).toHaveBeenCalledWith('select', items[0])
    enabled = false
    rows.mock.calls[0]![0].select()
    expect(table.emit).toHaveBeenCalledOnce()
    const empty = renderComponent(runtime.components.CommonSelectableTable, {}, {}, { items: [], selectedId: null, caption: 'Versions' })
    expect(empty.vnode.children[0].children[2].children).toEqual([])
  })

  it('normalizes real Vue kebab-case selectable-table bindings without losing disabled or selected state', async () => {
    const runtime = createExtensionTestUiRuntime()
    const items = [{ id: '1' }, { id: '2' }]
    const rows = vi.fn((state: { selected: boolean; selectable: boolean; actionLabel?: string; select: () => void }) => h('td', String(state.selected)))
    const selected = vi.fn()
    const app = createSSRApp({ render: () => h(runtime.components.CommonSelectableTable, {
      items, caption: 'Versions', 'selected-id': '2', 'is-selectable': () => false, onSelect: selected,
      'get-row-aria-label': (_item: unknown, current: boolean) => current ? 'Selected version' : 'View version'
    }, { row: rows }) })
    expect(await renderToString(app)).toContain('aria-current="true"')
    expect(rows.mock.calls[0]![0]).toMatchObject({ selected: false, selectable: false, actionLabel: undefined })
    expect(rows.mock.calls[1]![0]).toMatchObject({ selected: true, selectable: false, actionLabel: undefined })
    rows.mock.calls[1]![0].select()
    expect(selected).not.toHaveBeenCalled()
    const enabledRows = vi.fn((state: { actionLabel?: string }) => h('td', state.actionLabel))
    await renderToString(createSSRApp({ render: () => h(runtime.components.CommonSelectableTable, {
      items, caption: 'Versions', 'selected-id': '2',
      'get-row-aria-label': (_item: unknown, current: boolean) => current ? 'Selected version' : 'View version'
    }, { row: enabledRows }) }))
    expect(enabledRows.mock.calls[1]![0]).toMatchObject({ actionLabel: 'Selected version' })
  })

  it('provides the standard extension route error response', () => {
    expect(createExtensionTestRouteResponse(409, 'CONFLICT', 'Try again')).toEqual({
      statusCode: 409,
      message: 'Try again',
      data: { code: 'CONFLICT', message: 'Try again' }
    })
  })

  it('executes interactive select, boolean, input, tags, and textarea doubles', () => {
    const runtime = createExtensionTestUiRuntime()
    const select = renderComponent(runtime.components.USelect, {
      modelValue: '2',
      items: [{ label: 'Two', value: 2 }, null]
    })
    expect(select.vnode.children).toHaveLength(2)
    select.vnode.props.onChange({ target: { value: '3' } })
    expect(select.emit).toHaveBeenCalledWith('update:modelValue', '3')

    const checkbox = renderComponent(runtime.components.UCheckbox, { modelValue: true })
    checkbox.vnode.props.onChange({ target: { checked: false } })
    expect(checkbox.emit).toHaveBeenCalledWith('update:modelValue', false)

    const input = renderComponent(runtime.components.UInput, { modelValue: null })
    input.vnode.props.onInput({ target: { value: 'next' } })
    expect(input.emit).toHaveBeenCalledWith('update:modelValue', 'next')

    const currency = renderComponent(runtime.components.CommonCurrencyInput, { modelValue: '99999999999999999.99', currency: 'usd', disabled: true })
    expect(currency.vnode.props.value).toBe('99999999999999999.99')
    expect(currency.vnode.props['data-currency']).toBe('usd')
    expect(currency.vnode.props.disabled).toBe(true)
    currency.vnode.props.onInput({ target: { value: '' } })
    expect(currency.emit).toHaveBeenCalledWith('update:modelValue', '')

    const tags = renderComponent(runtime.components.UInputTags, { modelValue: ['one'] })
    tags.vnode.props.onInput({ target: { value: 'two, ,three' } })
    expect(tags.emit).toHaveBeenCalledWith('update:modelValue', ['two', 'three'])

    const textarea = renderComponent(runtime.components.UTextarea, { modelValue: undefined })
    textarea.vnode.props.onInput({ target: { value: 'body' } })
    expect(textarea.emit).toHaveBeenCalledWith('update:modelValue', 'body')
  })

  it('executes button, accordion, modal, table, and generic doubles', () => {
    const runtime = createExtensionTestUiRuntime()
    const button = renderComponent(runtime.components.CommonSaveButton, { loading: true, label: 'Save' })
    expect(button.vnode.props.disabled).toBe(true)
    button.vnode.props.onClick()
    expect(button.emit).toHaveBeenCalledWith('click')

    expect(renderComponent(runtime.components.UAccordion, { items: ['one'] }, {
      default: (slot: unknown) => slot
    }).vnode.children).toEqual({ item: ['one'], open: true })
    expect(renderComponent(runtime.components.UModal, { open: false }).vnode).toBeNull()
    expect(renderComponent(runtime.components.UModal, { open: true }, {
      header: () => 'header', body: () => 'body', footer: () => 'footer', default: () => 'default'
    }).vnode.children).toHaveLength(4)
    expect(renderComponent(runtime.components.UTable, { data: [{ id: 1 }] }).vnode.children[0].children)
      .toHaveLength(1)
    expect(renderComponent(runtime.components.UAlert, {}, { default: () => 'content' }).vnode.children)
      .toBe('content')
  })

  it('executes every default composable and delegates to supplied Nuxt globals', async () => {
    const runtime = createExtensionTestUiRuntime()
    await expect(runtime.composables.useConfirmDialog()({ title: 'Continue' })).resolves.toBe(true)
    const fallbackFetch = runtime.composables.useFetch<{ id: string }>('/api/test')
    expect(fallbackFetch.data.value).toBeNull()
    await expect(fallbackFetch.refresh()).resolves.toBeUndefined()
    const grouped = runtime.composables.useGroupedTableExpansion({ rows: [], groups: [] })
    expect(grouped.getGroupRowId({} as never, 0)).toBe('group')
    expect(grouped.isGroupedRow({} as never)).toBe(false)
    expect(grouped.isGroupRow({} as never, 'group')).toBe(false)
    expect(grouped.getLeafRows({} as never)).toEqual([])
    expect(grouped.getGroupedRowCount({} as never)).toBe(0)
    expect(grouped.canExpandGroupedRow({} as never)).toBe(false)
    expect(grouped.updateExpandedRows(true)).toBeUndefined()
    expect(runtime.composables.useI18n()).not.toHaveProperty('t')
    expect(runtime.composables.useI18n().n(1234)).toContain('1,234')
    expect(runtime.composables.useToast().add({ title: 'saved' })).toBeUndefined()

    const globalFetch = vi.fn(() => ({ delegated: true }))
    const globalI18n = vi.fn(() => ({ t: () => 'translated' }))
    ;(globalThis as { useFetch?: unknown }).useFetch = globalFetch
    ;(globalThis as { useI18n?: unknown }).useI18n = globalI18n
    expect(createExtensionTestUiRuntime().composables.useFetch('/api/delegated'))
      .toEqual({ delegated: true })
    expect(createExtensionTestUiRuntime().composables.useI18n()).not.toHaveProperty('t')
  })

  it('merges overrides and installs the runtime globally', () => {
    const add = vi.fn()
    const runtime = installExtensionTestUiRuntime({
      composables: {
        ...createExtensionTestUiRuntime().composables,
        useToast: () => ({ add })
      }
    })
    getExtensionUiRuntime().composables.useToast().add({ title: 'saved' })
    expect(getExtensionUiRuntime()).toBe(runtime)
    expect(add).toHaveBeenCalledOnce()
  })
})
