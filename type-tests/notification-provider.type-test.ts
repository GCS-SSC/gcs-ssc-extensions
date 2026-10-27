import { defineGcsExtension, type GcsNotificationMapping } from '../src/index'
import {
  defineGcsNotificationProviderAdapter,
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
