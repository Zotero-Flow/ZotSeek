const fs = require('fs');
const path = require('path');

function assertNoLfsPointers(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      assertNoLfsPointers(file);
    } else if (entry.isFile()) {
      const descriptor = fs.openSync(file, 'r');
      const prefix = Buffer.alloc(128);
      let bytes;
      try { bytes = fs.readSync(descriptor, prefix, 0, prefix.length, 0); }
      finally { fs.closeSync(descriptor); }
      if (prefix.subarray(0, bytes).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) {
        throw new Error('Git LFS pointer in release input: ' + file + '. Run git lfs pull before building.');
      }
    }
  }
}

module.exports = { assertNoLfsPointers };
if (require.main === module) assertNoLfsPointers(process.argv[2] || path.resolve(__dirname, '../content/models'));
