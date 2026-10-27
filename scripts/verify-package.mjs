import { execFileSync } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const consumerRoot = await mkdtemp(join(tmpdir(), 'gcs-sdk-package-'))
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' })

try {
  const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', consumerRoot], packageRoot))
  const archiveName = packed[0]?.filename
  if (typeof archiveName !== 'string') throw new Error('npm pack did not return an archive filename')
  const sourceManifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  await writeFile(join(consumerRoot, 'package.json'), JSON.stringify({
    private: true, type: 'module', dependencies: sourceManifest.peerDependencies
  }))
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(consumerRoot, archiveName)], consumerRoot)
  const installedRoot = join(consumerRoot, 'node_modules', '@gcs-ssc', 'extensions')
  const manifest = JSON.parse(await readFile(join(installedRoot, 'package.json'), 'utf8'))
  const specifiers = []
  for (const [key, entry] of Object.entries(manifest.exports)) {
    if (typeof entry.types !== 'string') throw new Error(`Missing types entry for ${key}`)
    await access(join(installedRoot, entry.types))
    specifiers.push(key === '.' ? manifest.name : `${manifest.name}${key.slice(1)}`)
  }
  const smokePath = join(consumerRoot, 'smoke.mjs')
  await writeFile(smokePath, `for (const specifier of ${JSON.stringify(specifiers)}) await import(specifier)\n`)
  run(process.execPath, [smokePath], consumerRoot)
  console.info(`Packed SDK ${manifest.version}: Node ESM imported all ${specifiers.length} public exports`)
} catch (error) {
  if (error && typeof error === 'object' && 'stderr' in error && error.stderr) process.stderr.write(String(error.stderr))
  throw error
} finally {
  await rm(consumerRoot, { recursive: true, force: true })
}
