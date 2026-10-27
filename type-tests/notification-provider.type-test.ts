import { defineGcsExtension, type GcsNotificationMapping, type GcsNotificationNotifier, type GcsNotificationFieldMapping, type GcsNotificationAuthoredFieldMapping, type GcsNotificationAuthoredMapping } from '../src/index'
import {
  defineGcsNotificationProviderAdapter,
  type GcsExtensionConfigurationGuardContext,
  type GcsNotificationProviderContext,
  type GcsNotificationProviderAdapter,
  type GcsNotificationRecoveryResult,
  type GcsNotificationSendResult
} from '../src/server'

defineGcsExtension({
  key: 'notification-fixture',
  name: { en: 'Notifications', fr: 'Notifications' },
  sdkVersion: '^0.3.0',
  configurationAccess: 'manager',
  requiredHostCapabilities: ['notification-provider', 'configuration-access'],
  notificationProvider: { adapter: { path: './server/provider.ts' } }
})

const mapping: GcsNotificationMapping = {
  templateId: 'template-1', personalisation: { name: 'recipient_name' }
}
defineGcsNotificationProviderAdapter({
  resolveMapping: () => mapping,
  prepareDelivery: async () => ({ serviceId: 'service-1' }),
  listTemplates: async () => [],
  getTemplate: async ({ templateId }) => ({ id: templateId, name: 'Approval', kind: 'email', requiredPersonalisation: ['name'] }),
  send: async ({ reference, signal, deliveryContext }) => {
    signal.throwIfAborted()
    void deliveryContext
    return { kind: 'accepted', notificationId: reference }
  }
})

// @ts-expect-error -- acceptance must be explicit, even for providers with no message ID.
const invalidSend: GcsNotificationSendResult = { notificationId: null }
// @ts-expect-error -- found recovery requires a provider message identity.
const invalidRecovery: GcsNotificationRecoveryResult = { kind: 'found' }
void invalidSend
void invalidRecovery

declare const provider: GcsNotificationProviderAdapter
provider.resolveMapping({ agencyConfig: {}, streamId: 'stream-1', streamConfig: {}, notifierId: 'approval.action_required' })
// @ts-expect-error -- Agency configuration alone cannot select a Stream notification mapping.
provider.resolveMapping({ agencyConfig: {}, notifierId: 'approval.action_required' })
// @ts-expect-error -- delivery requires the exact owning Stream and its configuration.
const agencyOnlyContext: GcsNotificationProviderContext = {
  agencyId: 'agency-1', agencyConfig: {}, signal: new AbortController().signal, secrets: { get: async () => null }
}
void agencyOnlyContext

declare const guard: GcsExtensionConfigurationGuardContext
if (guard.notificationNotifiers) {
  const fieldId: string | undefined = guard.notificationNotifiers[0]?.fields[0]?.id
  void fieldId
  // @ts-expect-error -- extensions cannot mutate the host catalog array.
  guard.notificationNotifiers.push({ id: 'invented', name: { en: 'x', fr: 'x' }, fields: [] })
}

const notifier: GcsNotificationNotifier = {
  id: 'host.event', name: { en: 'Event', fr: 'Événement' },
  fields: [{
    id: 'occurred_date', name: { en: 'Date', fr: 'Date' },
    group: { id: 'system', name: { en: 'System', fr: 'Système' } }, type: 'date'
  }]
}
const zonedMappings: GcsNotificationMapping = {
  templateId: 'template-1', personalisation: {
    name: 'recipient_name',
    localDate: { fieldId: 'occurred_date', timeZone: 'America/Toronto' },
    remoteDate: { fieldId: 'occurred_date', timeZone: 'America/Vancouver' }
  }
}
// @ts-expect-error -- every host field declares its group and value type.
const ungroupedField: GcsNotificationNotifier['fields'][number] = { id: 'x', name: { en: 'x', fr: 'x' } }
// @ts-expect-error -- date/time bindings retain the explicitly chosen timezone.
const missingTimeZone: GcsNotificationFieldMapping = { fieldId: 'occurred_date' }
// @ts-expect-error -- notification temporal values support date or time, not a provider-specific type.
const unsupportedFieldType: GcsNotificationNotifier['fields'][number]['type'] = 'timestamp'
void notifier
void zonedMappings
void ungroupedField
void missingTimeZone
void unsupportedFieldType

// Earlier stored recipient-less and temporal bindings remain readable without data loss.
const earlierMapping: GcsNotificationMapping = {
  templateId: 'earlier-template', personalisation: { date: { fieldId: 'event_date', timeZone: 'America/Toronto' }, name: 'agency_name' }
}
const authoredMapping: GcsNotificationAuthoredMapping = {
  templateId: 'new-template', recipientEmail: 'host_email', personalisation: {
    text: 'reference', name: { fieldId: 'agency_name', locale: 'fr' },
    dateEn: { fieldId: 'event_date', timeZone: 'America/Toronto', locale: 'en' },
    dateFr: { fieldId: 'event_date', timeZone: 'America/Vancouver', locale: 'fr' }
  }
}
// @ts-expect-error -- new temporal bindings require explicit locale.
const localeMissing: GcsNotificationAuthoredFieldMapping = { fieldId: 'event_date', timeZone: 'America/Toronto' }
// @ts-expect-error -- recipient is explicitly mapped on new saves.
const recipientMissing: GcsNotificationAuthoredMapping = { templateId: 'x', personalisation: {} }
// @ts-expect-error -- localization is limited to the host's supported languages.
const unsupportedLocale: GcsNotificationAuthoredFieldMapping = { fieldId: 'agency_name', locale: 'es' }
const localizedFieldType: GcsNotificationNotifier['fields'][number]['type'] = 'localized-text'
const emailFieldType: GcsNotificationNotifier['fields'][number]['type'] = 'email'
void earlierMapping
void authoredMapping
void localeMissing
void recipientMissing
void unsupportedLocale
void localizedFieldType
void emailFieldType
