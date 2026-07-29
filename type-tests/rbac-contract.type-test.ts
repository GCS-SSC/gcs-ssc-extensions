import type { GcsExtensionRbacRequirement } from '../src/index'
import type { GcsExtensionEvent } from '../src/nuxt'
import type { GcsExtensionAuthContext } from '../src/server'

const systemRequirement: GcsExtensionRbacRequirement = {
  subject: 'system',
  action: 'read'
}

// @ts-expect-error -- wildcard RBAC subjects are intentionally unsupported.
const wildcardRequirement: GcsExtensionRbacRequirement = { subject: 'all', action: 'read' }

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
