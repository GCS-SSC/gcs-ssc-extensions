import type { GcsExtensionSlotContext, GcsPaymentEvidenceExtensionContext } from '../src/index'
import type { GcsPaymentEvidenceComponentProps, GcsExtensionPaymentCalculationBreakdownProps } from '../src/ui'

const context: GcsPaymentEvidenceExtensionContext = {
  kind: 'payment.evidence', agreementId: '1', paymentId: '2', ownerType: 'fundingcasepayment', ownerId: '2'
}
const genericContext: GcsExtensionSlotContext = context
const props: GcsPaymentEvidenceComponentProps = { extensionKey: 'fixture', context, config: {} }
const explanation: GcsExtensionPaymentCalculationBreakdownProps = { explanation: [{ label: 'Payment', rows: [{ label: 'Claim', value: '$1.00' }], total: { label: 'Payment', value: '$1.00' } }] }
// @ts-expect-error Payment evidence always carries the exact Payment identity.
const missingIdentity: GcsExtensionSlotContext = { kind: 'payment.evidence', agreementId: '1', ownerType: 'fundingcasepayment', ownerId: '2' }
// @ts-expect-error A Payment evidence contribution cannot impersonate an Agreement owner.
const wrongOwner: GcsPaymentEvidenceExtensionContext = { ...context, ownerType: 'fundingcaseagreement' }
void [props, genericContext, explanation, missingIdentity, wrongOwner]
