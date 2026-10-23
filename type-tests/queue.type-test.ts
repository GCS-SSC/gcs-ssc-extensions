import type { GcsExtensionHostCapability } from '../src'
import * as server from '../src/server'
import {
  installGcsQueueRegistrar,
  registerGcsExtensionQueueHandler,
  type GcsQueueContext,
  type GcsQueueHandler,
  type GcsQueueRegistrar
} from '../src/server'

/**
 * Exercises the host services available to a background handler.
 *
 * @param context Host-bound queue services.
 */
const run = async (context: GcsQueueContext): Promise<void> => {
  const db: unknown = context.db
  const authorization = context.createWriteAuthorization('example', 'agency-id')
  await context.runForAgency('agency-id', async () => {
    void [db, authorization]
  })
}

const futureHandler: GcsQueueHandler = { id: 'host:maintenance', queueLevel: 4, run }
const registrar: GcsQueueRegistrar = { register: handler => {
  void handler.queueLevel
} }
registrar.register(futureHandler)

const app = { hooks: { hook: () => {} } }
const installation: void = installGcsQueueRegistrar(app, registrar)
const registration: void = registerGcsExtensionQueueHandler({ extensionKey: 'example', id: 'work', queueLevel: 1, run }, app)
void [installation, registration]

// @ts-expect-error A host bridge requires a callable registration operation.
installGcsQueueRegistrar(app, { register: 'register' })

// @ts-expect-error The superseded hook collection contract is removed.
const legacyRegistration: server.GcsQueueRegistration = registrar
void legacyRegistration

const capability: GcsExtensionHostCapability = 'background-queue'
void capability

// @ts-expect-error The superseded capability is removed from the SDK.
const legacyCapability: GcsExtensionHostCapability = 'l1-queue'
void legacyCapability

// @ts-expect-error The superseded registration helper has no compatibility alias.
void server.registerGcsExtensionL1QueueHandler

// @ts-expect-error Queue registration requires a host-owned level.
const missingLevel: GcsQueueHandler = { id: 'example:work', run }
void missingLevel

// @ts-expect-error Queue levels use numeric host catalog identities.
const stringLevel: GcsQueueHandler = { id: 'example:work', queueLevel: '1', run }
void stringLevel

// @ts-expect-error Per-handler scheduling intervals are not part of the public contract.
const intervalHandler: GcsQueueHandler = { id: 'example:work', queueLevel: 1, intervalMs: 5000, run }
void intervalHandler

// @ts-expect-error Extension registration requires explicit extension ownership.
registerGcsExtensionQueueHandler({ id: 'work', queueLevel: 1, run }, app)
