/**
 * Pure Web Audio API polyphonic synthesizer and percussion engine.
 * Includes master compressor, stereo ping-pong delay, and analyzer tap.
 */

import { midiToFreq } from './scales.js';

export class SynthEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.analyser = null;
    this.delayWet = null;
    this.delayL = null;
    this.delayR = null;
    this.noiseBuffer = null;
    this.delayMix = 0.34;
  }

  /**
   * Lazily create and resume the AudioContext on user gesture.
   */
  async ensureReady() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this._buildGraph();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  get currentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  _buildGraph() {
    const ctx = this.ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.85;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.16;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.78;

    // Stereo ping-pong delay bus for lush ambient space
    this.delayL = ctx.createDelay(1.5);
    this.delayR = ctx.createDelay(1.5);
    this.delayL.delayTime.value = 0.32;
    this.delayR.delayTime.value = 0.48;

    const feedbackL = ctx.createGain();
    const feedbackR = ctx.createGain();
    feedbackL.gain.value = 0.36;
    feedbackR.gain.value = 0.36;

    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 3400;

    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = this.delayMix;

    const merger = ctx.createChannelMerger(2);

    this.delayL.connect(feedbackL);
    feedbackL.connect(this.delayR);
    this.delayR.connect(feedbackR);
    feedbackR.connect(delayFilter);
    delayFilter.connect(this.delayL);

    this.delayL.connect(merger, 0, 0);
    this.delayR.connect(merger, 0, 1);
    merger.connect(this.delayWet);
    this.delayWet.connect(this.compressor);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.noiseBuffer = this._createNoiseBuffer(1.0);
  }

  _createNoiseBuffer(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  setDelayMix(mix) {
    this.delayMix = Math.max(0, Math.min(0.75, mix));
    if (this.delayWet && this.ctx) {
      this.delayWet.gain.setTargetAtTime(this.delayMix, this.ctx.currentTime, 0.03);
    }
  }

  setTempo(bpm) {
    if (!this.ctx || !this.delayL || !this.delayR) return;
    const eighth = 60 / bpm / 2;
    const dottedEighth = eighth * 1.5;
    this.delayL.delayTime.setTargetAtTime(Math.min(1.2, dottedEighth), this.ctx.currentTime, 0.05);
    this.delayR.delayTime.setTargetAtTime(Math.min(1.2, eighth * 2), this.ctx.currentTime, 0.05);
  }

  /**
   * Read normalized frequency/waveform energy (0..1) for visual reactivity.
   * @param {Uint8Array} targetArray
   * @returns {number}
   */
  sampleEnergy(targetArray) {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(targetArray);
    let sum = 0;
    const count = Math.min(48, targetArray.length);
    for (let i = 0; i < count; i++) {
      sum += targetArray[i];
    }
    return sum / (count * 255);
  }

  /**
   * Trigger a voice at a scheduled Web Audio timestamp.
   * @param {{ voice: string, midi: number, gain: number, time: number, pan?: number }} opts
   */
  trigger({ voice, midi, gain, time, pan = 0 }) {
    if (!this.ctx || gain <= 0.001) return;
    const freq = midiToFreq(midi);
    const when = Math.max(this.ctx.currentTime, time);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), when);
    panner.connect(this.masterGain);

    // Send melodic voices and snares softly to the stereo delay bus
    if (voice !== 'kick') {
      const send = this.ctx.createGain();
      send.gain.value = voice === 'hat' ? 0.18 : 0.42;
      panner.connect(send);
      send.connect(this.delayL);
    }

    switch (voice) {
      case 'kick':
        this._playKick(when, gain, panner);
        break;
      case 'snare':
        this._playSnare(when, gain, panner);
        break;
      case 'hat':
        this._playHat(when, gain, panner);
        break;
      case 'bass':
        this._playBass(when, freq, gain, panner);
        break;
      case 'pad':
        this._playPluck(when, freq, gain, panner);
        break;
      case 'bell':
        this._playBell(when, freq, gain, panner);
        break;
      case 'marimba':
      default:
        this._playMarimba(when, freq, gain, panner);
        break;
    }
  }

  _playBell(when, freq, gain, dest) {
    const ctx = this.ctx;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const env = ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, when);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 2.5, when);
    modGain.gain.setValueAtTime(freq * 1.4, when);
    modGain.gain.exponentialRampToValueAtTime(1, when + 0.55);

    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(gain * 0.34, when + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 1.15);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    env.connect(dest);

    carrier.start(when);
    mod.start(when);
    carrier.stop(when + 1.2);
    mod.stop(when + 1.2);
  }

  _playMarimba(when, freq, gain, dest) {
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc2Gain = ctx.createGain();
    const env = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, when);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 4, when);
    osc2Gain.gain.setValueAtTime(0.28, when);
    osc2Gain.gain.exponentialRampToValueAtTime(0.001, when + 0.09);

    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(gain * 0.42, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.42);

    osc1.connect(env);
    osc2.connect(osc2Gain);
    osc2Gain.connect(env);
    env.connect(dest);

    osc1.start(when);
    osc2.start(when);
    osc1.stop(when + 0.45);
    osc2.stop(when + 0.45);
  }

  _playPluck(when, freq, gain, dest) {
    const ctx = this.ctx;
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(freq, when);
    oscB.frequency.setValueAtTime(freq * 1.004, when);

    filter.type = 'lowpass';
    filter.Q.value = 3.2;
    filter.frequency.setValueAtTime(Math.min(9000, freq * 7), when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(240, freq * 1.4), when + 0.45);

    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(gain * 0.28, when + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.65);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(env);
    env.connect(dest);

    oscA.start(when);
    oscB.start(when);
    oscA.stop(when + 0.68);
    oscB.stop(when + 0.68);
  }

  _playBass(when, freq, gain, dest) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = 'sawtooth';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);
    sub.frequency.setValueAtTime(freq * 0.5, when);

    filter.type = 'lowpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(Math.min(2600, freq * 6), when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(110, freq * 1.5), when + 0.24);

    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(gain * 0.45, when + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.36);

    osc.connect(filter);
    sub.connect(env);
    filter.connect(env);
    env.connect(dest);

    osc.start(when);
    sub.start(when);
    osc.stop(when + 0.38);
    sub.stop(when + 0.38);
  }

  _playKick(when, gain, dest) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, when);
    osc.frequency.exponentialRampToValueAtTime(44, when + 0.11);

    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(gain * 0.85, when + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);

    osc.connect(env);
    env.connect(dest);

    osc.start(when);
    osc.stop(when + 0.36);
  }

  _playSnare(when, gain, dest) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1850;
    bandpass.Q.value = 0.9;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(gain * 0.45, when);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, when + 0.17);

    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(195, when);
    body.frequency.exponentialRampToValueAtTime(95, when + 0.07);

    const bodyEnv = ctx.createGain();
    bodyEnv.gain.setValueAtTime(gain * 0.38, when);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, when + 0.11);

    noise.connect(bandpass);
    bandpass.connect(noiseEnv);
    noiseEnv.connect(dest);

    body.connect(bodyEnv);
    bodyEnv.connect(dest);

    noise.start(when);
    noise.stop(when + 0.19);
    body.start(when);
    body.stop(when + 0.12);
  }

  _playHat(when, gain, dest) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7200;

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain * 0.28, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.065);

    noise.connect(highpass);
    highpass.connect(env);
    env.connect(dest);

    noise.start(when);
    noise.stop(when + 0.08);
  }
}
