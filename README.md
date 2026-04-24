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

## Import Rules

Extension packages should not import from host application aliases such as `~~/shared`, `~~/server`, `~/`, or `#imports` for SDK-owned contracts. If a type or helper is needed by an extension, add it here first and then consume it through one of the public entry points.

```ts
import { defineGcsExtension } from '@gcs-ssc/extensions'
import type { GcsExtensionJsonConfig } from '@gcs-ssc/extensions'
import { AssessmentDefinitionSchema, resolveExtensionStreamContext } from '@gcs-ssc/extensions/server'
```

## Validation

Run the SDK typecheck before publishing changes:

```sh
bun install
bun run typecheck
```

## Adding Host Capabilities

When an extension needs a new host type, schema, or helper, add it here first and document the contract in `specs/extensions-sdk.md`. Keep host internals behind this boundary so standalone extension repositories can typecheck and test without depending on the full GCS-SSC application source tree.
