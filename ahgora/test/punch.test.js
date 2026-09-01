import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePunchList, normalizePunchTime } from '../src/punch.js';

test('normalizes HHMM and HHMMSS', () => {
  assert.equal(normalizePunchTime('1245'), '12:45:00');
  assert.equal(normalizePunchTime('124500'), '12:45:00');
});

test('deduplicates mixed Ahgora time formats', () => {
  assert.deepEqual(
    normalizePunchList(['1200', '1215', '1245', '124500']),
    ['12:00:00', '12:15:00', '12:45:00']
  );
});
