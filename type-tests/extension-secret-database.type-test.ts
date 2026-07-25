import type { Kysely } from 'kysely'
import {
  deleteEncryptedExtensionSecret,
  getEncryptedExtensionSecret,
  setEncryptedExtensionSecret,
  type ExtensionSecretDatabase
} from '../src/server'

interface HostDatabase extends ExtensionSecretDatabase {
  host_audit: {
    id: string
  }
}

/** Compile-checks full host database and transaction compatibility for every secret helper. */
const verifyExtensionSecretDatabaseClients = async (
  db: Kysely<HostDatabase>,
  rootKey: string
): Promise<void> => {
  await setEncryptedExtensionSecret(db, {
    rootKey,
    extensionKey: 'gcs-test',
    ownerType: 'agency',
    ownerId: 'agency-1',
    secretKey: 'credential-1',
    value: {
      token: 'private'
    }
  })
  await getEncryptedExtensionSecret(db, {
    rootKey,
    extensionKey: 'gcs-test',
    ownerType: 'agency',
    ownerId: 'agency-1',
    secretKey: 'credential-1'
  })
  await deleteEncryptedExtensionSecret(db, 'gcs-test', 'agency', 'agency-1', 'credential-1')

  await db.transaction().execute(async trx => {
    await setEncryptedExtensionSecret(trx, {
      rootKey,
      extensionKey: 'gcs-test',
      ownerType: 'agency',
      ownerId: 'agency-1',
      secretKey: 'credential-1',
      value: {
        token: 'private'
      }
    })
    await getEncryptedExtensionSecret(trx, {
      rootKey,
      extensionKey: 'gcs-test',
      ownerType: 'agency',
      ownerId: 'agency-1',
      secretKey: 'credential-1'
    })
    await deleteEncryptedExtensionSecret(trx, 'gcs-test', 'agency', 'agency-1', 'credential-1')
  })
}

void verifyExtensionSecretDatabaseClients
