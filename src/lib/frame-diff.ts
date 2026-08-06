/** Gray frame buffer for cheap motion scoring (MAE between consecutive samples). */

export type GrayFrame = {
  time: number;
  width: number;
  height: number;
  /** Luma 0–255, length width*height */
  data: Uint8Array;
};

export type DiffSample = {
  /** Time of the later frame in the pair */
  time: number;
  score: number;
};

export type Peak = {
  time: number;
  score: number;
  index: number;
};

/** Plan evenly spaced sample times in [start, end), capped at maxSamples. */
export function planSampleTimes(
  duration: number,
  opts: {
    start?: number;
    end?: number;
    step?: number;
    maxSamples?: number;
  } = {},
): number[] {
  const start = Math.max(0, opts.start ?? 0);
  const end = Math.max(start, Math.min(duration, opts.end ?? duration));
  const span = end - start;
  if (span <= 0 || !isFinite(span)) return [];

  const maxSamples = Math.max(2, opts.maxSamples ?? 240);
  let step = opts.step ?? 1 / 30;
  const needed = Math.floor(span / step) + 1;
  if (needed > maxSamples) step = span / (maxSamples - 1);

  const times: number[] = [];
  for (let t = start; t < end - 1e-6; t += step) {
    times.push(Math.min(t, end - 1e-4));
    if (times.length >= maxSamples) break;
  }
  const last = Math.max(0, end - 1e-4);
  if (!times.length || Math.abs(times[times.length - 1] - last) > step * 0.25) {
    times.push(last);
  }
  return times;
}

/** Average of R/G/B → gray. Stride-samples when src is larger than target. */
export function rgbaToGrayDownsample(
  rgba: Uint8ClampedArray | Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  const out = new Uint8Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor(((y + 0.5) * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor(((x + 0.5) * srcW) / dstW));
      const i = (sy * srcW + sx) * 4;
      // Rec. 601 luma
      out[y * dstW + x] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
    }
  }
  return out;
}

/** Mean absolute difference of two equal-length gray buffers. */
export function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n;
}

/** Diff score at each frame after the first (pair with previous). */
export function consecutiveDiffs(frames: GrayFrame[]): DiffSample[] {
  const out: DiffSample[] = [];
  for (let i = 1; i < frames.length; i++) {
    out.push({
      time: frames[i].time,
      score: meanAbsDiff(frames[i - 1].data, frames[i].data),
    });
  }
  return out;
}

/**
 * Local peaks above an adaptive floor.
 * Floor = median + k * MAD (median absolute deviation), with a small absolute min.
 */
export function findPeaks(
  samples: DiffSample[],
  opts: { k?: number; minScore?: number; minSeparation?: number } = {},
): Peak[] {
  if (samples.length < 3) return [];
  const k = opts.k ?? 2.5;
  const minSeparation = opts.minSeparation ?? 2 / 30;
  const scores = samples.map((s) => s.score).sort((a, b) => a - b);
  const median = scores[Math.floor(scores.length / 2)] ?? 0;
  const deviations = scores.map((s) => Math.abs(s - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)] ?? 0;
  const floor = Math.max(opts.minScore ?? 1.5, median + k * mad);

  const candidates: Peak[] = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i];
    if (s.score < floor) continue;
    if (s.score < samples[i - 1].score || s.score < samples[i + 1].score) continue;
    candidates.push({ time: s.time, score: s.score, index: i });
  }

  // Greedy keep highest peaks with minSeparation.
  candidates.sort((a, b) => b.score - a.score);
  const kept: Peak[] = [];
  for (const p of candidates) {
    if (kept.some((k) => Math.abs(k.time - p.time) < minSeparation)) continue;
    kept.push(p);
  }
  return kept.sort((a, b) => a.time - b.time);
}

export function nearestPeak(
  peaks: Peak[],
  time: number,
  dir: -1 | 1,
  epsilon = 0.04,
): Peak | null {
  if (dir < 0) {
    let best: Peak | null = null;
    for (const p of peaks) {
      if (p.time < time - epsilon) best = p;
    }
    return best;
  }
  for (const p of peaks) {
    if (p.time > time + epsilon) return p;
  }
  return null;
}
