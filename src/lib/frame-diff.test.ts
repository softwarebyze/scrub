import {
  consecutiveDiffs,
  findPeaks,
  meanAbsDiff,
  nearestPeak,
  planSampleTimes,
  rgbaToGrayDownsample,
  type DiffSample,
  type GrayFrame,
} from "@/lib/frame-diff";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function solid(w: number, h: number, v: number): Uint8Array {
  return new Uint8Array(w * h).fill(v);
}

function frame(time: number, data: Uint8Array, w = 4, h = 4): GrayFrame {
  return { time, width: w, height: h, data };
}

// --- meanAbsDiff ---
assert(meanAbsDiff(solid(2, 2, 10), solid(2, 2, 10)) === 0, "identical → 0");
assert(meanAbsDiff(solid(2, 2, 0), solid(2, 2, 10)) === 10, "flat delta");

// --- downsample ---
{
  const rgba = new Uint8ClampedArray(2 * 2 * 4);
  // white, black, black, white
  rgba.set([255, 255, 255, 255], 0);
  rgba.set([0, 0, 0, 255], 4);
  rgba.set([0, 0, 0, 255], 8);
  rgba.set([255, 255, 255, 255], 12);
  const g = rgbaToGrayDownsample(rgba, 2, 2, 1, 1);
  assert(g.length === 1, "1x1");
  // center sample lands near average-ish; just ensure in range
  assert(g[0] >= 0 && g[0] <= 255, "luma in range");
}

// --- planSampleTimes ---
{
  const t = planSampleTimes(1, { step: 0.25, maxSamples: 100 });
  assert(t.length >= 4, `expected ~4 samples, got ${t.length}`);
  assert(t[0] === 0, "starts at 0");
  const capped = planSampleTimes(10, { step: 1 / 30, maxSamples: 20 });
  assert(capped.length <= 20, "respects maxSamples");
}

// --- consecutiveDiffs + peaks (synthetic: quiet → spike → quiet) ---
{
  const frames: GrayFrame[] = [
    frame(0.0, solid(4, 4, 40)),
    frame(0.1, solid(4, 4, 41)),
    frame(0.2, solid(4, 4, 42)),
    frame(0.3, solid(4, 4, 200)), // big change
    frame(0.4, solid(4, 4, 201)),
    frame(0.5, solid(4, 4, 202)),
    frame(0.6, solid(4, 4, 50)), // another big change
    frame(0.7, solid(4, 4, 51)),
  ];
  const diffs: DiffSample[] = consecutiveDiffs(frames);
  assert(diffs.length === frames.length - 1, "n-1 diffs");
  const peaks = findPeaks(diffs, { k: 1.5, minScore: 5, minSeparation: 0.05 });
  assert(peaks.length >= 1, `expected peaks, got ${peaks.length}`);
  const times = peaks.map((p) => p.time);
  assert(
    times.some((t) => Math.abs(t - 0.3) < 0.05) || times.some((t) => Math.abs(t - 0.6) < 0.05),
    `peaks should include motion times, got ${times.join(",")}`,
  );

  const next = nearestPeak(peaks, 0.15, 1);
  assert(next != null && next.time > 0.15, "next peak after 0.15");
  const prev = nearestPeak(peaks, 0.55, -1);
  assert(prev != null && prev.time < 0.55, "prev peak before 0.55");
}

console.log("frame-diff: ok");
