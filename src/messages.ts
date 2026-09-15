/** Package-owned flat bilingual message catalog. Keys may contain dots. */
export type GcsExtensionMessages = Readonly<{ en: Readonly<Record<string, string>>; fr: Readonly<Record<string, string>> }>
export type GcsExtensionMessageValues = Readonly<Record<string, string | number | boolean>>

const placeholders = (message: string) => [...new Set(Array.from(message.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g), match => match[1]!))].sort()

/** Validates bilingual key/placeholder parity and freezes a detached catalog. */
export const defineGcsExtensionMessages = <const En extends Record<string, string>>(
  messages: { en: En; fr: { [Key in keyof En]: string } }
): Readonly<{ en: Readonly<En>; fr: Readonly<{ [Key in keyof En]: string }> }> => {
  const keys = Object.keys(messages.en).sort()
  if (JSON.stringify(keys) !== JSON.stringify(Object.keys(messages.fr).sort())) throw new Error('Extension message locale keys must match')
  for (const key of keys) {
    const en = messages.en[key]
    const fr = (messages.fr as Record<string, string>)[key]
    if (typeof en !== 'string' || typeof fr !== 'string') throw new Error(`Extension message must be text: ${key}`)
    if (JSON.stringify(placeholders(en)) !== JSON.stringify(placeholders(fr))) throw new Error(`Extension message placeholders must match: ${key}`)
  }
  return Object.freeze({ en: Object.freeze({ ...messages.en }), fr: Object.freeze({ ...messages.fr }) })
}

/** Resolves only an own catalog key; never falls back to host messages or linked keys. */
export const translateGcsExtensionMessage = <Catalog extends GcsExtensionMessages>(
  messages: Catalog, locale: string, key: keyof Catalog['en'] & string, values: GcsExtensionMessageValues = {}
): string => {
  const selected = locale.toLowerCase().split('-')[0] === 'fr' ? messages.fr : messages.en
  if (!Object.prototype.hasOwnProperty.call(selected, key)) throw new Error(`Unknown extension message: ${key}`)
  return selected[key]!.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) throw new Error(`Missing extension message parameter: ${name}`)
    return String(values[name])
  })
}
