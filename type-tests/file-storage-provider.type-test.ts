import { defineGcsExtension, type GcsFileStorageProviderDefinition } from '../src/index'
import {
  defineGcsFileStorageMetadataValidator,
  defineGcsFileStorageProviderAdapter,
  type GcsFileStorageProviderManagedMetadataAdapter
} from '../src/server'
import type {
  GcsFileStorageMetadataComponentEmits,
  GcsFileStorageMetadataComponentProps
} from '../src/ui'

const provider: GcsFileStorageProviderDefinition = {
  adapter: { path: './server/storage-adapter.ts' },
  metadata: {
    component: { path: './components/StorageMetadata.vue' },
    validator: { path: './server/storage-metadata.ts' },
    persistence: 'provider',
    mutability: 'editable',
    contractVersion: 1
  }
}

defineGcsExtension({
  key: 'gcs-storage-fixture',
  sdkVersion: '^0.2.1',
  requiredHostCapabilities: ['file-storage-provider'],
  name: { en: 'Storage fixture', fr: 'Stockage de test' },
  fileStorageProvider: provider
})

defineGcsFileStorageProviderAdapter({
  async writeObject(input) {
    return { objectId: input.objectName, locator: { key: input.objectName } }
  },
  async readObject() {
    return { bytes: new Uint8Array([1]) }
  },
  async deleteObject() {},
  async readProviderMetadata() {
    return { retention: 'standard' }
  },
  async updateProviderMetadata() {}
} satisfies GcsFileStorageProviderManagedMetadataAdapter)

defineGcsFileStorageMetadataValidator((metadata, context) => ({
  ...metadata,
  contractVersion: context.contractVersion
}))

declare const secretAwareWrite: Parameters<ReturnType<typeof defineGcsFileStorageProviderAdapter>['writeObject']>[0]
void secretAwareWrite.secrets.get('access-key')

declare const props: GcsFileStorageMetadataComponentProps
declare const emit: GcsFileStorageMetadataComponentEmits
emit('update:modelValue', props.modelValue)

// @ts-expect-error -- provider metadata must remain JSON-only.
emit('update:modelValue', { invalid: new Date() })

// @ts-expect-error -- a provider-managed editable adapter requires metadata reads.
const incompleteEditableAdapter: GcsFileStorageProviderManagedMetadataAdapter = {
  async writeObject(input) {
    return { objectId: input.objectName, locator: {} }
  },
  async readObject() {
    return { bytes: new Uint8Array() }
  },
  async deleteObject() {},
  async updateProviderMetadata() {}
}

void incompleteEditableAdapter
