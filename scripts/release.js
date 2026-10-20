const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const archiver = require('archiver');
const { spawnSync } = require('child_process');
const { createHash } = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const buildDir = path.resolve(rootDir, 'build');
const manifestPath = path.resolve(rootDir, 'manifest.json');
const updateJsonPath = path.resolve(rootDir, 'update.json');

// GitHub repo info for update URLs
const GITHUB_OWNER = 'Zotero-Flow';
const GITHUB_REPO = 'ZotSeek';

/**
 * Generate update.json from manifest.json version
 */
function generateUpdateJson(version, xpiPath) {
  // Read the compatibility gate from manifest.json rather than hardcoding it.
  // The update manifest has its own gate, and it is what decides whether an
  // update is offered at all: if it lags behind the manifest, users on a new
  // Zotero major stay disabled and never receive the build that fixes them.
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { strict_min_version, strict_max_version } = manifest.applications.zotero;

  const updateJson = {
    addons: {
      'zotseek@zotero.org': {
        updates: [
          {
            version: version,
            update_hash: "sha256:" + createHash("sha256").update(fs.readFileSync(xpiPath)).digest("hex"),
            update_link: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/zotseek-${version}.xpi`,
            applications: {
              zotero: {
                strict_min_version,
                strict_max_version
              }
            }
          }
        ]
      }
    }
  };

  fs.writeFileSync(updateJsonPath, JSON.stringify(updateJson, null, 2) + '\n');
  console.log(`Generated update.json for v${version}`);
}

/**
 * Sync version to manifest.json (bumpp updates package.json, we sync to manifest)
 */
function syncManifestVersion(version) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Updated manifest.json to v${version}`);
}

/**
 * Create XPI package
 */
async function createXpi(version) {
  const xpiName = `zotseek-${version}.xpi`;
  const xpiPath = path.resolve(rootDir, xpiName);

  console.log(`\nPackaging ${xpiName}...`);

  await new Promise((resolve, reject) => {
    const output = createWriteStream(xpiPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Created ${xpiName} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);
    // Stable entry order and timestamps keep update hashes identical across builds.
    function addFiles(directory, prefix = '') {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        const name = prefix + entry.name;
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) addFiles(fullPath, name + '/');
        else if (entry.isFile()) archive.append(fs.createReadStream(fullPath), { name, date: new Date('2026-01-01T00:00:00Z'), mode: 0o644 });
        else throw new Error('Unexpected non-file in release build: ' + name);
      }
    }
    addFiles(buildDir);
    archive.finalize();
  });

  return xpiPath;
}

async function release() {
  console.log('ZotSeek Release\n');

  // Firefox/Zotero accept a fourth numeric component; bumpp's SemVer parser does not.
  const version = process.argv[2];
  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version || '')) {
    throw new Error('Pass an explicit three- or four-part numeric version.');
  }
  for (const name of ['package.json', 'package-lock.json']) {
    const file = path.join(rootDir, name);
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    value.version = version;
    if (name === 'package-lock.json') value.packages[''].version = version;
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
  }

  // Step 2: Sync manifest.json and generate update.json
  console.log('\nStep 2: Sync version files\n');
  syncManifestVersion(version);

  // Step 3: Build
  console.log('\nStep 3: Build\n');
  const buildResult = spawnSync('npm', ['run', 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  });

  if (buildResult.status !== 0) {
    console.error('Build failed');
    process.exit(1);
  }

  // Step 4: Package XPI
  console.log('\nStep 4: Package XPI');
  const xpiPath = await createXpi(version);
  generateUpdateJson(version, xpiPath);
  fs.writeFileSync(path.join(rootDir, 'SHA256SUMS'), [xpiPath, updateJsonPath].map(file =>
    createHash('sha256').update(fs.readFileSync(file)).digest('hex') + '  ' + path.basename(file)
  ).join('\n') + '\n');

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Release v${version} ready!`);
  console.log('='.repeat(50));
  console.log('\nFiles updated:');
  console.log(`  - package.json (v${version})`);
  console.log(`  - manifest.json (v${version})`);
  console.log(`  - update.json (v${version})`);
  console.log(`  - ${path.basename(xpiPath)}`);
  console.log('\nNext steps:');
  console.log('  1. Review the changes: git diff');
  console.log('  2. Commit: git add -A && git commit -m "Release v' + version + '"');
  console.log('  3. Tag: git tag v' + version);
  console.log('  4. Push: git push && git push --tags');
  console.log('  5. Create GitHub release and upload the XPI');
}

release().catch(err => {
  console.error('Release failed:', err);
  process.exit(1);
});
