import type { GcsAgreementNumberProvider, GcsAgreementNumberProviderContext } from '../src/server'
import type { GcsAgreementNumberMode } from '../src/index'

const provider: GcsAgreementNumberProvider = async context => context.sources['agreement.startDate']
const mode: GcsAgreementNumberMode = { mode: 'generated' }
// @ts-expect-error A provider returns only a number string, never an inserted agreement.
const invalid: GcsAgreementNumberProvider = async () => ({ id: '1' })
const inspect = (context: GcsAgreementNumberProviderContext) => {
  // @ts-expect-error Arbitrary host columns are not public variable sources.
  return context.sources['Agency_Profile.secret']
}
void [provider, mode, invalid, inspect]
