# Correction outcome staging

SDK 0.3.6 adds `registerGcsExtensionCorrectionOutcomeHandler` in `@gcs-ssc/extensions/server`. A Nitro plugin declaring the existing `extension-lifecycle-hooks` capability may register its configured outcome staging callback:

```ts
registerGcsExtensionCorrectionOutcomeHandler('approved-integration', async context => {
  // Insert an extension-owned durable delivery request through context.db.
  // The integration worker delivers after commit and rechecks enablement.
})
```

The host invokes only enabled Agency/Stream integrations. The extension-qualified callback receives its effective stream configuration, owning Agency/Stream/Agreement IDs, Correction reference and outcome, newly retained notification IDs and recipient Common User IDs, designated workflow runtime ID, decision Common User ID, and recorded timestamp. `decisionCommonUserId` is null for a recorded system execution failure; `runtimeId` is null for cancellation before submission. These are host domain IDs, not authentication IDs.

The payload contains no source accounting, attachments, discrepancy rationale, credentials, or additional API authority. Integrations retain their own Agency configuration through the existing SDK configuration/KV/secret contracts. The host provides no external delivery transport.

Persist the durable request using the supplied transaction. A callback failure rolls back the terminal outcome, its financial posting, retained notification, and lock release. Do not perform external delivery before commit. Workers own approved transport configuration, enablement checks, retries, idempotency keyed by notification ID, delivery attribution, translations, and package-local tests. The host calls staging only for newly inserted retained notifications, so terminal retries do not create duplicate requests.

The registration helper filters the extension key and propagates errors. It can use the Nitro app passed explicitly or the host Nitro app available during plugin registration.
