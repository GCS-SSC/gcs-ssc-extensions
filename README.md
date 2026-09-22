# @gcs-ssc/extensions

Public SDK contracts for GCS-SSC extensions.

Extensions should import host-facing types and helpers from this package instead of importing from `~~/shared`, `~~/server`, or other host-internal paths.

## Money write inputs

Extension-to-host money writes use `GcsExtensionMoneyInput` from `@gcs-ssc/extensions/server`. Send canonical plain decimal text with at most two fractional digits. Text is authoritative and supports the host's full persisted money range; for example, use `'1234.56'` rather than `1234.56`.

Payment amount calculators emit `GcsPaymentAmountCalculatorResult` from `@gcs-ssc/extensions/ui`. Its monetary result and detail fields use canonical two-decimal strings; calculators must not emit JavaScript numbers for money.

Finite JavaScript numbers remain accepted only for backwards compatibility. The host accepts them only when they round-trip to exact cents within the safe integer range. New extensions must not use numbers for money, and must not round, truncate, or convert money through `Number` before calling a host write contract.

## Installation

Use the published or tagged SDK dependency from standalone extension packages:

```json
{
  "dependencies": {
    "@gcs-ssc/extensions": "^0.3.0"
  }
}
```

The host application may consume this package through a local workspace while SDK contracts are being developed. Extension repositories should use a normal versioned SDK dependency so editor IntelliSense, typechecking, and tests do not require the full host application checkout.

## Entry Points

- `@gcs-ssc/extensions` exposes manifest, JSON, and client-safe extension types.
- `@gcs-ssc/extensions/server` exposes server-safe schemas and route helpers.
- `@gcs-ssc/extensions/ui` exposes host-provided UI wrappers, component prop contracts, extension composables, and the extension API client.
- `@gcs-ssc/extensions/testing` exposes test-only helpers for extension repositories.
- `@gcs-ssc/extensions/nuxt` exposes minimal ambient Nuxt host globals for standalone extension typechecking.
- The Nuxt entry point declares host-provided globals for typechecking only. Extension UI should import wrappers from `@gcs-ssc/extensions/ui` instead of using host component names directly.

## Import Rules

Extension packages should not import from host application aliases such as `~~/shared`, `~~/server`, `~/`, or `#imports` for SDK-owned contracts. If a type or helper is needed by an extension, add it here first and then consume it through one of the public entry points.

```ts
import { defineGcsExtension } from '@gcs-ssc/extensions'
import type { GcsExtensionJsonConfig } from '@gcs-ssc/extensions'
import {
  AssessmentDefinitionSchema,
  createGcsExtensionUserError,
  defineGcsExtensionNitroPlugin,
  getExtensionKvEntry,
  defineGcsExtensionMigration,
  registerGcsExtensionCreateOperationHandler,
  setExtensionKvEntry,
  resolveExtensionStreamContext
} from '@gcs-ssc/extensions/server'
import {
  ExtensionButton,
  ExtensionSaveButton,
  useExtensionApi,
  useExtensionI18n
} from '@gcs-ssc/extensions/ui'
```

## UI Boundary

Extension components must not import from host aliases such as `~/`, `~~/`, `#imports`, `#app`, or `#gcs-*`.
They should also avoid direct template usage of host component names such as `CommonSaveButton`, `CommonSection`, `UButton`, or `UTable`.
Use the SDK UI wrappers instead:

```vue
<script setup lang="ts">
import { ExtensionButton, ExtensionFormField, useExtensionI18n } from '@gcs-ssc/extensions/ui'

import { messages } from '../i18n/messages'
const { t } = useExtensionI18n(messages)
</script>

<template>
  <ExtensionFormField :label="t('example.label')">
    <ExtensionButton icon="i-lucide-save" />
  </ExtensionFormField>
</template>
```

The wrappers preserve the host look and behavior while keeping extensions coupled to a stable SDK contract instead of app-internal component names.

The host installs the concrete UI runtime with `setExtensionUiRuntime`. Extension tests can install lightweight stubs with `installExtensionTestUiRuntime` from `@gcs-ssc/extensions/testing`.

Use `useExtensionApi(extensionKey)` for extension-owned routes and `useHostApi()` for stable host API routes. Extensions that call `useHostApi()` must declare `host-api-client` in `requiredHostCapabilities`. Do not call `fetch` or build `/api/...` URLs directly in extension components.

Lifecycle entity UI may use `ExtensionCompletionSection` and `ExtensionWorkflowSection` for the standard host presentation. Extensions that need a custom presentation use `useHostLifecycleApi()`, whose typed methods cover Completion state and execution, eligible standard Workflow discovery, and explicit Workflow start. The host still resolves scope, assignment, status eligibility, publication state, and concurrency; the extension supplies only the exact qualified target and, for an explicit start, the selected `workflowSetupId`.

```ts
import { useHostApi } from '@gcs-ssc/extensions/ui'

const hostApi = useHostApi()
const response = await hostApi.get<{ items: unknown[] }>('/api/transfer-payments/1/outcomes')
```

## File storage providers

An extension may contribute one object-storage adapter through `fileStorageProvider`. It must declare the `file-storage-provider` host capability. The extension key is the permanent provider ID recorded with each stored object; changing it creates a different provider and makes existing objects unreachable through the old identity.

```ts
import { defineGcsExtension } from '@gcs-ssc/extensions'

export default defineGcsExtension({
  key: 'gcs-storage-example',
  sdkVersion: '^0.3.0',
  requiredHostCapabilities: ['file-storage-provider'],
  name: { en: 'Example storage', fr: 'Stockage exemple' },
  fileStorageProvider: {
    adapter: { path: './server/storage-adapter.ts' }
  }
})
```

The host owns attachment records, business context, filenames, MIME declarations, attachment types, authorization, lifecycle checks, upload/download APIs, and provider selection. The adapter owns only object I/O. `writeObject` receives a collision-resistant opaque object name, bytes, MIME type, agency, purpose, optional explicit business target, non-secret agency configuration, a server-only agency/provider-scoped `secrets.get(key)` reader, and optional provider metadata. It returns a stable provider object ID and an opaque JSON locator. The final object ID must be non-empty and at most `GCS_FILE_STORAGE_PROVIDER_OBJECT_ID_MAX_BYTES` UTF-8 bytes. A provider that derives the identity from configuration plus `objectName` must validate the exact final identity before resolving credentials, constructing a remote client, or starting a write. `readObject` and idempotent `deleteObject` receive that recorded identity and the same scoped secret reader. Locators and the secret reader are server-only and must never enter client manifests or component props.

```ts
import {
  defineGcsFileStorageProviderAdapter,
  GCS_FILE_STORAGE_PROVIDER_OBJECT_ID_MAX_BYTES
} from '@gcs-ssc/extensions/server'

export default defineGcsFileStorageProviderAdapter({
  async writeObject(input) {
    // Persist input.bytes under input.objectName.
    if (new TextEncoder().encode(input.objectName).byteLength > GCS_FILE_STORAGE_PROVIDER_OBJECT_ID_MAX_BYTES) {
      throw new Error('Provider object identity is too long')
    }
    return {
      objectId: input.objectName,
      locator: { key: input.objectName }
    }
  },
  async readObject(context) {
    return { bytes: new Uint8Array(), contentType: 'application/octet-stream' }
  },
  async deleteObject(context) {
    // Treat an already absent object as success.
  }
})
```

Provider configuration is ordinary JSON-safe agency configuration. Credentials and tokens use the encrypted extension-secret APIs and must not be placed in configuration, locators, metadata, or client manifests.

### Optional provider metadata

A provider may declare a package-contained Vue form and server validator/normalizer. The declaration specifies a positive integer `contractVersion`, whether normalized JSON is persisted by the `host` or `provider`, and whether it is `upload-only` or `editable`.

```ts
fileStorageProvider: {
  adapter: { path: './server/storage-adapter.ts' },
  metadata: {
    component: { path: './components/StorageMetadata.vue' },
    validator: { path: './server/storage-metadata.ts' },
    persistence: 'host',
    mutability: 'editable',
    contractVersion: 1
  }
}
```

The validator is defined with `defineGcsFileStorageMetadataValidator`. It receives JSON object metadata plus create/update mode, agency, purpose, target, contract version, and agency configuration, and returns normalized JSON. Provider-managed editable metadata additionally requires `readProviderMetadata` and `updateProviderMetadata` on a `GcsFileStorageProviderManagedMetadataAdapter`.

The Vue form implements `GcsFileStorageMetadataComponentProps` and emits `update:modelValue` with a JSON object. Its props include create/update mode, the typed target context, `disabled`, and `readOnly`. Provider metadata is namespaced to its provider and size-bounded by the host. It cannot replace or override attachment type, business target, agency ownership, filename, MIME type, or authorization fields.

All adapter, validator, and component paths are resolved inside the extension package. Adapter and validator modules are registered only in the server registry. Only safe metadata presentation details and the generated component identity may enter the browser registry.

## Entity Tabs And RBAC

## Stream Configuration Components

Extensions can declare `configurationAccess: 'manager'` together with the
`configuration-access` host capability to require Manager authority for their
host-managed enablement and JSON configuration writes. The host checks Agency
authority for Agency settings and Program authority at the resolved owner scope
for Stream settings, including a fresh check inside the write transaction.
Omitting the declaration retains Contributor access; an explicit `'contributor'`
value is also supported. Scoped Viewers retain read access to non-secret
configuration. Registry responses include `canConfigure` for host UI controls.
This contract does not grant extension-owned handlers authority: their declared
RBAC remains independently enforced. SDK 0.2.2 introduces this contract.

Extensions can render a stream-level configuration component with `admin.streamConfig`.
The host passes the editable JSON config with `v-model` plus stable stream context props:

```vue
<script setup lang="ts">
import type { GcsClientExtensionManifest, GcsExtensionJsonConfig } from '@gcs-ssc/extensions'

const {
  extension,
  streamId,
  transferPaymentId,
  agencyId
} = defineProps<{
  extension: GcsClientExtensionManifest
  streamId: string
  transferPaymentId?: string
  agencyId?: string
}>()

const config = defineModel<GcsExtensionJsonConfig>({ required: true })
</script>
```

`transferPaymentId` is the owning transfer payment profile id. `agencyId` is the owning agency id when the host already has it loaded. Components should still tolerate either optional prop being absent for older hosts.

Extensions can add tabs to funding case agreements, proponents, claims, and monitors through `client.tabs`:

```ts
export default defineGcsExtension({
  key: 'gcs-example',
  sdkVersion: '^0.3.0',
  requiredHostCapabilities: ['server-handlers', 'server-handler-rbac'],
  name: { en: 'Example', fr: 'Exemple' },
  client: {
    tabs: [
      {
        target: 'agreement',
        id: 'risk-notes',
        label: { en: 'Risk notes', fr: 'Notes de risque' },
        icon: 'i-lucide-database',
        path: './components/AgreementRiskNotesTab.vue',
        rbac: { subject: 'agreement', action: 'update' }
      }
    ]
  }
})
```

Tab paths are validated by the host scanner and must stay inside the extension package. Component definitions declare only their package-contained `path`; the host generates the runtime `componentName`, and extension authors cannot override it. Tab ids are lowercase kebab-case and must be unique per extension target.

The host shows tabs only when the extension is enabled for the selected agency, stream-scoped entities are enabled for the transfer payment stream, and the current user passes the declared RBAC check. Proponent tabs use an explicit active agency context checked against the user's grant; the Proponent's tracking lead agency does not select that context.

Extensions can add inline fields to host-owned agreement profile sections through `client.slots`. For agreement risk data, use `agreement.profile.risk-management.fields`; the host owns the standard holdback, holdback basis, and risk score fields, and extension fields render inside the same Risk Management section.

```ts
export default defineGcsExtension({
  key: 'gcs-example',
  sdkVersion: '^0.3.0',
  requiredHostCapabilities: ['textarea-slots', 'extension-ui'],
  name: { en: 'Example', fr: 'Exemple' },
  client: {
    slots: [
      {
        slot: 'agreement.profile.risk-management.fields',
        path: './components/AgreementRiskFields.vue'
      }
    ]
  }
})
```

Tab components receive the entity context and extension configuration as props:

```vue
<script setup lang="ts">
import type { ExtensionEntityTabContext, GcsExtensionJsonConfig, GcsExtensionRbacRequirement } from '@gcs-ssc/extensions'

const {
  extensionKey,
  context,
  config,
  rbac
} = defineProps<{
  extensionKey: string
  context: ExtensionEntityTabContext
  config: GcsExtensionJsonConfig
  rbac: GcsExtensionRbacRequirement
}>()
</script>
```

Extensions can also opt server routes into host RBAC:

```ts
export default defineGcsExtension({
  key: 'gcs-example',
  sdkVersion: '^0.3.0',
  requiredHostCapabilities: ['server-handlers', 'server-handler-rbac'],
  name: { en: 'Example', fr: 'Exemple' },
  serverHandlers: [
    {
      route: '/agreements/[agreementId]/risk-notes',
      method: 'post',
      path: './server/api/risk-notes.post.ts',
      rbac: {
        subject: 'agreement',
        action: 'update',
        entity: {
          target: 'agreement',
          param: 'agreementId'
        }
      }
    }
  ]
})
```

The host resolves the entity from the declared route param, verifies extension enablement, enforces RBAC, and then calls the extension handler. Handlers without host RBAC must explicitly set `auth: 'manual'` and perform their own domain authorization. Manual handlers still run only after user authentication, and agency/stream-scoped handlers are blocked when the extension is disabled for that agency.

Extension route handlers receive a stable SDK context object. Prefer `params`, `db`, `config`, `entity`, `stream`, `agency`, `authorizedScope`, `readBody`, and `getHeader` from that context instead of reading host H3 internals:

```ts
import { defineGcsExtensionRouteHandler } from '@gcs-ssc/extensions/server'

export default defineGcsExtensionRouteHandler(async ({ db, params, readBody }) => {
  const agreementId = params.agreementId
  const body = await readBody<{ note: string }>()

  return {
    ok: true,
    agreementId,
    note: body.note,
    dbAvailable: Boolean(db)
  }
})
```

Use only the RBAC subjects and actions already exposed by GCS-SSC. The extension SDK does not support custom RBAC subjects.

## Commitment And Payment Create Actions

Extensions can add or replace the create actions on agreement commitments and payments:

```ts
export default defineGcsExtension({
  key: 'gcs-example',
  sdkVersion: '^0.3.0',
  requiredHostCapabilities: ['create-actions', 'extension-ui', 'extension-lifecycle-hooks'],
  name: { en: 'Example', fr: 'Exemple' },
  client: {
    createActions: [
      {
        operation: 'agreement.payments.create',
        id: 'generate-payments',
        mode: 'replace',
        label: { en: 'Generate payments', fr: 'Generer les paiements' },
        icon: 'i-lucide-wand-sparkles',
        path: './components/GeneratePaymentsAction.vue',
        rbac: { subject: 'agreement', action: 'update' }
      }
    ]
  },
  nitroPlugin: './server/plugins/create-hooks.ts'
})
```

`mode: 'append'` keeps the host Add button and shows the extension action beside it. `mode: 'replace'` hides the host Add button when exactly one enabled replacement exists. If multiple enabled extensions replace the same operation, the host blocks the create action until configuration is fixed.

Create action components receive `extensionKey`, `operation`, `context`, `config`, `rbac`, bilingual `label`, optional `icon`, and an `onCreated` callback prop. Call `onCreated()` after the extension route successfully creates records so the host refreshes the table.

Extensions can intercept host create routes from a Nitro plugin:

```ts
import {
  createGcsExtensionUserError,
  defineGcsExtensionNitroPlugin,
  getExtensionKvEntry,
  registerGcsExtensionCreateOperationHandler
} from '@gcs-ssc/extensions/server'

export default defineGcsExtensionNitroPlugin(nitroApp => {
  registerGcsExtensionCreateOperationHandler('gcs-example', 'agreement.payments.create', async context => {
    const source = await getExtensionKvEntry(
      context.trx,
      context.extensionKey,
      'fundingcaseagreement',
      context.agreementId,
      'payment-rules'
    )

    if (!source) {
      throw createGcsExtensionUserError({
        code: 'GCS_EXAMPLE_PAYMENT_RULES_MISSING',
        message: {
          en: 'Configure payment rules before creating this payment.',
          fr: 'Configurez les regles de paiement avant de creer ce paiement.'
        },
        details: [{
          path: 'payment-rules',
          message: {
            en: 'Payment rules are missing.',
            fr: 'Les regles de paiement sont manquantes.'
          }
        }]
      })
    }

    if (!context.createdRecord) {
      const payment = await context.trx
        .insertInto('Funding_Case_Agreement_Payment')
        .values({ /* extension-generated values */ })
        .returningAll()
        .executeTakeFirstOrThrow()

      return { status: 'handled', response: payment }
    }

    await context.trx
      .insertInto('extensions.gcs_example_audit')
      .values({ payment_id: String(context.createdRecord.id) })
      .execute()
  }, nitroApp)
})
```

When a handler returns `{ status: 'handled', response }` before the host insert, the host skips its default create logic and returns the extension response. When no handler takes over, the host creates the normal draft record and calls handlers again with `createdRecord` inside the same transaction. Throwing `createGcsExtensionUserError(...)` communicates a user-correctable error and rolls back the transaction. Unexpected errors also roll back and are treated as system errors.

Extensions that generate durable records from agency or stream configuration can call
`lockGcsExtensionLifecycleScope(context.trx, context.extensionKey, context.agencyId, context.streamId)`
before entity-level locks and then re-read their current configuration. The host takes the same
transaction-scoped lock for agency and stream configuration writes. Agency scope is always locked
before stream scope, which serializes configuration changes, disable guards, and generated work
without changing existing hook contracts. The helper and lifecycle guard payloads require an active
Kysely `Transaction`; a root `Kysely` client is intentionally rejected by the TypeScript contract
because transaction-scoped advisory locks would otherwise be released after each statement.

Extensions that own durable agreement history can register
`registerGcsExtensionAgreementDeleteGuard(...)`. The host invokes this guard after extension lifecycle
and agreement row locks are acquired and before the agreement is soft-deleted, using the same
transaction. Throw `createGcsExtensionUserError(...)` to block deletion and roll back the host write.

Extension routes that expose agreement choices must use
`context.agreementAccess.listVisibleOptions(db, { streamId, action })`; the host filters active
agreements through its agreement-level role and team visibility rules. An extension transaction
that writes an agreement-owned record must first call `writeAuthorization.lockAuthState(trx)`, take
its registered lifecycle locks, reauthorize its current route scope, and then call
`writeAuthorization.lockAndAuthorizeAgreement?.(trx, { agreementId, streamId, action })`. The host
locks the agreement row, re-resolves its active stream scope, and performs fresh agreement
authorization on the same transaction. A `false` result means the agreement is inactive or has
moved outside the requested stream; authorization denial is thrown by the host.

### Extension-Owned User Errors

Extensions own their user-facing rule and validation messages. Do not pass host i18n keys such as `validation.date_range` to `createGcsExtensionUserError(...)`; the host will not translate them for you. Instead, keep a small extension-owned error catalog and pass bilingual `{ en, fr }` message objects.

The host resolves the request locale and serializes extension user errors as the standard API error payload:

```json
{
  "data": {
    "code": "GCS_EXAMPLE_PAYMENT_RULES_MISSING",
    "message": "Configure payment rules before creating this payment.",
    "details": [
      {
        "path": "payment-rules",
        "code": "GCS_EXAMPLE_PAYMENT_RULES_MISSING",
        "message": "Payment rules are missing."
      }
    ]
  }
}
```

Client components should display `data.details[0].message` when the error points at a specific field or option, then fall back to `data.message`. Host and extension UI code should not show `response.statusText` for extension route failures because that loses the helpful bilingual message.

Recommended server pattern:

```ts
import {
  createGcsExtensionUserError,
  type GcsExtensionLocalizedMessage
} from '@gcs-ssc/extensions/server'

type ExampleErrorCode =
  | 'GCS_EXAMPLE_INVALID_PAYMENT'
  | 'GCS_EXAMPLE_PAYMENT_PERIOD_INVALID'

const errorMessages: Record<ExampleErrorCode, GcsExtensionLocalizedMessage> = {
  GCS_EXAMPLE_INVALID_PAYMENT: {
    en: 'Review the payment fields before saving.',
    fr: 'Verifiez les champs du paiement avant d enregistrer.'
  },
  GCS_EXAMPLE_PAYMENT_PERIOD_INVALID: {
    en: 'Period end must be the same as or after period start.',
    fr: 'La periode de fin doit etre identique ou posterieure a la periode de debut.'
  }
}

const getMessage = (code: ExampleErrorCode) => errorMessages[code]

export const createExamplePaymentError = (
  code: ExampleErrorCode,
  path?: string
) => createGcsExtensionUserError({
  code,
  message: getMessage(code),
  details: path
    ? [{
        path,
        code,
        message: getMessage(code)
      }]
    : undefined
})
```

For extension-owned Zod validation, prefer mapping `safeParse` issues into `createGcsExtensionUserError(...)` details. The schema can use stable extension-owned issue codes, but the user-facing English/French text should still come from the extension error catalog:

```ts
const parsed = PaymentSchema.safeParse(await readBody(event))
if (!parsed.success) {
  throw createGcsExtensionUserError({
    code: 'GCS_EXAMPLE_INVALID_PAYMENT',
    message: getMessage('GCS_EXAMPLE_INVALID_PAYMENT'),
    details: parsed.error.issues.map(issue => ({
      path: issue.path.join('.'),
      code: 'GCS_EXAMPLE_PAYMENT_PERIOD_INVALID',
      message: getMessage('GCS_EXAMPLE_PAYMENT_PERIOD_INVALID')
    }))
  })
}
```

Use stable, namespaced codes for tests and fallback handling, and write messages as next actions the user can take. For example, prefer “Select a fiscal year before calculating the automated payment.” over “Invalid request.”

## Extension Database Migrations

Extensions may declare explicit Kysely migration files in `extension.config.ts`:

```ts
export default defineGcsExtension({
  key: 'gcs-example',
  sdkVersion: '^0.3.0',
  requiredHostCapabilities: ['migrations'],
  name: { en: 'Example', fr: 'Exemple' },
  migrations: [
    { path: './server/migrations/0001_items.ts' }
  ]
})
```

Migration paths are resolved by the host scanner and must stay inside the extension package directory. Escaped paths and symlinks that resolve outside the package are rejected.

Migration files should export a Kysely migration, and may use the server helper for typechecking:

```ts
import { defineGcsExtensionMigration } from '@gcs-ssc/extensions/server'

export default defineGcsExtensionMigration({
  async up(db) {
    await db.schema
      .createTable('extensions.gcs_example_items')
      .addColumn('id', 'bigserial', col => col.primaryKey())
      .execute()
  }
})
```

Custom extension tables should live in the existing `extensions` schema and use a sanitized extension-key prefix. For example, `gcs-example` owns tables such as `extensions.gcs_example_items`. The host records migration history in extension-specific tables in the same `extensions` schema.

The host applies pending migrations when an agency enables an extension. The agency extension UI also exposes a manual action for enabled extensions that applies pending migrations after an extension update. Already-recorded migration files are not re-run, so extension updates must add new migration files for new database changes.

### Lifecycle entities

Business entities that participate in host Completion and Workflow orchestration use the optional `entities` contribution and the `lifecycle-entities` capability:

```ts
export default defineGcsExtension({
  key: 'gcs-example',
  sdkVersion: '^0.3.0',
  requiredHostCapabilities: ['lifecycle-entities', 'migrations'],
  name: { en: 'Example', fr: 'Exemple' },
  entities: [{
    type: 'service-case',
    label: { en: 'Service case', fr: 'Dossier de service' },
    completion: 'supported',
    approvalSubmission: 'on_completion',
    standardWorkflow: 'explicit',
    supportsDirectReviews: true,
    ownerKind: 'agreement',
    assignmentMode: 'independent',
    adapter: { path: './server/service-case-adapter.ts' }
  }],
  migrations: [{ path: './server/migrations/0001_service_case.ts' }]
})
```

The host qualifies the local type as `gcs-example:service-case`. Treat that qualified value as permanent. Changing the extension key or local type is a persisted identity change, not a display-name edit. The host validates and registers the declaration before running the extension migration; duplicate, unavailable, or incompatible declarations are rejected.

The three lifecycle capabilities are orthogonal. `completion: 'supported'` exposes Completion, while `approvalSubmission: 'on_completion'` asks the host to select and start an eligible approval-submission Workflow atomically when Completion occurs. `approvalSubmission: 'none'` permits Completion without that orchestration. `standardWorkflow: 'explicit'` exposes eligible standard Workflows for deliberate user selection and never starts one as a Completion side effect.

Create the concrete table with a bigint identity column, then attach the host identity after the table exists:

```ts
import {
  attachGcsLifecycleEntityIdentity,
  defineGcsExtensionMigration
} from '@gcs-ssc/extensions/server'

export default defineGcsExtensionMigration({
  async up(db) {
    await db.schema
      .createTable('extensions.gcs_example_service_case')
      .addColumn('id', 'bigint', col => col.primaryKey())
      .addColumn('_deleted', 'boolean', col => col.notNull().defaultTo(false))
      .execute()

    await attachGcsLifecycleEntityIdentity(db, {
      extensionKey: 'gcs-example',
      localType: 'service-case',
      table: 'gcs_example_service_case',
      ownerKind: 'agreement',
      ownerIdColumn: 'agreement_id'
    })
  }
})
```

For a Proponent owned lifecycle entity, add a bigint agency column to the concrete table and pass it as `ownerAgencyColumn` with `ownerKind: 'proponent'`. The SDK pins that selected agency in `Common_Extension_Entity_Owner` when the row is inserted and prevents later changes to the concrete owner or agency columns. Select the agency explicitly from an active role context; the Proponent's tracking lead agency does not provide lifecycle authorization.

The server adapter is defined with `defineGcsLifecycleEntityAdapter(...)`. It implements identity registration, owner/scope/status resolution, canonical locking, Completion validation, and status mutation; `onPositiveTerminus` is optional. The adapter exposes domain facts inside a host transaction. It never authorizes a request or creates host Completion, Workflow, Runtime, Approval, Review, status-history, or assignment evidence itself.

## Key-Value Storage

The host-managed `extensions.kv_entry` table remains available for entity-associated extension data. The SDK server entry point exposes helpers:

```ts
import {
  getExtensionKvEntry,
  setExtensionKvEntry,
  deleteExtensionKvEntry
} from '@gcs-ssc/extensions/server'

await setExtensionKvEntry(
  event.context.$db,
  'gcs-example',
  'fundingcaseagreement',
  context.ownerId,
  'risk-notes',
  { notes: 'Review before approval.' }
)

const stored = await getExtensionKvEntry(
  event.context.$db,
  'gcs-example',
  'fundingcaseagreement',
  context.ownerId,
  'risk-notes'
)
```

Use the tab context `ownerType` and `ownerId` props when storing tab data for an agreement, proponent, claim, or monitor.

Do not store private keys, API tokens, bearer tokens, refresh tokens, signing secrets, or other sensitive material in extension config or `extensions.kv_entry`. Extension configuration is editable through host UI and may be returned to client components. Key-value entries are JSON data for ordinary extension state, not a secret store.

## Sensitive Secret Storage

Extensions that need sensitive server-side values should use the encrypted secret helpers from `@gcs-ssc/extensions/server`:

```ts
import {
  deleteEncryptedExtensionSecret,
  getEncryptedExtensionSecret,
  setEncryptedExtensionSecret
} from '@gcs-ssc/extensions/server'

await setEncryptedExtensionSecret(event.context.$db, {
  rootKey: getRuntimeSecretRootKey(),
  extensionKey: 'gcs-example',
  ownerType: 'agency',
  ownerId: agencyId,
  secretKey: 'primary-api-key',
  value: {
    token: requestBody.token
  },
  metadata: {
    label: 'Primary API key',
    lastFour: requestBody.token.slice(-4)
  }
})

const secret = await getEncryptedExtensionSecret(event.context.$db, {
  rootKey: getRuntimeSecretRootKey(),
  extensionKey: 'gcs-example',
  ownerType: 'agency',
  ownerId: agencyId,
  secretKey: 'primary-api-key'
})

await deleteEncryptedExtensionSecret(
  event.context.$db,
  'gcs-example',
  'agency',
  agencyId,
  'primary-api-key'
)
```

The host stores encrypted secrets in `extensions.secret_entry`. The sensitive JSON `value` is encrypted with AES-256-GCM before it is written to the database. The table stores ciphertext, IV, authentication tag, algorithm, key version, owner identifiers, and optional metadata. Metadata is deliberately plaintext so UI can list non-sensitive details such as a credential label, key id, user id, or masked suffix. Never put the secret itself in metadata.

Encryption uses authenticated additional data built from `extensionKey`, `ownerType`, `ownerId`, `secretKey`, and key version. That means ciphertext copied to another extension, owner, or secret key will not decrypt successfully. Updates replace the encrypted value for the active owner/key tuple, and deletes soft-delete the active row.

The `rootKey` is the deployment secret that protects all extension secrets. In the host app this is supplied as `GCS_EXTENSION_SECRETS_KEY`, a base64-encoded 32-byte key. Keep this root key in deployment secret management, not in extension config, seed data, source control, or browser-visible runtime config. Rotating this key requires a deliberate migration or re-save flow because existing ciphertext was encrypted with the previous key.

Local demo data may deliberately seed non-production credentials with a fixed development root key so a clean dev database is immediately usable. Do not use that pattern for production or shared real environments.

Recommended extension pattern:

- Put the secret entry UI at the narrowest owner scope that makes sense, usually agency-level when multiple streams should reuse a credential.
- Save the secret through an extension server route that enforces host RBAC before calling `setEncryptedExtensionSecret`.
- Return only metadata from list routes. Do not return the decrypted `value` to browser code after saving.
- Store only a stable reference such as `credentialId` in stream/entity config.
- Decrypt with `getEncryptedExtensionSecret` only inside server routes, background jobs, or materializers that need the credential at runtime.
- Use `deleteEncryptedExtensionSecret` for user-triggered credential removal so the secret follows the host soft-delete model.

For standalone Vue/Nuxt extension typechecking, include the ambient host declarations in the extension `tsconfig.json` only when the extension uses Nuxt globals directly:

```json
{
  "compilerOptions": {
    "types": ["@gcs-ssc/extensions/nuxt"]
  }
}
```

## Validation

Run the SDK typecheck before publishing changes:

```sh
bun install
bun run typecheck
bun run test:unit
bun run test:coverage
bun run build
```

The package includes a `prepare` script, so GitHub-based installs build `dist` automatically when the package is installed from source.

## Adding Host Capabilities

When an extension needs a new host type, schema, or helper, add it here first and document the host boundary in the main application's `architecture/extensions.md`. Keep host internals behind this boundary so standalone extension repositories can typecheck and test without depending on the full GCS-SSC application source tree.

### Agreement number providers (SDK 0.2.2)

Declare `agreementNumberProvider: { path: './server/provider.ts' }` and the
`agreement-number-provider` capability. Its default export implements
`GcsAgreementNumberProvider` from the server entry point and returns a string.
The host supplies its active transaction, resolved Agency/Program/Stream IDs,
Agency and Stream configuration, and the allowlisted `GcsAgreementNumberSources`.
`GCS_AGREEMENT_NUMBER_FIELDS` publishes the supported field keys. Language-specific
fields are explicit; UI locale does not select an identifier's language.

The provider may write its own counter tables through the supplied transaction.
It must not insert an Agreement, commit, start another transaction, or mutate host
rows. The host can call it again within the transaction when a candidate already
exists; allocations for rejected candidates commit with a successful creation and
all allocations roll back when creation fails. Providers must tolerate that call
contract. Stream locks serialize supported number writers; the host's unique
constraint remains authoritative. Competing enabled providers cause an error.

`GET /api/agreements/number-mode?streamId=<id>` returns `GcsAgreementNumberMode`
(`manual` or `generated`) under Agreement-create authorization. A supported host
API client can read that endpoint for presentation. The create transaction resolves
mode again: manual creation requires a number, generated creation must omit it.
The response always includes the saved required number. This API does not reserve
or preview a number. Existing profiles are not regenerated on updates.

## Owned translations (breaking in 0.3.0)

Store extension-authored messages in your package's `i18n/` modules. Define flat
English/French catalogs with `defineGcsExtensionMessages` from the root SDK entry
point, then call `useExtensionI18n(messages)` in UI setup. It returns `t` restricted
to that catalog, reactive read-only `locale`, and `n`. The host runtime exposes
only locale/number formatting and cannot resolve host message keys for extensions.
There is no catalog-free overload, host fallback, or cross-extension registry.

```ts
import { defineGcsExtensionMessages, translateGcsExtensionMessage } from '@gcs-ssc/extensions'
export const messages = defineGcsExtensionMessages({
  en: { saved: 'Saved {count} records' },
  fr: { saved: '{count} dossiers enregistrés' }
})
// Pure server/shared use; UI uses useExtensionI18n(messages).t(...).
translateGcsExtensionMessage(messages, 'fr', 'saved', { count: 0 })
```

The definition validates identical locale keys and named-placeholder sets and
freezes detached catalog copies. Missing keys/parameters throw. Named `{count}`
interpolation is literal and single-pass; `@`, pipes and inserted braces are plain
text. ICU plurals, HTML and linked-message syntax are not interpreted. Use explicit
plural keys. French locale tags select French; other locales select English.

Own common words, enum labels, validation text and notifications as well as feature
text. Host-provided controls retain their own internal labels. Persisted bilingual
names and already-localized API messages remain data. The existing bilingual SDK
user-error payload remains available for extension-owned server errors.

Upgrade all dependent manifests and package ranges to `^0.3.0`. Test your catalogs,
locale switching and UI without supplying a host translator; include `i18n/**/*.ts`
in your own coverage configuration. `installExtensionTestUiRuntime` projects only
locale/number formatting from any global test composer.

## Agency-only configuration (0.3.1)

Set `configurationScope: 'agency'` and declare `agency-only-configuration` to own
configuration and enablement only at the agency. Do not declare stream editors.
The host hides stream configuration and rejects direct stream writes. Number
providers in this mode run for every agreement in an enabled agency and receive
`agencyConfig` plus authoritative agency/program/stream IDs; `config` is empty.
Omitting the declaration preserves the existing stream enablement contract.
Configuration authorization remains controlled by `configurationAccess`.

### Audit ownership (SDK 0.3.2)

Declare ownership of extension-authored tables with the `audit-ownership`
capability. Declarations are server-only, data-only rules; the host follows them
on the executing database connection and persists the resolved audit audience.
An undeclared extension table has global-only audit visibility.

```ts
import { defineGcsAuditOwnership, defineGcsExtension } from '@gcs-ssc/extensions'

export default defineGcsExtension({
  // ...existing manifest metadata and contributions
  requiredHostCapabilities: ['audit-ownership'],
  auditOwnership: defineGcsAuditOwnership([
    {
      table: 'extensions.example_record',
      owner: { kind: 'owner', owner: 'agreement', column: 'agreement_id' }
    },
    {
      table: 'extensions.example_detail',
      owner: { kind: 'parent', table: 'extensions.example_record', column: 'record_id' }
    }
  ])
})
```

Host owner anchors are `agency`, `program`, `stream`, `agreement` and `proponent`.
A Proponent owner uses the executing actor's active agency-scoped roles, not the
lead agency. `actor-agencies` declares that audience directly. Actorless execution
requires an explicit attribution policy and is not silently classified globally.

Use `switch` with a discriminator `column` and `cases` for tables whose rows have
different owner types. Use `{ kind: 'global', reason: '...' }` for deliberately
global data. Parent references must name a table declared by the same extension;
`targetColumn` defaults to `id`. Reserved host tables, duplicate claims and cycles
are rejected. Include tests for every table and every supported owner variant in
the extension's own test suite. These declarations do not grant authorization to
read or mutate the owning business records.
