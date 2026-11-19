import test from 'node:test';
import assert from 'node:assert/strict';
import { generateEuclideanPattern, rotatePattern, clampInt } from '../src/music/euclidean.js';

const toBitString = (arr) => arr.map((v) => (v ? '1' : '0')).join('');

test('clampInt bounds values safely', () => {
  assert.equal(clampInt(5, 1, 10), 5);
  assert.equal(clampInt(-3, 1, 10), 1);
  assert.equal(clampInt(99, 1, 10), 10);
  assert.equal(clampInt('not-a-number', 2, 10), 2);
});

test('generateEuclideanPattern produces classic musical rhythms', () => {
  assert.equal(toBitString(generateEuclideanPattern(3, 8)), '10010010'); // Cuban tresillo
  assert.equal(toBitString(generateEuclideanPattern(5, 8)), '10110110'); // Cuban cinquillo
  assert.equal(toBitString(generateEuclideanPattern(4, 12)), '100100100100'); // Four-on-the-floor 12/8
  assert.equal(toBitString(generateEuclideanPattern(7, 12)), '101101011010'); // West African bell
  assert.equal(toBitString(generateEuclideanPattern(2, 5)), '10100');
});

test('generateEuclideanPattern handles edge counts 0 and full pulses', () => {
  assert.equal(toBitString(generateEuclideanPattern(0, 6)), '000000');
  assert.equal(toBitString(generateEuclideanPattern(6, 6)), '111111');
  assert.equal(toBitString(generateEuclideanPattern(10, 4)), '1111');
});

test('rotatePattern shifts steps clockwise with wrap-around', () => {
  const base = generateEuclideanPattern(3, 8);
  assert.equal(toBitString(rotatePattern(base, 1)), '01001001');
  assert.equal(toBitString(rotatePattern(base, -1)), '00100101');
  assert.equal(toBitString(rotatePattern(base, 8)), toBitString(base));
});
