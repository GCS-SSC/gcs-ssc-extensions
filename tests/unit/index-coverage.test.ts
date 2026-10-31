import { afterEach, describe, expect, it } from 'vitest'

import {
  defineGcsExtension,
  GCS_EXTENSION_CLAIM_FIELDS,
  GCS_EXTENSION_ENTITIES,
  FetchResponseError,
  getClientRequestUrl,
  throwFetchResponseError
} from '../../src'
import { parseMoney } from '../../src/money'
import type { GcsExtensionMoneyInput } from '../../src/server'

describe('extension SDK fetch errors and manifest identity', () => {
  it('exposes the independently assigned Data Collection as a bilingual core entity', () => {
    expect(GCS_EXTENSION_ENTITIES.find(entity => entity.type === 'commondatacollection'))
      .toEqual({ type: 'commondatacollection', label: { en: 'Data Collections', fr: 'Collectes de données' } })
  })
  it('describes submitted Claim amounts as currency-bearing minor-unit money', () => {
    const field = GCS_EXTENSION_CLAIM_FIELDS.find(field => field.key === 'egcs_fc_amount')
    expect(field).toMatchObject({ collection: 'submitted_line_items', required: true, valueType: 'money' })
    const amount: GcsExtensionMoneyInput = parseMoney({ amount: '1234', currency: 'KWD' })
    expect(amount).toEqual({ amount: '1234', currency: 'KWD' })
    expect(() => parseMoney(1.234)).toThrow()
    expect(() => parseMoney('1.234')).toThrow()
    expect(GCS_EXTENSION_CLAIM_FIELDS.find(field => field.key === 'egcs_fc_periodend')?.valueType).toBe('number')
  })
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('uses URL identity, browser origin, and localhost fallback', () => {
    const absolute = new URL('https://example.test/path')
    expect(getClientRequestUrl(absolute)).toBe(absolute)
    expect(getClientRequestUrl('/fallback').href).toBe('http://localhost/fallback')
    ;(globalThis as { window?: unknown }).window = { location: { origin: 'https://host.test' } }
    expect(getClientRequestUrl('/browser').href).toBe('https://host.test/browser')
  })

  it.each([
    [{ data: { details: [{ message: '' }, { message: 'Nested detail' }] } }, 'Nested detail'],
    [{ details: [{ message: 'Flat detail' }] }, 'Flat detail'],
    [{ data: { message: 'Nested message' } }, 'Nested message'],
    [{ message: 'Flat message' }, 'Flat message'],
    [null, 'Bad Request'],
    [null, 'HTTP 400']
  ])('derives the safest error message from %j', (data, expected) => {
    const response = new Response('', { status: 400, statusText: expected === 'HTTP 400' ? '' : 'Bad Request' })
    expect(new FetchResponseError(response, data).message).toBe(expected)
  })

  it('throws parsed JSON response details', async () => {
    const response = new Response(JSON.stringify({ data: { message: 'Invalid input' } }), {
      status: 422,
      headers: { 'content-type': 'application/json' }
    })
    await expect(throwFetchResponseError(response)).rejects.toMatchObject({
      name: 'FetchResponseError', message: 'Invalid input', data: { data: { message: 'Invalid input' } }
    })
  })

  it('falls back to trimmed and bounded text, status text, then status code', async () => {
    await expect(throwFetchResponseError(new Response(`  ${'x'.repeat(2_010)}  `, { status: 500 })))
      .rejects.toMatchObject({ message: `${'x'.repeat(2_000)}...` })
    await expect(throwFetchResponseError(new Response('', { status: 503, statusText: 'Unavailable' })))
      .rejects.toMatchObject({ message: 'Unavailable' })
    await expect(throwFetchResponseError(new Response('', { status: 500, statusText: '' })))
      .rejects.toMatchObject({ message: 'HTTP 500' })
  })

  it('preserves the exact extension definition object', () => {
    const definition = { key: 'sample' } as never
    expect(defineGcsExtension(definition)).toBe(definition)
  })

  it('exposes declarative Manager configuration without coupling it to an extension key', () => {
    const definition = defineGcsExtension({
      key: 'configuration-fixture', sdkVersion: '^0.4.0',
      name: { en: 'Fixture', fr: 'Test' },
      requiredHostCapabilities: ['configuration-access'], configurationAccess: 'manager'
    })
    expect(definition.configurationAccess).toBe('manager')
    expect(definition.requiredHostCapabilities).toContain('configuration-access')
  })
})
