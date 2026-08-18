import assert from 'node:assert/strict';
import { generateCode } from '../src/code.js';

const ALPHABET = '23456789ACDEFGHJKLMNPQRSTUVWXYZ';

// Length and charset.
for (const len of [4, 5]) {
  for (let i = 0; i < 2000; i++) {
    const code = generateCode(len);
    assert.equal(code.length, len);
    for (const ch of code) assert.ok(ALPHABET.includes(ch), `unexpected char: ${ch}`);
  }
}

// No modulo bias: masked rejection must sample all 31 chars near-uniformly.
const counts = new Map();
const N = 310_000;
for (let i = 0; i < N; i++) {
  const ch = generateCode(1);
  counts.set(ch, (counts.get(ch) || 0) + 1);
}
assert.equal(counts.size, ALPHABET.length, 'every alphabet char must appear');
const expected = N / ALPHABET.length;
for (const ch of ALPHABET) {
  const deviation = Math.abs((counts.get(ch) || 0) - expected) / expected;
  assert.ok(deviation < 0.1, `char ${ch} deviates ${(deviation * 100).toFixed(1)}% from uniform`);
}

console.log(`codegen OK: length + charset valid, uniform over ${N.toLocaleString()} samples`);
