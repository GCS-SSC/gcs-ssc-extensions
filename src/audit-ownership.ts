/** Declarative audit ownership for an extension-authored table in the extensions schema. */
export type GcsAuditOwnershipRule =
    | { kind: 'global'; reason: string }
    | { kind: 'actor-agencies' }
    | { kind: 'owner'; owner: 'agency' | 'program' | 'stream' | 'agreement' | 'proponent'; column: string }
    | { kind: 'parent'; table: string; column: string; targetColumn?: string }
    | { kind: 'switch'; column: string; cases: Record<string, GcsAuditOwnershipRule> }

export type GcsAuditTableOwnership = { table: string; owner: GcsAuditOwnershipRule }

/** Validates data-only declarations; omitted tables deliberately retain global audit visibility. */
export const defineGcsAuditOwnership = (tables: readonly GcsAuditTableOwnership[]): GcsAuditTableOwnership[] => {
  const names = new Set<string>()
  const identifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  const tableName = /^extensions\.[a-zA-Z_][a-zA-Z0-9_]*$/
  const validateRule = (rule: GcsAuditOwnershipRule, depth = 0): void => {
    if (depth > 16) throw new Error('Audit ownership declaration is too deep')
    if (rule.kind === 'switch') {
      if (!identifier.test(rule.column) || !Object.keys(rule.cases).length) throw new Error('Invalid audit ownership variants')
      for (const variant of Object.values(rule.cases)) validateRule(variant, depth + 1)
      return
    }
    if (rule.kind === 'global') {
      if (typeof rule.reason !== 'string' || !rule.reason.trim()) throw new Error('Global audit ownership requires a reason')
    } else if (rule.kind === 'owner') {
      if (!['agency', 'program', 'stream', 'agreement', 'proponent'].includes(rule.owner) || !identifier.test(rule.column)) throw new Error('Invalid audit owner reference')
    } else if (rule.kind === 'parent') {
      if (!tableName.test(rule.table) || !identifier.test(rule.column) || rule.targetColumn !== undefined && !identifier.test(rule.targetColumn)) throw new Error('Invalid audit parent reference')
    } else if (rule.kind !== 'actor-agencies') throw new Error('Invalid audit ownership rule')
  }
  for (const declaration of tables) {
    if (!tableName.test(declaration.table) || names.has(declaration.table)) throw new Error('Audit ownership tables must be unique extension-schema tables')
    names.add(declaration.table)
    validateRule(declaration.owner)
  }
  return JSON.parse(JSON.stringify(tables)) as GcsAuditTableOwnership[]
}
