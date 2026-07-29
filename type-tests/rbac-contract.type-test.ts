import type { GcsExtensionRbacRequirement } from '../src/index'
import type { GcsExtensionAuthContext } from '../src/server'

const systemRequirement: GcsExtensionRbacRequirement = {
  subject: 'system',
  action: 'read'
}

// @ts-expect-error -- wildcard RBAC subjects are intentionally unsupported.
const wildcardRequirement: GcsExtensionRbacRequirement = { subject: 'all', action: 'read' }

declare const authContext: GcsExtensionAuthContext
authContext.userAbilities.authorize(systemRequirement.subject, systemRequirement.action, { type: 'global' })

// @ts-expect-error -- exact Team checks are host-owned and never part of static abilities.
authContext.userAbilities.authorizeWithTeam('agreement', 'read', { type: 'global' })
// @ts-expect-error -- root users use ordinary explicit grants and have no bypass predicate.
authContext.userAbilities.isRootAdmin()

void wildcardRequirement
