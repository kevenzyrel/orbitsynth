/**
 * Euclidean rhythm generation via Bjorklund's algorithm.
 * Distributes `pulses` active hits as evenly as possible across `steps` slots.
 */

/**
 * Clamp an integer value into `[min, max]`.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * Rotate a pattern right by `offset` steps (positive shifts hits clockwise).
 * @param {boolean[]} pattern
 * @param {number} offset
 * @returns {boolean[]}
 */
export function rotatePattern(pattern, offset) {
  const len = pattern.length;
  if (len === 0) return [];
  const shift = ((Math.round(offset) % len) + len) % len;
  if (shift === 0) return [...pattern];
  return [...pattern.slice(len - shift), ...pattern.slice(0, len - shift)];
}

/**
 * Generate a Euclidean rhythm pattern E(pulses, steps, rotation).
 * @param {number} pulses - Number of active hits (0..steps).
 * @param {number} steps - Total steps in the ring (1..32).
 * @param {number} [rotation=0] - Step rotation offset.
 * @returns {boolean[]} Boolean array of length `steps`.
 */
export function generateEuclideanPattern(pulses, steps, rotation = 0) {
  const safeSteps = clampInt(steps, 1, 32);
  const safePulses = clampInt(pulses, 0, safeSteps);

  if (safePulses === 0) return new Array(safeSteps).fill(false);
  if (safePulses === safeSteps) return new Array(safeSteps).fill(true);

  let groups = [];
  for (let i = 0; i < safeSteps; i++) {
    groups.push([i < safePulses]);
  }

  let ones = safePulses;
  let zeros = safeSteps - safePulses;

  // Bjorklund pairing: repeatedly append remainder groups onto leading groups.
  while (zeros > 1 && ones > 0) {
    const pairCount = Math.min(ones, zeros);
    const nextGroups = [];
    for (let i = 0; i < pairCount; i++) {
      nextGroups.push([...groups[i], ...groups[groups.length - 1 - i]]);
    }
    const remainingStart = pairCount;
    const remainingEnd = groups.length - pairCount;
    for (let i = remainingStart; i < remainingEnd; i++) {
      nextGroups.push(groups[i]);
    }
    groups = nextGroups;
    const prevOnes = ones;
    ones = pairCount;
    zeros = Math.abs(prevOnes - zeros);
  }

  const pattern = groups.flat();
  return rotatePattern(pattern, rotation);
}
