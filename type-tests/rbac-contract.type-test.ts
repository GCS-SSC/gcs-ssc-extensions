import type {
  GcsExtensionEntityTabDefinition,
  GcsExtensionRbacRequirement,
  GcsExtensionServerEntityRbacRequirement
} from '../src/index'
import type { GcsExtensionEvent } from '../src/nuxt'
import type { GcsExtensionAuthContext } from '../src/server'

const systemRequirement: GcsExtensionRbacRequirement = {
  subject: 'system',
  action: 'read'
}

// @ts-expect-error -- wildcard RBAC subjects are intentionally unsupported.
const wildcardRequirement: GcsExtensionRbacRequirement = { subject: 'all', action: 'read' }

const validEntityTabDefinitions: GcsExtensionEntityTabDefinition[] = [
  {
    path: './proponent-tab.vue',
    target: 'proponent',
    id: 'proponent-tab',
    label: { en: 'Proponent', fr: 'Demandeur' },
    rbac: { subject: 'applicant_recipient', action: 'read' }
  },
  {
    path: './agreement-tab.vue',
    target: 'agreement',
    id: 'agreement-tab',
    label: { en: 'Agreement', fr: 'Entente' },
    rbac: { subject: 'agreement', action: 'read' }
  },
  {
    path: './claim-tab.vue',
    target: 'claim',
    id: 'claim-tab',
    label: { en: 'Claim', fr: 'Réclamation' },
    rbac: { subject: 'agreement', action: 'read' }
  },
  {
    path: './monitor-tab.vue',
    target: 'monitor',
    id: 'monitor-tab',
    label: { en: 'Monitor', fr: 'Suivi' },
    rbac: { subject: 'agreement', action: 'read' }
  }
]

// @ts-expect-error -- proponent tabs require the applicant_recipient subject.
const mismatchedProponentEntityTab: GcsExtensionEntityTabDefinition = {
  path: './proponent-tab.vue',
  target: 'proponent',
  id: 'mismatched-proponent-tab',
  label: { en: 'Proponent', fr: 'Demandeur' },
  rbac: { subject: 'agreement', action: 'read' }
}

// @ts-expect-error -- agreement-family tabs require the agreement subject.
const mismatchedAgreementEntityTab: GcsExtensionEntityTabDefinition = {
  path: './claim-tab.vue',
  target: 'claim',
  id: 'mismatched-claim-tab',
  label: { en: 'Claim', fr: 'Réclamation' },
  rbac: { subject: 'applicant_recipient', action: 'read' }
}

const validServerEntityRequirements: GcsExtensionServerEntityRbacRequirement[] = [
  {
    subject: 'applicant_recipient',
    action: 'read',
    entity: { target: 'proponent', param: 'proponentId' }
  },
  {
    subject: 'agreement',
    action: 'read',
    entity: { target: 'agreement', param: 'agreementId' }
  },
  {
    subject: 'agreement',
    action: 'read',
    entity: { target: 'claim', param: 'claimId' }
  },
  {
    subject: 'agreement',
    action: 'read',
    entity: { target: 'monitor', param: 'monitorId' }
  }
]

// @ts-expect-error -- proponent server targets require the applicant_recipient subject.
const mismatchedProponentServerRequirement: GcsExtensionServerEntityRbacRequirement = {
  subject: 'agreement',
  action: 'read',
  entity: { target: 'proponent', param: 'proponentId' }
}

// @ts-expect-error -- agreement-family server targets require the agreement subject.
const mismatchedAgreementServerRequirement: GcsExtensionServerEntityRbacRequirement = {
  subject: 'applicant_recipient',
  action: 'read',
  entity: { target: 'monitor', param: 'monitorId' }
}

declare const authContext: GcsExtensionAuthContext
authContext.userAbilities.authorize(systemRequirement.subject, systemRequirement.action, { type: 'global' })

declare const nuxtAuthContext: NonNullable<GcsExtensionEvent['context']['$authContext']>
nuxtAuthContext.userAbilities.authorize(systemRequirement.subject, systemRequirement.action, { type: 'global' })

// @ts-expect-error -- Nuxt authorization requires the canonical three arguments.
nuxtAuthContext.userAbilities.authorize(systemRequirement.subject, systemRequirement.action)
nuxtAuthContext.userAbilities.authorize(systemRequirement.subject, systemRequirement.action, {
  // @ts-expect-error -- Nuxt authorization accepts only the canonical ExtensionScope.
  type: 'program',
  agencyId: 'agency-1',
  transferPaymentId: 'program-1'
})

// @ts-expect-error -- exact Team checks are host-owned and never part of static abilities.
authContext.userAbilities.authorizeWithTeam('agreement', 'read', { type: 'global' })
// @ts-expect-error -- root users use ordinary explicit grants and have no bypass predicate.
authContext.userAbilities.isRootAdmin()

void wildcardRequirement
void validEntityTabDefinitions
void mismatchedProponentEntityTab
void mismatchedAgreementEntityTab
void validServerEntityRequirements
void mismatchedProponentServerRequirement
void mismatchedAgreementServerRequirement
