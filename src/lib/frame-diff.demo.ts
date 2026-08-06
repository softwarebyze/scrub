/**
 * Runnable demo: synthetic still → motion → still, print sparkline + peaks.
 *   bun src/lib/frame-diff.demo.ts
 */
import {
  consecutiveDiffs,
  findPeaks,
  type GrayFrame,
} from "@/lib/frame-diff";

function solid(w: number, h: number, v: number): Uint8Array {
  return new Uint8Array(w * h).fill(v);
}

function paintBlob(base: number, blob: number, ox: number, oy: number): Uint8Array {
  const w = 32;
  const h = 18;
  const data = solid(w, h, base);
  for (let y = oy; y < oy + 6; y++) {
    for (let x = ox; x < ox + 8; x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) data[y * w + x] = blob;
    }
  }
  return data;
}

const frames: GrayFrame[] = [];
for (let i = 0; i < 60; i++) {
  const t = i / 30;
  // Frames 20–28: blob jumps right (motion). Else still.
  const moving = i >= 20 && i <= 28;
  const ox = moving ? 4 + (i - 20) * 2 : 4;
  frames.push({
    time: t,
    width: 32,
    height: 18,
    data: paintBlob(30, 220, ox, 6),
  });
}

const diffs = consecutiveDiffs(frames);
const peaks = findPeaks(diffs, { k: 2, minScore: 1, minSeparation: 2 / 30 });
const max = Math.max(1, ...diffs.map((d) => d.score));

const spark = diffs
  .map((d) => {
    const n = Math.round((d.score / max) * 7);
    return "▁▂▃▄▅▆▇█"[n] ?? "▁";
  })
  .join("");

console.log("motion scan demo (synthetic blob slide @ ~0.67–0.93s)");
console.log(spark);
console.log(
  `peaks: ${peaks.map((p) => `${p.time.toFixed(2)}s (score ${p.score.toFixed(1)})`).join(", ") || "(none)"}`,
);
if (peaks.length < 1) process.exit(1);
