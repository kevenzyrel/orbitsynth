/**
 * High-DPI HTML5 Canvas visualizer for OrbitSynth.
 * Draws concentric Euclidean orbit rings, inner symmetry polygons,
 * rotating playheads, audio-reactive core, and hit ripples.
 */

const TAU = Math.PI * 2;
const TOP_OFFSET = -Math.PI / 2;

export class OrbitalCanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ onNodeClick?: (ringIndex: number, stepIndex: number) => void }} callbacks
   */
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;
    this.width = 600;
    this.height = 600;
    this.dpr = 1;
    this.nodePositions = [];
    this.ripples = [];
    this.hoveredNode = null;

    this._bindEvents();
    this.resize();
  }

  _bindEvents() {
    this.canvas.addEventListener('pointermove', (e) => {
      const hit = this._hitTest(e);
      this.hoveredNode = hit;
      this.canvas.style.cursor = hit ? 'pointer' : 'default';
    });

    this.canvas.addEventListener('pointerleave', () => {
      this.hoveredNode = null;
      this.canvas.style.cursor = 'default';
    });

    this.canvas.addEventListener('click', (e) => {
      const hit = this._hitTest(e);
      if (hit && this.callbacks.onNodeClick) {
        this.callbacks.onNodeClick(hit.ringIndex, hit.stepIndex);
      }
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(320, rect.width || 600);
    this.height = Math.max(320, rect.height || 600);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
  }

  /**
   * Spawn an expanding glow ripple when a ring triggers a note.
   */
  addRipple(ringIndex, stepIndex, color) {
    this.ripples.push({
      ringIndex,
      stepIndex,
      color,
      bornAt: performance.now(),
      duration: 520,
    });
  }

  _hitTest(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    for (const node of this.nodePositions) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= node.hitRadius * node.hitRadius) {
        return node;
      }
    }
    return null;
  }

  /**
   * Render a full animation frame.
   * @param {{
   *   rings: Array<object>,
   *   patterns: boolean[][],
   *   ringPhases: number[],
   *   selectedRingIndex: number,
   *   energy: number,
   *   isPlaying: boolean,
   *   now: number
   * }} frame
   */
  render({ rings, patterns, ringPhases, selectedRingIndex, energy, isPlaying, now }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.width, this.height);

    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxRadius = Math.min(cx, cy) - 34;
    const innerRadius = Math.max(44, maxRadius * 0.22);
    const count = Math.max(1, rings.length);
    const ringSpacing = count === 1 ? 0 : (maxRadius - innerRadius) / (count - 0.35);

    this._drawBackdrop(ctx, cx, cy, maxRadius, innerRadius, energy, isPlaying);

    this.nodePositions = [];

    rings.forEach((ring, ringIdx) => {
      const radius = count === 1 ? (innerRadius + maxRadius) * 0.55 : innerRadius + ringIdx * ringSpacing;
      const pattern = patterns[ringIdx] || [];
      const phase = ringPhases[ringIdx] || 0;
      const isSelected = ringIdx === selectedRingIndex;

      this._drawRing({
        ctx,
        cx,
        cy,
        radius,
        ring,
        ringIdx,
        pattern,
        phase,
        isSelected,
        isPlaying,
      });
    });

    this._drawRipples(ctx, now);
    ctx.restore();
  }

  _drawBackdrop(ctx, cx, cy, maxRadius, innerRadius, energy, isPlaying) {
    // Subtle radial observatory grid
    const auraRadius = innerRadius * (0.9 + energy * 0.75);
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, maxRadius * 1.1);
    grad.addColorStop(0, `rgba(56, 189, 248, ${0.14 + energy * 0.28})`);
    grad.addColorStop(0.45, 'rgba(99, 102, 241, 0.05)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius * 1.1, 0, TAU);
    ctx.fill();

    // 12 o'clock beat marker line
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - innerRadius * 0.5);
    ctx.lineTo(cx, cy - maxRadius - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center harmonic core
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius * 0.45, 0, TAU);
    ctx.fillStyle = isPlaying ? 'rgba(56, 189, 248, 0.18)' : 'rgba(148, 163, 184, 0.09)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = isPlaying ? 'rgba(56, 189, 248, 0.65)' : 'rgba(148, 163, 184, 0.28)';
    ctx.stroke();
  }

  _drawRing({ ctx, cx, cy, radius, ring, ringIdx, pattern, phase, isSelected, isPlaying }) {
    const steps = pattern.length || ring.steps;
    const alphaBase = ring.muted ? 0.28 : 1;

    // Orbit circle
    ctx.save();
    ctx.globalAlpha = alphaBase;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.strokeStyle = isSelected ? `${ring.color}88` : 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = isSelected ? 2 : 1.2;
    ctx.stroke();

    // Euclidean geometry polygon connecting active hits
    const activeCoords = [];
    for (let s = 0; s < steps; s++) {
      const angle = TOP_OFFSET + (s / steps) * TAU;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (pattern[s]) {
        activeCoords.push({ x, y });
      }
    }

    if (activeCoords.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(activeCoords[0].x, activeCoords[0].y);
      for (let i = 1; i < activeCoords.length; i++) {
        ctx.lineTo(activeCoords[i].x, activeCoords[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = `${ring.color}44`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = `${ring.color}0c`;
      ctx.fill();
    }

    // Playhead sweep arm & glowing orb
    if (isPlaying || phase > 0) {
      const headAngle = TOP_OFFSET + phase * TAU;
      const hx = cx + Math.cos(headAngle) * radius;
      const hy = cy + Math.sin(headAngle) * radius;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = `${ring.color}28`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    const activeStep = Math.floor(phase * steps) % steps;

    // Step nodes
    for (let s = 0; s < steps; s++) {
      const angle = TOP_OFFSET + (s / steps) * TAU;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const isActive = Boolean(pattern[s]);
      const isCurrent = isPlaying && s === activeStep;
      const isHovered = this.hoveredNode &&
        this.hoveredNode.ringIndex === ringIdx &&
        this.hoveredNode.stepIndex === s;

      const nodeRadius = isActive ? (isCurrent ? 8.5 : 6.5) : 3.5;

      ctx.beginPath();
      ctx.arc(x, y, isHovered ? nodeRadius + 2 : nodeRadius, 0, TAU);
      if (isActive) {
        ctx.fillStyle = isCurrent ? '#ffffff' : ring.color;
        ctx.shadowColor = ring.color;
        ctx.shadowBlur = isCurrent ? 16 : 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = isHovered ? 'rgba(226, 232, 240, 0.7)' : 'rgba(148, 163, 184, 0.32)';
        ctx.fill();
      }

      this.nodePositions.push({
        ringIndex: ringIdx,
        stepIndex: s,
        x,
        y,
        hitRadius: 13,
      });
    }

    ctx.restore();
  }

  _drawRipples(ctx, now) {
    const alive = [];
    for (const ripple of this.ripples) {
      const age = now - ripple.bornAt;
      if (age >= ripple.duration) continue;
      alive.push(ripple);

      const node = this.nodePositions.find(
        (n) => n.ringIndex === ripple.ringIndex && n.stepIndex === ripple.stepIndex
      );
      if (!node) continue;

      const t = age / ripple.duration;
      const eased = 1 - Math.pow(1 - t, 3);
      ctx.beginPath();
      ctx.arc(node.x, node.y, 7 + eased * 24, 0, TAU);
      ctx.strokeStyle = ripple.color;
      ctx.globalAlpha = (1 - t) * 0.75;
      ctx.lineWidth = 2 * (1 - t) + 0.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.ripples = alive;
  }
}
