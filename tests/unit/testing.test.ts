import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import {
  createExtensionTestRouteResponse,
  createExtensionTestUiRuntime,
  installExtensionTestUiRuntime
} from '../../src/testing'
import { clearExtensionUiRuntime, getExtensionUiRuntime } from '../../src/ui'

const renderComponent = (
  component: unknown,
  attrs: Record<string, unknown> = {},
  slots: Record<string, (...args: unknown[]) => unknown> = {}
) => {
  const emit = vi.fn()
  const render = (component as { setup: Function }).setup({}, { attrs, emit, slots }) as () => any
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
    expect(runtime.components.UInputTags).toBeTruthy()
    expect(runtime.components.CommonSaveButton).toBeTruthy()
    expect(runtime.components.CommonAssessmentSchemaAccordionSection).toBeTruthy()
    expect(runtime.components.CommonStatusSelect).toBeTruthy()
    expect(h(runtime.components.UTable)).toBeTruthy()
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
