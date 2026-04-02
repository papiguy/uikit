import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageDirs = ['packages', 'examples']

function walkForPackageJsons(rootDir) {
  const manifests = []

  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue
      }

      const nextPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        visit(nextPath)
        continue
      }

      if (entry.isFile() && entry.name === 'package.json') {
        manifests.push(nextPath)
      }
    }
  }

  visit(rootDir)
  return manifests
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function isWorkspaceManifest(filePath) {
  return packageDirs.some((dir) => filePath.includes(`${path.sep}${dir}${path.sep}`))
}

function isPublishablePackage(manifestPath, manifest) {
  if (!manifest.name || !manifest.version) {
    return false
  }

  if (!manifestPath.includes(`${path.sep}packages${path.sep}`)) {
    return false
  }

  return Array.isArray(manifest.files) && manifest.files.includes('dist')
}

function convertWorkspaceSpecToPublished(spec, version) {
  const suffix = spec.slice('workspace:'.length)

  if (suffix === '' || suffix === '*') {
    return version
  }

  if (suffix === '^' || suffix === '~') {
    return `${suffix}${version}`
  }

  if (suffix.startsWith('^') || suffix.startsWith('~')) {
    return suffix
  }

  return suffix
}

function getInternalDependencyEntries(manifest, workspaceVersions) {
  const entries = []

  for (const field of dependencyFields) {
    const dependencies = manifest[field]
    if (dependencies == null) {
      continue
    }

    for (const [name, spec] of Object.entries(dependencies)) {
      if (!(name in workspaceVersions)) {
        continue
      }

      entries.push({ field, name, spec })
    }
  }

  return entries
}

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function fail(message) {
  throw new Error(message)
}

const manifestFiles = packageDirs.flatMap((dir) => walkForPackageJsons(path.join(repoRoot, dir)))
const workspaceManifests = manifestFiles
  .filter(isWorkspaceManifest)
  .map((filePath) => ({
    filePath,
    manifest: readJson(filePath),
  }))

const workspaceVersions = Object.fromEntries(
  workspaceManifests
    .filter(({ manifest }) => manifest.name && manifest.version)
    .map(({ manifest }) => [manifest.name, manifest.version]),
)

for (const { filePath, manifest } of workspaceManifests) {
  const relativePath = path.relative(repoRoot, filePath)
  const internalDependencies = getInternalDependencyEntries(manifest, workspaceVersions)

  for (const { field, name, spec } of internalDependencies) {
    if (!spec.startsWith('workspace:')) {
      fail(`${relativePath}: expected ${field}.${name} to use a workspace: specifier, found "${spec}"`)
    }
  }

}

const publishablePackages = workspaceManifests.filter(({ filePath, manifest }) =>
  isPublishablePackage(filePath, manifest),
)

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uikit-pack-'))

try {
  for (const { filePath, manifest } of publishablePackages) {
    const packageDir = path.dirname(filePath)
    const relativeDir = path.relative(repoRoot, packageDir)
    const packOutput = run('pnpm', ['pack', '--pack-destination', packDir], packageDir)
    const tarballPath = packOutput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.tgz'))
      .at(-1)

    if (tarballPath == null) {
      fail(`${relativeDir}: unable to find tarball path in pnpm pack output`)
    }

    const packedManifest = JSON.parse(run('tar', ['-xOf', tarballPath, 'package/package.json'], repoRoot))

    if (typeof manifest.publishConfig?.main === 'string' && packedManifest.main !== manifest.publishConfig.main) {
      fail(
        `${relativeDir}: expected packed main "${manifest.publishConfig.main}", found "${packedManifest.main ?? '<missing>'}"`,
      )
    }

    const internalDependencies = getInternalDependencyEntries(manifest, workspaceVersions)
    for (const { field, name, spec } of internalDependencies) {
      const packedDependencies = packedManifest[field]
      const packedSpec = packedDependencies?.[name]
      const expectedSpec = convertWorkspaceSpecToPublished(spec, workspaceVersions[name])

      if (packedSpec == null) {
        fail(`${relativeDir}: packed package is missing ${field}.${name}`)
      }

      if (packedSpec.startsWith('workspace:')) {
        fail(`${relativeDir}: packed ${field}.${name} still uses a workspace: specifier`)
      }

      if (packedSpec !== expectedSpec) {
        fail(`${relativeDir}: expected packed ${field}.${name} to be "${expectedSpec}", found "${packedSpec}"`)
      }
    }
  }
} finally {
  fs.rmSync(packDir, { recursive: true, force: true })
}

console.log(`Validated ${workspaceManifests.length} workspace manifests and ${publishablePackages.length} publishable package tarballs.`)
