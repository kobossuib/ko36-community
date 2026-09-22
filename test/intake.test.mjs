import test from 'node:test';
import assert from 'node:assert/strict';
import { initialLabels } from '../src/intake.mjs';

test('new issues cannot self-approve by text or supplied status', () => {
  assert.deepEqual(initialLabels(['type:bug', 'status:ready', 'source:web'], 'opened'),
    ['type:bug', 'source:web', 'status:incoming']);
});
test('reopened issues return to intake and keep area/type', () => {
  assert.deepEqual(initialLabels(['area:usb', 'type:bug', 'status:published'], 'reopened'),
    ['area:usb', 'type:bug', 'status:incoming', 'source:github']);
});
