import test from 'node:test';
import assert from 'node:assert/strict';
import { midiToFreq, scaleDegreeToMidi, formatMidiNote } from '../src/music/scales.js';
import { PRESETS, encodeStateToHash, decodeStateFromHash, normalizeState } from '../src/music/presets.js';

test('midiToFreq converts A4 (69) and C4 (60) accurately', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(60) - 261.625565) < 0.001);
});

test('scaleDegreeToMidi wraps across octaves in pentatonicMinor', () => {
  // C4 = 60, intervals = [0, 3, 5, 7, 10]
  assert.equal(scaleDegreeToMidi(0, 'pentatonicMinor', 4, 0), 60); // C4
  assert.equal(scaleDegreeToMidi(0, 'pentatonicMinor', 4, 1), 63); // D#4
  assert.equal(scaleDegreeToMidi(0, 'pentatonicMinor', 4, 5), 72); // C5
  assert.equal(formatMidiNote(60), 'C4');
  assert.equal(formatMidiNote(69), 'A4');
});

test('URL hash serialization round-trips presets cleanly', () => {
  for (const preset of PRESETS) {
    const normalized = normalizeState(preset);
    const hash = encodeStateToHash(normalized);
    const decoded = decodeStateFromHash(`#state=${hash}`);
    assert.ok(decoded, `Failed to decode preset ${preset.id}`);
    assert.equal(decoded.bpm, normalized.bpm);
    assert.equal(decoded.root, normalized.root);
    assert.equal(decoded.scale, normalized.scale);
    assert.equal(decoded.rings.length, normalized.rings.length);
    assert.equal(decoded.rings[0].steps, normalized.rings[0].steps);
    assert.equal(decoded.rings[0].pulses, normalized.rings[0].pulses);
  }
});

test('URL hash serialization preserves custom step overrides', () => {
  const state = normalizeState(PRESETS[0]);
  state.rings[0].customSteps = new Array(state.rings[0].steps).fill(false);
  state.rings[0].customSteps[0] = true;
  state.rings[0].customSteps[3] = true;

  const decoded = decodeStateFromHash(encodeStateToHash(state));
  assert.deepEqual(decoded.rings[0].customSteps, state.rings[0].customSteps);
});

test('decodeStateFromHash returns null on invalid tokens', () => {
  assert.equal(decodeStateFromHash(''), null);
  assert.equal(decodeStateFromHash('#state=%%%invalid%%%'), null);
});
