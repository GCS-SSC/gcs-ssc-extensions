# @gcs-ssc/extensions

Public SDK contracts for GCS-SSC extensions.

Extensions should import host-facing types and helpers from this package instead of importing from `~~/shared`, `~~/server`, or other host-internal paths.

## Installation

Use the GitHub dependency from standalone extension packages:

```json
{
  "dependencies": {
    "@gcs-ssc/extensions": "github:GCS-SSC/gcs-ssc-extensions#main"
  }
}
```

The host application may also consume this package through a local workspace while SDK contracts are being developed. Extension repositories should use the GitHub dependency so editor IntelliSense, typechecking, and tests do not require the full host application checkout.

## Entry Points

- `@gcs-ssc/extensions` exposes manifest, JSON, and client-safe extension types.
- `@gcs-ssc/extensions/server` exposes server-safe schemas and route helpers.
- `@gcs-ssc/extensions/testing` exposes test-only helpers for extension repositories.
- `@gcs-ssc/extensions/nuxt` exposes minimal ambient Nuxt host globals for standalone extension typechecking.
- The Nuxt entry point also declares host-provided UI components used by extension screens, including `UBadge`, `UTable`, `UIcon`, and `CommonSaveButton`.

## Import Rules

Extension packages should not import from host application aliases such as `~~/shared`, `~~/server`, `~/`, or `#imports` for SDK-owned contracts. If a type or helper is needed by an extension, add it here first and then consume it through one of the public entry points.

```ts
import { defineGcsExtension } from '@gcs-ssc/extensions'
import type { GcsExtensionJsonConfig } from '@gcs-ssc/extensions'
import {
  AssessmentDefinitionSchema,
  createGcsExtensionUserError,
  getExtensionKvEntry,
  defineGcsExtensionMigration,
  registerGcsExtensionCreateOperationHandler,
  setExtensionKvEntry,
  resolveExtensionStreamContext
} from '@gcs-ssc/extensions/server'
```

## Entity Tabs And RBAC

## Stream Configuration Components

Extensions can render a stream-level configuration component with `admin.streamConfig`.
The host passes the editable JSON config with `v-model` plus stable stream context props:

```vue
<script setup lang="ts">
import type { GcsExtensionJsonConfig, GcsResolvedExtension } from '@gcs-ssc/extensions'

const {
  extension,
  streamId,
  transferPaymentId,
  agencyId
} = defineProps<{
  extension: GcsResolvedExtension
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

Tab paths are validated by the host scanner and must stay inside the extension package. Tab ids are lowercase kebab-case and must be unique per extension target.

The host shows tabs only when the extension is enabled for the owning agency, stream-scoped entities are enabled for the transfer payment stream, and the current user passes the declared RBAC check. Proponent tabs use the proponent lead agency; proponents without a lead agency do not show extension tabs.

Extensions can add inline fields to host-owned agreement profile sections through `client.slots`. For agreement risk data, use `agreement.profile.risk-management.fields`; the host owns the standard holdback, holdback basis, and risk score fields, and extension fields render inside the same Risk Management section.

```ts
export default defineGcsExtension({
  key: 'gcs-example',
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
import type { ExtensionEntityTabContext } from '@gcs-ssc/extensions/server'
import type { GcsExtensionJsonConfig, GcsExtensionRbacRequirement } from '@gcs-ssc/extensions'

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

The host resolves the entity from the declared route param, verifies extension enablement, enforces RBAC, and then calls the extension handler. Handlers that do not declare `rbac` keep the existing authenticated dispatch behavior.

Use only the RBAC subjects and actions already exposed by GCS-SSC. The extension SDK does not support custom RBAC subjects.

## Commitment And Payment Create Actions

Extensions can add or replace the create actions on agreement commitments and payments:

```ts
export default defineGcsExtension({
  key: 'gcs-example',
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
  getExtensionKvEntry,
  registerGcsExtensionCreateOperationHandler
} from '@gcs-ssc/extensions/server'

export default defineNitroPlugin(nitroApp => {
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

Extension user errors own their messages. Pass bilingual message objects so the host can select `en` or `fr` from the request locale and return the resolved text in the standard API error payload. A plain string is treated as already-resolved extension text and is not translated by the host, so bilingual strings are preferred for user-facing errors.

## Extension Database Migrations

Extensions may declare explicit Kysely migration files in `extension.config.ts`:

```ts
export default defineGcsExtension({
  key: 'gcs-example',
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

For standalone Vue/Nuxt extension typechecking, include the ambient host declarations in the extension `tsconfig.json`:

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
```

## Adding Host Capabilities

When an extension needs a new host type, schema, or helper, add it here first and document the contract in `specs/extensions-sdk.md`. Keep host internals behind this boundary so standalone extension repositories can typecheck and test without depending on the full GCS-SSC application source tree.
