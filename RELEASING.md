# Fork releases

This experimental fork retains the upstream three-part base and adds a numeric fork revision, e.g. `1.22.6.2`. `package.json` is the version source; the release script synchronizes `manifest.json` and `update.json`. Do not downgrade existing installations or replace a published XPI under the same version.

1. Run `git lfs pull` to fetch the bundled model weights. Unresolved pointer text makes the build fail. Run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`.
2. Run `node scripts/release.js <version>` to update versions and package the XPI. This does not commit, tag or push.
3. Run `npm run check:versions`, review `CHANGELOG.md` and install/verify changes in Zotero. Preserve existing indexes; never rebuild them just to test distribution.
4. Commit the source and `update.json`, push `main`, then push `v<version>`.
5. The tagged workflow runs the existing CI first, builds the XPI, checks its hash against the committed update manifest, adds its SHA-256 to the release update manifest, and publishes an **experimental prerelease**, XPI, `update.json` and `SHA256SUMS`.
6. Verify public downloaded assets and hashes. `main/update.json` remains the automatic-update endpoint, because GitHub's latest-stable endpoint excludes prereleases. Promote only after native runtime checks justify it.

Keep upstream credits and MIT license metadata. EmbeddingGemma 2 model licensing and download terms are independent of this plugin; model weights are not included in the XPI. See [verification limits](docs/EMBEDDINGGEMMA2-VERIFICATION.md).
