import { spawnSync } from 'node:child_process'
import { expect, it } from 'vitest'

it('loads built audit ownership and generic queue exports with native Node ESM', () => {
  const build = spawnSync('bun', ['run', 'build'], { cwd: process.cwd(), encoding: 'utf8' })
  expect(build.status, build.stderr).toBe(0)
  const result = spawnSync('node', ['--input-type=module', '-e', `
    import { defineGcsAuditOwnership } from './dist/index.js';
    import * as server from './dist/server.js';
    const declarations = defineGcsAuditOwnership([{ table: 'extensions.example', owner: { kind: 'owner', owner: 'agency', column: 'agency_id' } }]);
    if (declarations[0].owner.column !== 'agency_id') throw new Error('Missing audit declaration');
    const app = { hooks: { hook: () => { throw new Error('Queue registration must not install a collection hook'); } } };
    const run = async () => {};
    let registrations = 0;
    server.installGcsQueueRegistrar(app, { register: handler => {
      registrations++;
      if (handler.id !== 'example:work' || handler.queueLevel !== 3 || handler.run !== run) throw new Error('Invalid queue metadata');
    } });
    server.registerGcsExtensionQueueHandler({ extensionKey: 'example', id: 'work', queueLevel: 3, run }, app);
    if (registrations !== 1) throw new Error('Queue registration did not reach the host immediately');
    if ('registerGcsExtensionL1QueueHandler' in server) throw new Error('Legacy queue helper remains exported');
  `], { cwd: process.cwd(), encoding: 'utf8' })
  expect(result.status, result.stderr).toBe(0)
}, 15000)
