import { defineGcsExtensionMessages } from '../src/index'
import { useExtensionI18n, type GcsExtensionI18n } from '../src/ui'
const messages = defineGcsExtensionMessages({ en: { save: 'Save' }, fr: { save: 'Enregistrer' } })
const check = (runtime: GcsExtensionI18n) => {
  // @ts-expect-error Both locales must contain the same keys.
  defineGcsExtensionMessages({ en: { save: 'Save' }, fr: { other: 'Autre' } })
  useExtensionI18n(messages).t('save')
  // @ts-expect-error Host keys are not part of this catalog.
  useExtensionI18n(messages).t('common.save')
  // @ts-expect-error No catalog-free overload exists.
  useExtensionI18n()
  // @ts-expect-error The host runtime does not provide message lookup.
  runtime.t('common.save')
}
void check
