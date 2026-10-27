import { defineGcsExtension, type GcsNotificationMapping } from '../src/index'
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
