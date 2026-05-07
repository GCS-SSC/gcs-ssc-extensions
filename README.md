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

## Import Rules

Extension packages should not import from host application aliases such as `~~/shared`, `~~/server`, `~/`, or `#imports` for SDK-owned contracts. If a type or helper is needed by an extension, add it here first and then consume it through one of the public entry points.

```ts
import { defineGcsExtension } from '@gcs-ssc/extensions'
import type { GcsExtensionJsonConfig } from '@gcs-ssc/extensions'
import {
  AssessmentDefinitionSchema,
  getExtensionKvEntry,
  defineGcsExtensionMigration,
  setExtensionKvEntry,
  resolveExtensionStreamContext
} from '@gcs-ssc/extensions/server'
```

## Entity Tabs And RBAC

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
