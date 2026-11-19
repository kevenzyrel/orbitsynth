/**
 * OrbitSynth main controller: lookahead Web Audio scheduler,
 * state management, DOM controls, URL hash sharing, and keyboard shortcuts.
 */

import { generateEuclideanPattern, clampInt } from './music/euclidean.js';
import { NOTE_NAMES, SCALES, scaleDegreeToMidi, formatMidiNote } from './music/scales.js';
import {
  PRESETS,
  RING_COLORS,
  VOICES,
  normalizeRing,
  normalizeState,
  encodeStateToHash,
  decodeStateFromHash,
} from './music/presets.js';
import { SynthEngine } from './audio/synthEngine.js';
import { OrbitalCanvasRenderer } from './ui/canvasRenderer.js';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;

const synth = new SynthEngine();
const initialFromHash = decodeStateFromHash(window.location.hash);
let state = normalizeState(initialFromHash || PRESETS[0]);
let selectedRingIndex = 0;
let isPlaying = false;
let schedulerTimer = null;
let startAudioTime = 0;
let ringCursors = [];
const freqBins = new Uint8Array(64);

const elements = {
  canvas: document.getElementById('orbitCanvas'),
  playBtn: document.getElementById('playBtn'),
  presetSelect: document.getElementById('presetSelect'),
  bpmInput: document.getElementById('bpmInput'),
  bpmValue: document.getElementById('bpmValue'),
  swingInput: document.getElementById('swingInput'),
  swingValue: document.getElementById('swingValue'),
  delayInput: document.getElementById('delayInput'),
  delayValue: document.getElementById('delayValue'),
  rootSelect: document.getElementById('rootSelect'),
  scaleSelect: document.getElementById('scaleSelect'),
  ringList: document.getElementById('ringList'),
  addRingBtn: document.getElementById('addRingBtn'),
  randomizeBtn: document.getElementById('randomizeBtn'),
  shareBtn: document.getElementById('shareBtn'),
  toast: document.getElementById('toast'),
  inspectorTitle: document.getElementById('inspectorTitle'),
  inspectorBadge: document.getElementById('inspectorBadge'),
  ringNameInput: document.getElementById('ringNameInput'),
  ringVoiceSelect: document.getElementById('ringVoiceSelect'),
  ringStepsInput: document.getElementById('ringStepsInput'),
  ringStepsValue: document.getElementById('ringStepsValue'),
  ringPulsesInput: document.getElementById('ringPulsesInput'),
  ringPulsesValue: document.getElementById('ringPulsesValue'),
  ringRotationInput: document.getElementById('ringRotationInput'),
  ringRotationValue: document.getElementById('ringRotationValue'),
  ringDegreeInput: document.getElementById('ringDegreeInput'),
  ringDegreeValue: document.getElementById('ringDegreeValue'),
  ringOctaveInput: document.getElementById('ringOctaveInput'),
  ringOctaveValue: document.getElementById('ringOctaveValue'),
  ringProbInput: document.getElementById('ringProbInput'),
  ringProbValue: document.getElementById('ringProbValue'),
  ringGainInput: document.getElementById('ringGainInput'),
  ringGainValue: document.getElementById('ringGainValue'),
  resetCustomBtn: document.getElementById('resetCustomBtn'),
  deleteRingBtn: document.getElementById('deleteRingBtn'),
};

const renderer = new OrbitalCanvasRenderer(elements.canvas, {
  onNodeClick: (ringIdx, stepIdx) => {
    const ring = state.rings[ringIdx];
    if (!ring) return;
    selectedRingIndex = ringIdx;
    const basePattern = getRingPattern(ring);
    const updated = [...basePattern];
    updated[stepIdx] = !updated[stepIdx];
    ring.customSteps = updated;
    syncUrlHash();
    renderUI();
  },
});

function getRingPattern(ring) {
  if (Array.isArray(ring.customSteps) && ring.customSteps.length === ring.steps) {
    return ring.customSteps;
  }
  return generateEuclideanPattern(ring.pulses, ring.steps, ring.rotation);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    elements.toast.classList.remove('visible');
  }, 2200);
}

function syncUrlHash() {
  const token = encodeStateToHash(state);
  history.replaceState(null, '', `#state=${token}`);
}

function getStepDurationSec(ring) {
  // Normalize every ring to a 4-beat (bar) cycle or 16th-note subdivisions:
  // 16 steps = 1 bar at 16th notes; other step counts produce true polyrhythms across the bar!
  const barDuration = (60 / state.bpm) * 4;
  return barDuration / ring.steps;
}

function resetCursors() {
  const now = synth.currentTime;
  startAudioTime = now;
  ringCursors = state.rings.map(() => ({
    stepIndex: 0,
    nextStepTime: now + 0.03,
  }));
}

function ensureCursorsLength() {
  const now = synth.currentTime;
  while (ringCursors.length < state.rings.length) {
    ringCursors.push({ stepIndex: 0, nextStepTime: now + 0.05 });
  }
  if (ringCursors.length > state.rings.length) {
    ringCursors.length = state.rings.length;
  }
}

function scheduleAudio() {
  if (!isPlaying || !synth.ctx) return;
  ensureCursorsLength();
  const currentTime = synth.currentTime;

  state.rings.forEach((ring, ringIdx) => {
    const cursor = ringCursors[ringIdx];
    const stepDur = getStepDurationSec(ring);

    while (cursor.nextStepTime < currentTime + SCHEDULE_AHEAD_SEC) {
      const pattern = getRingPattern(ring);
      const stepIdx = cursor.stepIndex % ring.steps;
      const shouldHit = pattern[stepIdx] && !ring.muted && Math.random() <= ring.probability;

      if (shouldHit) {
        const midi = scaleDegreeToMidi(state.root, state.scale, ring.octave, ring.degree);
        const swingOffset = stepIdx % 2 === 1 ? stepDur * state.swing : 0;
        const triggerTime = cursor.nextStepTime + swingOffset;
        const pan = state.rings.length > 1
          ? ((ringIdx / (state.rings.length - 1)) - 0.5) * 0.7
          : 0;

        synth.trigger({
          voice: ring.voice,
          midi,
          gain: ring.gain,
          time: triggerTime,
          pan,
        });

        const delayMs = Math.max(0, (triggerTime - currentTime) * 1000);
        setTimeout(() => {
          if (isPlaying) renderer.addRipple(ringIdx, stepIdx, ring.color);
        }, delayMs);
      }

      cursor.stepIndex = (stepIdx + 1) % ring.steps;
      cursor.nextStepTime += stepDur;
    }
  });
}

async function togglePlayback() {
  if (isPlaying) {
    isPlaying = false;
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    elements.playBtn.textContent = '▶ Play Orbit';
    elements.playBtn.classList.remove('playing');
    return;
  }

  await synth.ensureReady();
  synth.setTempo(state.bpm);
  synth.setDelayMix(state.delayMix);
  resetCursors();
  isPlaying = true;
  elements.playBtn.textContent = '❚❚ Pause';
  elements.playBtn.classList.add('playing');
  schedulerTimer = setInterval(scheduleAudio, LOOKAHEAD_MS);
}

function populateSelects() {
  elements.presetSelect.innerHTML = PRESETS.map(
    (p) => `<option value="${p.id}">${p.name}</option>`
  ).join('') + '<option value="custom">Custom Patch</option>';

  elements.rootSelect.innerHTML = NOTE_NAMES.map(
    (name, idx) => `<option value="${idx}">${name}</option>`
  ).join('');

  elements.scaleSelect.innerHTML = Object.entries(SCALES).map(
    ([key, val]) => `<option value="${key}">${val.label}</option>`
  ).join('');

  elements.ringVoiceSelect.innerHTML = Object.entries(VOICES).map(
    ([key, val]) => `<option value="${key}">${val.label}</option>`
  ).join('');

  if (initialFromHash) {
    elements.presetSelect.value = 'custom';
  }
}

function renderGlobalControls() {
  elements.bpmInput.value = String(state.bpm);
  elements.bpmValue.textContent = `${state.bpm} BPM`;

  const swingPct = Math.round(state.swing * 100);
  elements.swingInput.value = String(swingPct);
  elements.swingValue.textContent = `${swingPct}%`;

  const delayPct = Math.round(state.delayMix * 100);
  elements.delayInput.value = String(delayPct);
  elements.delayValue.textContent = `${delayPct}%`;

  elements.rootSelect.value = String(state.root);
  elements.scaleSelect.value = state.scale;
}

function renderRingList() {
  elements.ringList.innerHTML = '';
  state.rings.forEach((ring, idx) => {
    const card = document.createElement('div');
    card.className = `ring-card${idx === selectedRingIndex ? ' selected' : ''}${ring.muted ? ' muted' : ''}`;
    card.style.setProperty('--ring-color', ring.color);

    const isPerc = VOICES[ring.voice]?.percussive;
    const pitchLabel = isPerc
      ? VOICES[ring.voice].label
      : `${VOICES[ring.voice].label} · ${formatMidiNote(scaleDegreeToMidi(state.root, state.scale, ring.octave, ring.degree))}`;

    card.innerHTML = `
      <div class="ring-swatch"></div>
      <div class="ring-meta">
        <div class="ring-title">${escapeHtml(ring.name)}</div>
        <div class="ring-sub">E(${ring.pulses}, ${ring.steps}) · ${pitchLabel}</div>
      </div>
      <button class="mute-btn" type="button" title="Toggle Mute (Key ${idx + 1})">${ring.muted ? 'Muted' : 'On'}</button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.mute-btn')) {
        ring.muted = !ring.muted;
        syncUrlHash();
        renderUI();
        return;
      }
      selectedRingIndex = idx;
      renderUI();
    });

    elements.ringList.appendChild(card);
  });

  elements.addRingBtn.disabled = state.rings.length >= 6;
}

function renderInspector() {
  selectedRingIndex = Math.max(0, Math.min(state.rings.length - 1, selectedRingIndex));
  const ring = state.rings[selectedRingIndex];
  if (!ring) return;

  const isPerc = VOICES[ring.voice]?.percussive;
  const noteName = isPerc
    ? 'Drum'
    : formatMidiNote(scaleDegreeToMidi(state.root, state.scale, ring.octave, ring.degree));

  elements.inspectorTitle.textContent = ring.name;
  elements.inspectorBadge.textContent = ring.customSteps
    ? `Custom ${ring.steps}-step`
    : `E(${ring.pulses}, ${ring.steps}, ${ring.rotation})`;
  elements.inspectorBadge.style.borderColor = ring.color;

  elements.ringNameInput.value = ring.name;
  elements.ringVoiceSelect.value = ring.voice;

  elements.ringStepsInput.value = String(ring.steps);
  elements.ringStepsValue.textContent = String(ring.steps);

  elements.ringPulsesInput.max = String(ring.steps);
  ring.pulses = clampInt(ring.pulses, 0, ring.steps);
  elements.ringPulsesInput.value = String(ring.pulses);
  elements.ringPulsesValue.textContent = String(ring.pulses);

  elements.ringRotationInput.min = String(-ring.steps);
  elements.ringRotationInput.max = String(ring.steps);
  elements.ringRotationInput.value = String(ring.rotation);
  elements.ringRotationValue.textContent = String(ring.rotation);

  elements.ringDegreeInput.value = String(ring.degree);
  elements.ringDegreeValue.textContent = isPerc ? 'N/A' : `Deg ${ring.degree + 1} (${noteName})`;
  elements.ringDegreeInput.disabled = Boolean(isPerc);

  elements.ringOctaveInput.value = String(ring.octave);
  elements.ringOctaveValue.textContent = isPerc ? 'N/A' : `Oct ${ring.octave}`;
  elements.ringOctaveInput.disabled = Boolean(isPerc);

  const probPct = Math.round(ring.probability * 100);
  elements.ringProbInput.value = String(probPct);
  elements.ringProbValue.textContent = `${probPct}%`;

  const gainPct = Math.round(ring.gain * 100);
  elements.ringGainInput.value = String(gainPct);
  elements.ringGainValue.textContent = `${gainPct}%`;

  elements.resetCustomBtn.style.display = ring.customSteps ? 'inline-flex' : 'none';
  elements.deleteRingBtn.disabled = state.rings.length <= 1;
}

function renderUI() {
  renderGlobalControls();
  renderRingList();
  renderInspector();
}

function bindEvents() {
  window.addEventListener('resize', () => renderer.resize());

  elements.playBtn.addEventListener('click', togglePlayback);

  elements.presetSelect.addEventListener('change', (e) => {
    const preset = PRESETS.find((p) => p.id === e.target.value);
    if (!preset) return;
    state = normalizeState(preset);
    selectedRingIndex = 0;
    synth.setTempo(state.bpm);
    synth.setDelayMix(state.delayMix);
    if (isPlaying) resetCursors();
    syncUrlHash();
    renderUI();
    showToast(`Loaded "${preset.name}"`);
  });

  elements.bpmInput.addEventListener('input', (e) => {
    state.bpm = clampInt(e.target.value, 40, 200);
    synth.setTempo(state.bpm);
    syncUrlHash();
    renderGlobalControls();
  });

  elements.swingInput.addEventListener('input', (e) => {
    state.swing = Number(e.target.value) / 100;
    syncUrlHash();
    renderGlobalControls();
  });

  elements.delayInput.addEventListener('input', (e) => {
    state.delayMix = Number(e.target.value) / 100;
    synth.setDelayMix(state.delayMix);
    syncUrlHash();
    renderGlobalControls();
  });

  elements.rootSelect.addEventListener('change', (e) => {
    state.root = clampInt(e.target.value, 0, 11);
    elements.presetSelect.value = 'custom';
    syncUrlHash();
    renderUI();
  });

  elements.scaleSelect.addEventListener('change', (e) => {
    state.scale = e.target.value;
    elements.presetSelect.value = 'custom';
    syncUrlHash();
    renderUI();
  });

  elements.addRingBtn.addEventListener('click', () => {
    if (state.rings.length >= 6) return;
    const idx = state.rings.length;
    const newRing = normalizeRing(
      {
        name: `Orbit ${idx + 1}`,
        voice: idx % 2 === 0 ? 'bell' : 'marimba',
        steps: 12 + (idx % 5),
        pulses: 4 + (idx % 3),
        rotation: idx,
        degree: (idx * 2) % 7,
        octave: idx % 2 === 0 ? 4 : 5,
        color: RING_COLORS[idx % RING_COLORS.length],
      },
      idx
    );
    state.rings.push(newRing);
    selectedRingIndex = idx;
    elements.presetSelect.value = 'custom';
    ensureCursorsLength();
    syncUrlHash();
    renderUI();
  });

  elements.randomizeBtn.addEventListener('click', randomizeHarmony);

  elements.shareBtn.addEventListener('click', async () => {
    syncUrlHash();
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Shareable patch link copied!');
    } catch {
      showToast('Patch URL updated in address bar');
    }
  });

  // Ring Inspector bindings
  const updateSelected = (mutator) => {
    const ring = state.rings[selectedRingIndex];
    if (!ring) return;
    mutator(ring);
    elements.presetSelect.value = 'custom';
    syncUrlHash();
    renderUI();
  };

  elements.ringNameInput.addEventListener('input', (e) => {
    updateSelected((ring) => {
      ring.name = e.target.value.slice(0, 24) || 'Orbit';
    });
  });

  elements.ringVoiceSelect.addEventListener('change', (e) => {
    updateSelected((ring) => {
      ring.voice = e.target.value;
    });
  });

  elements.ringStepsInput.addEventListener('input', (e) => {
    updateSelected((ring) => {
      ring.steps = clampInt(e.target.value, 2, 32);
      ring.pulses = clampInt(ring.pulses, 0, ring.steps);
      ring.customSteps = null;
    });
  });

  elements.ringPulsesInput.addEventListener('input', (e) => {
    updateSelected((ring) => {
      ring.pulses = clampInt(e.target.value, 0, ring.steps);
      ring.customSteps = null;
    });
  });

  elements.ringRotationInput.addEventListener('input', (e) => {
    updateSelected((ring) => {
      ring.rotation = clampInt(e.target.value, -ring.steps, ring.steps);
      ring.customSteps = null;
    });
  });

  elements.ringDegreeInput.addEventListener('input', (e) => {
    updateSelected((ring) => {
      ring.degree = clampInt(e.target.value, 0, 14);
    });
  });

  elements.ringOctaveInput.addEventListener('input', (e) => {
    updateSelected((ring) => {
      ring.octave = clampInt(e.target.value, 1, 6);
    });
  });

  elements.ringProbInput.addEventListener('input', (e) => {
    updateSelected((ring) => {
      ring.probability = Number(e.target.value) / 100;
    });
  });

  elements.ringGainInput.addEventListener('input', (e) => {
    updateSelected((ring) => {
      ring.gain = Number(e.target.value) / 100;
    });
  });

  elements.resetCustomBtn.addEventListener('click', () => {
    updateSelected((ring) => {
      ring.customSteps = null;
    });
    showToast('Restored Euclidean pattern');
  });

  elements.deleteRingBtn.addEventListener('click', () => {
    if (state.rings.length <= 1) return;
    state.rings.splice(selectedRingIndex, 1);
    selectedRingIndex = Math.max(0, selectedRingIndex - 1);
    elements.presetSelect.value = 'custom';
    ensureCursorsLength();
    syncUrlHash();
    renderUI();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayback();
    } else if (e.key === 'r' || e.key === 'R') {
      randomizeHarmony();
    } else if (e.key >= '1' && e.key <= '6') {
      const idx = Number(e.key) - 1;
      if (state.rings[idx]) {
        state.rings[idx].muted = !state.rings[idx].muted;
        syncUrlHash();
        renderUI();
      }
    }
  });
}

function randomizeHarmony() {
  const scaleKeys = Object.keys(SCALES);
  state.root = Math.floor(Math.random() * 12);
  state.scale = scaleKeys[Math.floor(Math.random() * scaleKeys.length)];

  state.rings.forEach((ring) => {
    ring.customSteps = null;
    if (ring.voice === 'kick') {
      ring.pulses = clampInt(3 + Math.floor(Math.random() * 3), 2, ring.steps);
    } else {
      ring.steps = 7 + Math.floor(Math.random() * 11);
      ring.pulses = clampInt(2 + Math.floor(Math.random() * Math.max(2, ring.steps * 0.55)), 1, ring.steps);
      ring.rotation = Math.floor(Math.random() * ring.steps);
      ring.degree = Math.floor(Math.random() * 7);
    }
  });

  elements.presetSelect.value = 'custom';
  if (isPlaying) resetCursors();
  syncUrlHash();
  renderUI();
  showToast('Generated new orbital harmony');
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function animationLoop(now) {
  const currentAudioTime = synth.ctx ? synth.currentTime : 0;
  const ringPhases = state.rings.map((ring, idx) => {
    if (!isPlaying || !synth.ctx || !ringCursors[idx]) return 0;
    const cursor = ringCursors[idx];
    const stepDur = getStepDurationSec(ring);
    const stepsRemaining = (cursor.nextStepTime - currentAudioTime) / stepDur;
    const exactStep = (((cursor.stepIndex - stepsRemaining) % ring.steps) + ring.steps) % ring.steps;
    return exactStep / ring.steps;
  });
  const patterns = state.rings.map((ring) => getRingPattern(ring));
  const energy = isPlaying ? synth.sampleEnergy(freqBins) : 0;

  renderer.render({
    rings: state.rings,
    patterns,
    ringPhases,
    selectedRingIndex,
    energy,
    isPlaying,
    now,
  });

  requestAnimationFrame(animationLoop);
}

populateSelects();
bindEvents();
renderUI();
requestAnimationFrame(animationLoop);
