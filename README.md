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
