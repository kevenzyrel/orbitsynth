/**
 * Musical scales, note naming, and frequency conversion helpers.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = {
  pentatonicMinor: {
    label: 'Minor Pentatonic',
    intervals: [0, 3, 5, 7, 10],
  },
  pentatonicMajor: {
    label: 'Major Pentatonic',
    intervals: [0, 2, 4, 7, 9],
  },
  dorian: {
    label: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
  lydian: {
    label: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
  },
  hirajoshi: {
    label: 'Hirajoshi',
    intervals: [0, 2, 3, 7, 8],
  },
  naturalMinor: {
    label: 'Natural Minor',
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  wholeTone: {
    label: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
  },
};

/**
 * Convert a MIDI note number to frequency in Hz (A4 = 440 Hz, MIDI 69).
 * @param {number} midi
 * @returns {number}
 */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Resolve a scale degree (can wrap across octaves) into a MIDI note number.
 * @param {number} rootMidi - Root pitch class (0..11, e.g., 0 = C).
 * @param {string} scaleKey - Key in `SCALES`.
 * @param {number} octave - Base octave (e.g., 3 or 4).
 * @param {number} degree - Scale degree index (0-based).
 * @returns {number} MIDI note number clamped to [24, 108].
 */
export function scaleDegreeToMidi(rootMidi, scaleKey, octave, degree) {
  const scale = SCALES[scaleKey] ?? SCALES.pentatonicMinor;
  const intervals = scale.intervals;
  const len = intervals.length;
  const normalizedDegree = Math.trunc(degree);
  const octaveOffset = Math.floor(normalizedDegree / len);
  const intervalIndex = ((normalizedDegree % len) + len) % len;
  const midi = (octave + 1 + octaveOffset) * 12 + ((rootMidi % 12) + 12) % 12 + intervals[intervalIndex];
  return Math.max(24, Math.min(108, midi));
}

/**
 * Format a MIDI note number as a human-readable pitch (e.g., 60 -> "C4").
 * @param {number} midi
 * @returns {string}
 */
export function formatMidiNote(midi) {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}
