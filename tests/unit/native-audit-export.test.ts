import { spawnSync } from 'node:child_process'
import { expect, it } from 'vitest'

it('loads the built audit ownership declaration export with native Node ESM', () => {
  const build = spawnSync('bun', ['run', 'build'], { cwd: process.cwd(), encoding: 'utf8' })
  expect(build.status, build.stderr).toBe(0)
  const result = spawnSync('node', ['--input-type=module', '-e', `
    import { defineGcsAuditOwnership } from './dist/index.js';
    const declarations = defineGcsAuditOwnership([{ table: 'extensions.example', owner: { kind: 'owner', owner: 'agency', column: 'agency_id' } }]);
    if (declarations[0].owner.column !== 'agency_id') throw new Error('Missing audit declaration');
  `], { cwd: process.cwd(), encoding: 'utf8' })
  expect(result.status, result.stderr).toBe(0)
}, 15000)
