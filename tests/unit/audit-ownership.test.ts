import { describe, expect, it } from 'vitest'
import { defineGcsAuditOwnership, type GcsAuditOwnershipRule, type GcsAuditTableOwnership } from '../../src/audit-ownership'

describe('extension audit ownership declarations', () => {
  it('allows omitted ownership and every supported host anchor without requiring an inventory', () => {
    expect(defineGcsAuditOwnership([])).toEqual([])
    for (const owner of ['agency', 'program', 'stream', 'agreement', 'proponent'] as const) {
      const declarations = [{ table: 'extensions.record', owner: { kind: 'owner' as const, owner, column: 'owner_id' } }]
      expect(defineGcsAuditOwnership(declarations)).toEqual(declarations)
    }
  })

  it('copies declarations so later caller mutations cannot change the validated snapshot', () => {
    const declarations: GcsAuditTableOwnership[] = [
      { table: 'extensions.identity', owner: { kind: 'global', reason: 'Shared extension catalog' } },
      { table: 'extensions.child', owner: { kind: 'parent', table: 'extensions.identity', column: 'owner_key', targetColumn: 'external_key' } }
    ]
    const snapshot = defineGcsAuditOwnership(declarations)
    declarations[0]!.table = 'extensions.changed'
    declarations[1]!.owner = { kind: 'actor-agencies' }
    expect(snapshot[0]!.table).toBe('extensions.identity')
    expect(snapshot[1]!.owner).toMatchObject({ kind: 'parent', targetColumn: 'external_key' })
  })

  it.each([
    { kind: 'switch', column: 'scope', cases: {} },
    { kind: 'switch', column: 'scope; invalid', cases: { agency: { kind: 'actor-agencies' } } },
    { kind: 'global', reason: 3 },
    { kind: 'owner', owner: 'user', column: 'id' },
    { kind: 'parent', table: 'public.role', column: 'role_id' },
    { kind: 'parent', table: 'extensions.parent', column: 'id; invalid' },
    { kind: 'parent', table: 'extensions.parent', column: 'id', targetColumn: '' },
    { kind: 'unsupported' }
  ])('rejects malformed runtime ownership declarations: %j', rule => {
    expect(() => defineGcsAuditOwnership([{ table: 'extensions.record', owner: rule as GcsAuditOwnershipRule }])).toThrow()
  })

  it('bounds nested and cyclic variant declarations before copying them', () => {
    let rule: GcsAuditOwnershipRule = { kind: 'actor-agencies' }
    for (let depth = 0; depth < 16; depth++) rule = { kind: 'switch', column: 'scope', cases: { next: rule } }
    expect(defineGcsAuditOwnership([{ table: 'extensions.record', owner: rule }])).toHaveLength(1)
    expect(() => defineGcsAuditOwnership([{ table: 'extensions.record', owner: { kind: 'switch', column: 'scope', cases: { next: rule } } }]))
      .toThrow('too deep')
    const cyclic: Extract<GcsAuditOwnershipRule, { kind: 'switch' }> = { kind: 'switch', column: 'scope', cases: {} }
    cyclic.cases.next = cyclic
    expect(() => defineGcsAuditOwnership([{ table: 'extensions.record', owner: cyclic }])).toThrow('too deep')
  })
  it('supports extension parent chains and scope-dependent host owners as data', () => {
    const declarations = defineGcsAuditOwnership([
      { table: 'extensions.child', owner: { kind: 'parent', table: 'extensions.parent', column: 'parent_id' } },
      { table: 'extensions.parent', owner: { kind: 'switch', column: 'scope', cases: {
        agency: { kind: 'owner', owner: 'agency', column: 'scope_id' },
        stream: { kind: 'owner', owner: 'stream', column: 'scope_id' }
      } } }
    ])
    expect(declarations[1]!.owner.kind).toBe('switch')
    expect(JSON.parse(JSON.stringify(declarations))).toEqual(declarations)
  })
  it('rejects host tables, duplicate declarations and malformed references', () => {
    expect(() => defineGcsAuditOwnership([{ table: 'public.user', owner: { kind: 'actor-agencies' } }])).toThrow('extension-schema')
    expect(() => defineGcsAuditOwnership([
      { table: 'extensions.test', owner: { kind: 'actor-agencies' } },
      { table: 'extensions.test', owner: { kind: 'actor-agencies' } }
    ])).toThrow('unique')
    expect(() => defineGcsAuditOwnership([{ table: 'extensions.test', owner: { kind: 'owner', owner: 'agency', column: 'id; drop table x' } }])).toThrow('reference')
    expect(() => defineGcsAuditOwnership([{ table: 'extensions.test', owner: { kind: 'global', reason: '' } }])).toThrow('reason')
  })
})
