import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { defineGcsExtensionMessages, translateGcsExtensionMessage } from '../../src/index'
import { clearExtensionUiRuntime, setExtensionUiRuntime, useExtensionI18n } from '../../src/ui'
import { createExtensionTestUiRuntime } from '../../src/testing'

afterEach(clearExtensionUiRuntime)
const messages = defineGcsExtensionMessages({
  en: { greeting: 'Hello {name}: {value} {name}', literal: '@:host.secret | email@example.test' },
  fr: { greeting: '{value} Bonjour {name}', literal: '@:host.secret | courriel@example.test' }
})
describe('extension-owned messages', () => {
  it('validates and freezes detached bilingual catalogs', () => {
    const input = { en: { key: 'One' }, fr: { key: 'Un' } }
    const catalog = defineGcsExtensionMessages(input)
    input.en.key = 'Changed'
    expect(catalog.en.key).toBe('One')
    expect(Object.isFrozen(catalog.en)).toBe(true)
    expect(() => defineGcsExtensionMessages({ en: { a: 'A' }, fr: { b: 'B' } } as never)).toThrow('keys must match')
    expect(() => defineGcsExtensionMessages({ en: { a: '{x}' }, fr: { a: '{y}' } })).toThrow('placeholders must match')
    expect(() => defineGcsExtensionMessages({ en: { a: 1 }, fr: { a: 'Un' } } as never)).toThrow('must be text')
    expect(() => defineGcsExtensionMessages({ en: { a: 'One' }, fr: { a: null } } as never)).toThrow('must be text')
  })
  it('uses literal single-pass named interpolation and explicit missing-key errors', () => {
    expect(translateGcsExtensionMessage(messages, 'en', 'greeting', { name: '$& {value}', value: 0 })).toBe('Hello $& {value}: 0 $& {value}')
    expect(translateGcsExtensionMessage(messages, 'FR-ca', 'greeting', { name: 'Zoé', value: false })).toBe('false Bonjour Zoé')
    expect(translateGcsExtensionMessage(messages, 'unsupported', 'literal')).toBe('@:host.secret | email@example.test')
    expect(() => translateGcsExtensionMessage(messages, 'en', 'greeting')).toThrow('Missing extension message parameter')
    for (const key of ['host.secret', 'toString', '__proto__']) expect(() => translateGcsExtensionMessage(messages, 'en', key as never)).toThrow('Unknown extension message')
  })
  it('reacts to host locale while isolating catalogs and never invoking host t', () => {
    const locale = ref('en'), hostT = vi.fn(() => 'host secret')
    setExtensionUiRuntime(createExtensionTestUiRuntime({ composables: {
      ...createExtensionTestUiRuntime().composables,
      useI18n: () => ({ locale, n: value => String(value), t: hostT })
    } }))
    const first = useExtensionI18n(defineGcsExtensionMessages({ en: { same: 'First' }, fr: { same: 'Premier' } }))
    const second = useExtensionI18n(defineGcsExtensionMessages({ en: { same: 'Second' }, fr: { same: 'Deuxième' } }))
    const label = computed(() => first.t('same'))
    expect(label.value).toBe('First')
    expect(second.t('same')).toBe('Second')
    locale.value = 'fr'
    expect(label.value).toBe('Premier')
    expect(first.locale.value).toBe('fr')
    expect(first.n(42)).toBe('42')
    expect(() => first.t('host.secret' as never)).toThrow('Unknown extension message')
    expect(hostT).not.toHaveBeenCalled()
  })
})
