import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { assertNoLfsPointers } = require('../scripts/check-lfs.js');

test('release rejects the unresolved model pointer found in the withdrawn 1.22.6.3 XPI', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zotseek-lfs-'));
  try {
    const pointer = fs.readFileSync(path.resolve('test/fixtures/lfs-model-pointer.txt'));
    fs.writeFileSync(path.join(directory, 'model.onnx'), pointer);
    assert.throws(() => assertNoLfsPointers(directory), /Git LFS pointer in release input/);
    fs.writeFileSync(path.join(directory, 'model.onnx'), Buffer.from([8, 9, 18, 0]));
    assert.doesNotThrow(() => assertNoLfsPointers(directory));
    assert.throws(() => assertNoLfsPointers(path.join(directory, 'missing')), /ENOENT/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
