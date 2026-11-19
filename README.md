# OrbitSynth

An interactive **Euclidean polyrhythm & harmonic orbital synthesizer** built with zero external runtime dependencies—powered by the **Web Audio API**, **HTML5 Canvas**, and **ES Modules**.

Each concentric ring represents an independent musical orbit governed by Bjorklund's Euclidean rhythm algorithm $E(k, n, r)$, letting prime step counts (like 7, 11, 13, and 16) interlock into evolving polyrhythms and geometric polygons.

## Features

- **Euclidean Rhythm Engine**: Real-time Bjorklund generator for $E(\text{pulses}, \text{steps}, \text{rotation})$ from 2 to 32 steps per ring, plus manual step toggling directly on the canvas.
- **Pure Web Audio Synthesis**: 7 synthesized voices (`bell`, `marimba`, `pad`, `bass`, `kick`, `snare`, `hat`), stereo panning, master dynamics compressor, and tempo-synced stereo ping-pong delay.
- **Harmonic Scale Quantizer**: Lock all melodic rings to `Minor Pentatonic`, `Major Pentatonic`, `Dorian`, `Lydian`, `Hirajoshi`, `Natural Minor`, or `Whole Tone` in any root key.
- **Interactive Orbital Canvas**: High-DPI visualizer displaying symmetry polygons, phase-locked playheads, audio-reactive center core, and expanding hit ripples.
- **Curated Presets & Shareable Patch URLs**: Switch between built-in patches (`Cosmic Clockwork`, `Tokyo Rain`, `Glass Polyphony`, `Deep Nebula`), mutate harmonies on the fly, and share your exact patch via URL hash (`#state=...`).

## Keyboard Shortcuts

- `Space` — Play / Pause
- `1` – `6` — Mute / Unmute orbital rings 1–6
- `R` — Mutate / Randomize harmony

## Local Development

Serve the directory over HTTP (required for ES modules):

```bash
npm run dev
# or: python -m http.server 4173
```

Then open `http://localhost:4173` in your browser.

## Running Tests

Requires Node.js 20+:

```bash
npm test
```

## GitHub Pages

This repository includes [`.github/workflows/pages.yml`](.github/workflows/pages.yml) to deploy automatically to GitHub Pages when pushed to `main` (enable **Settings → Pages → Source: GitHub Actions**).

## License

MIT
