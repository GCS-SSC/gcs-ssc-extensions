import { h } from 'vue'
import type { GcsExtensionToast } from '../src/ui'

/**
 * Checks supported notification text and render callbacks.
 * @param toast - Public toast adapter.
 * @param translatedText - Current extension catalog message.
 * @param localizedApiMessage - Display-ready API error text.
 */
const checkToastText = (toast: GcsExtensionToast, translatedText: () => string, localizedApiMessage: string) => {
  toast.add({ title: localizedApiMessage, description: localizedApiMessage, color: 'error' })
  toast.add({ title: () => h('span', translatedText()), description: () => h('span', translatedText()), duration: 0 })
  // @ts-expect-error Nuxt UI renders VNodes; a string-returning callback renders blank feedback.
  toast.add({ title: () => translatedText() })
  // @ts-expect-error Description callbacks must return VNodes too.
  toast.add({ description: () => translatedText() })
}
void checkToastText
