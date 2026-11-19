/**
 * Curated OrbitSynth presets, ring defaults, and URL-safe state serialization.
 */

import { clampInt } from './euclidean.js';
import { SCALES } from './scales.js';

export const RING_COLORS = [
  '#38bdf8', // sky cyan
  '#a78bfa', // soft violet
  '#34d399', // emerald mint
  '#f472b6', // rose neon
  '#fbbf24', // amber gold
  '#fb7185', // coral
];

export const VOICES = {
  bell: { label: 'Glass Bell', percussive: false },
  marimba: { label: 'Warm Marimba', percussive: false },
  pad: { label: 'Analog Pluck', percussive: false },
  bass: { label: 'Sub Bass', percussive: false },
  kick: { label: 'Orbital Kick', percussive: true },
  snare: { label: 'Crisp Snare', percussive: true },
  hat: { label: 'Spark Hat', percussive: true },
};

export const PRESETS = [
  {
    id: 'cosmic-clockwork',
    name: 'Cosmic Clockwork',
    bpm: 112,
    swing: 0.08,
    root: 2, // D
    scale: 'pentatonicMinor',
    delayMix: 0.34,
    rings: [
      { name: 'Pulse Kick', voice: 'kick', steps: 16, pulses: 4, rotation: 0, degree: 0, octave: 2, gain: 0.85, probability: 1, muted: false, color: RING_COLORS[5] },
      { name: 'Clock Hat', voice: 'hat', steps: 16, pulses: 11, rotation: 1, degree: 0, octave: 5, gain: 0.45, probability: 0.9, muted: false, color: RING_COLORS[4] },
      { name: 'Sub Gravity', voice: 'bass', steps: 12, pulses: 5, rotation: 0, degree: 0, octave: 2, gain: 0.72, probability: 1, muted: false, color: RING_COLORS[2] },
      { name: 'Marimba Orbit', voice: 'marimba', steps: 16, pulses: 7, rotation: 2, degree: 2, octave: 4, gain: 0.65, probability: 1, muted: false, color: RING_COLORS[0] },
      { name: 'Starlight Bell', voice: 'bell', steps: 13, pulses: 5, rotation: 3, degree: 4, octave: 5, gain: 0.52, probability: 0.92, muted: false, color: RING_COLORS[1] },
    ],
  },
  {
    id: 'tokyo-rain',
    name: 'Tokyo Rain',
    bpm: 96,
    swing: 0.14,
    root: 9, // A
    scale: 'hirajoshi',
    delayMix: 0.44,
    rings: [
      { name: 'Soft Thump', voice: 'kick', steps: 8, pulses: 3, rotation: 0, degree: 0, octave: 2, gain: 0.75, probability: 1, muted: false, color: RING_COLORS[5] },
      { name: 'Rim Snare', voice: 'snare', steps: 16, pulses: 3, rotation: 4, degree: 0, octave: 4, gain: 0.5, probability: 1, muted: false, color: RING_COLORS[3] },
      { name: 'Koto Pluck', voice: 'pad', steps: 16, pulses: 9, rotation: 1, degree: 1, octave: 4, gain: 0.6, probability: 0.95, muted: false, color: RING_COLORS[0] },
      { name: 'Raindrop Bell', voice: 'bell', steps: 11, pulses: 5, rotation: 2, degree: 3, octave: 5, gain: 0.54, probability: 0.85, muted: false, color: RING_COLORS[1] },
      { name: 'Deep Root', voice: 'bass', steps: 14, pulses: 4, rotation: 0, degree: 0, octave: 2, gain: 0.7, probability: 1, muted: false, color: RING_COLORS[2] },
    ],
  },
  {
    id: 'glass-polyphony',
    name: 'Glass Polyphony',
    bpm: 124,
    swing: 0.0,
    root: 5, // F
    scale: 'lydian',
    delayMix: 0.38,
    rings: [
      { name: 'Inner Chime', voice: 'bell', steps: 7, pulses: 4, rotation: 0, degree: 0, octave: 5, gain: 0.56, probability: 1, muted: false, color: RING_COLORS[0] },
      { name: 'Mid Mallet', voice: 'marimba', steps: 9, pulses: 5, rotation: 1, degree: 2, octave: 4, gain: 0.66, probability: 1, muted: false, color: RING_COLORS[1] },
      { name: 'Outer Pluck', voice: 'pad', steps: 13, pulses: 7, rotation: 2, degree: 4, octave: 4, gain: 0.58, probability: 1, muted: false, color: RING_COLORS[2] },
      { name: 'Sub Anchor', voice: 'bass', steps: 16, pulses: 5, rotation: 0, degree: 0, octave: 2, gain: 0.76, probability: 1, muted: false, color: RING_COLORS[4] },
    ],
  },
  {
    id: 'deep-nebula',
    name: 'Deep Nebula',
    bpm: 84,
    swing: 0.06,
    root: 0, // C
    scale: 'dorian',
    delayMix: 0.5,
    rings: [
      { name: 'Heartbeat', voice: 'kick', steps: 16, pulses: 3, rotation: 0, degree: 0, octave: 2, gain: 0.82, probability: 1, muted: false, color: RING_COLORS[5] },
      { name: 'Nebula Pad', voice: 'pad', steps: 12, pulses: 5, rotation: 2, degree: 1, octave: 3, gain: 0.62, probability: 1, muted: false, color: RING_COLORS[1] },
      { name: 'Drift Bell', voice: 'bell', steps: 15, pulses: 6, rotation: 4, degree: 5, octave: 5, gain: 0.48, probability: 0.82, muted: false, color: RING_COLORS[0] },
      { name: 'Dust Hat', voice: 'hat', steps: 16, pulses: 9, rotation: 3, degree: 0, octave: 5, gain: 0.32, probability: 0.75, muted: false, color: RING_COLORS[4] },
    ],
  },
];

/**
 * Create a sanitized ring object with safe bounds and optional step overrides.
 * @param {Partial<object>} raw
 * @param {number} index
 * @returns {object}
 */
export function normalizeRing(raw = {}, index = 0) {
  const steps = clampInt(raw.steps ?? 16, 2, 32);
  const pulses = clampInt(raw.pulses ?? 4, 0, steps);
  const rotation = clampInt(raw.rotation ?? 0, -steps, steps);
  const voice = VOICES[raw.voice] ? raw.voice : 'marimba';
  const degree = clampInt(raw.degree ?? (index % 5), 0, 14);
  const octave = clampInt(raw.octave ?? 4, 1, 6);
  const gain = Math.max(0, Math.min(1, Number.isFinite(Number(raw.gain)) ? Number(raw.gain) : 0.65));
  const probability = Math.max(0.1, Math.min(1, Number.isFinite(Number(raw.probability)) ? Number(raw.probability) : 1));
  const muted = Boolean(raw.muted);
  const color = typeof raw.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.color)
    ? raw.color
    : RING_COLORS[index % RING_COLORS.length];

  const customSteps = Array.isArray(raw.customSteps) && raw.customSteps.length === steps
    ? raw.customSteps.map(Boolean)
    : null;

  return {
    id: raw.id || `ring-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 24) : `Orbit ${index + 1}`,
    voice,
    steps,
    pulses,
    rotation,
    degree,
    octave,
    gain,
    probability,
    muted,
    color,
    customSteps,
  };
}

/**
 * Normalize a full studio state snapshot.
 * @param {Partial<object>} raw
 * @returns {object}
 */
export function normalizeState(raw = {}) {
  const scale = SCALES[raw.scale] ? raw.scale : 'pentatonicMinor';
  const rawRings = Array.isArray(raw.rings) && raw.rings.length > 0
    ? raw.rings.slice(0, 6)
    : PRESETS[0].rings;

  return {
    bpm: clampInt(raw.bpm ?? 112, 40, 200),
    swing: Math.max(0, Math.min(0.4, Number.isFinite(Number(raw.swing)) ? Number(raw.swing) : 0.08)),
    root: clampInt(raw.root ?? 2, 0, 11),
    scale,
    delayMix: Math.max(0, Math.min(0.75, Number.isFinite(Number(raw.delayMix)) ? Number(raw.delayMix) : 0.34)),
    rings: rawRings.map((ring, idx) => normalizeRing(ring, idx)),
  };
}

/**
 * Encode studio state into a compact URL-safe base64 string.
 * @param {object} state
 * @returns {string}
 */
export function encodeStateToHash(state) {
  const normalized = normalizeState(state);
  const compact = {
    b: normalized.bpm,
    w: Number(normalized.swing.toFixed(2)),
    r: normalized.root,
    s: normalized.scale,
    d: Number(normalized.delayMix.toFixed(2)),
    o: normalized.rings.map((ring) => ({
      n: ring.name,
      v: ring.voice,
      st: ring.steps,
      p: ring.pulses,
      ro: ring.rotation,
      dg: ring.degree,
      oc: ring.octave,
      g: Number(ring.gain.toFixed(2)),
      pr: Number(ring.probability.toFixed(2)),
      m: ring.muted ? 1 : 0,
      c: ring.color,
      cs: ring.customSteps ? ring.customSteps.map((x) => (x ? 1 : 0)).join('') : undefined,
    })),
  };

  const json = JSON.stringify(compact);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a URL hash token back into a normalized studio state.
 * @param {string} hashStr
 * @returns {object | null}
 */
export function decodeStateFromHash(hashStr) {
  if (!hashStr || typeof hashStr !== 'string') return null;
  const token = hashStr.replace(/^#?(state=)?/, '').trim();
  if (!token) return null;

  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const compact = JSON.parse(new TextDecoder().decode(bytes));
    if (!compact || !Array.isArray(compact.o)) return null;

    return normalizeState({
      bpm: compact.b,
      swing: compact.w,
      root: compact.r,
      scale: compact.s,
      delayMix: compact.d,
      rings: compact.o.map((item) => ({
        name: item.n,
        voice: item.v,
        steps: item.st,
        pulses: item.p,
        rotation: item.ro,
        degree: item.dg,
        octave: item.oc,
        gain: item.g,
        probability: item.pr,
        muted: Boolean(item.m),
        color: item.c,
        customSteps: typeof item.cs === 'string'
          ? item.cs.split('').map((ch) => ch === '1')
          : null,
      })),
    });
  } catch {
    return null;
  }
}
