import {
  planSampleTimes,
  rgbaToGrayDownsample,
  type GrayFrame,
} from "@/lib/frame-diff";
import { Platform } from "react-native";

const DST_W = 48;
const DST_H = 27;

export type SampleProgress = { done: number; total: number };

async function sampleWeb(
  uri: string,
  times: number[],
  onProgress?: (p: SampleProgress) => void,
  cancelled?: { current: boolean },
): Promise<GrayFrame[]> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = uri;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Could not load video"));
  });

  const canvas = document.createElement("canvas");
  canvas.width = DST_W;
  canvas.height = DST_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");

  const frames: GrayFrame[] = [];
  for (let i = 0; i < times.length; i++) {
    if (cancelled?.current) break;
    const t = Math.min(times[i], Math.max(0, video.duration - 0.001));
    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      try {
        video.currentTime = t;
      } catch (e) {
        video.removeEventListener("seeked", onSeeked);
        reject(e);
      }
    });
    if (cancelled?.current) break;
    ctx.drawImage(video, 0, 0, DST_W, DST_H);
    const img = ctx.getImageData(0, 0, DST_W, DST_H);
    frames.push({
      time: t,
      width: DST_W,
      height: DST_H,
      data: rgbaToGrayDownsample(img.data, DST_W, DST_H, DST_W, DST_H),
    });
    onProgress?.({ done: i + 1, total: times.length });
  }
  return frames;
}

async function decodeJpegToGray(uri: string): Promise<Uint8Array> {
  const jpeg = await import("jpeg-js");
  const res = await fetch(uri);
  const buf = new Uint8Array(await res.arrayBuffer());
  const decoded = jpeg.decode(buf, { useTArray: true });
  return rgbaToGrayDownsample(
    decoded.data,
    decoded.width,
    decoded.height,
    DST_W,
    DST_H,
  );
}

async function sampleNative(
  uri: string,
  times: number[],
  onProgress?: (p: SampleProgress) => void,
  cancelled?: { current: boolean },
): Promise<GrayFrame[]> {
  const VideoThumbnails = await import("expo-video-thumbnails");
  const frames: GrayFrame[] = [];
  for (let i = 0; i < times.length; i++) {
    if (cancelled?.current) break;
    const t = times[i];
    const thumb = await VideoThumbnails.getThumbnailAsync(uri, {
      time: Math.max(0, Math.round(t * 1000)),
      quality: 0.5,
    });
    if (cancelled?.current) break;
    const data = await decodeJpegToGray(thumb.uri);
    frames.push({ time: t, width: DST_W, height: DST_H, data });
    onProgress?.({ done: i + 1, total: times.length });
  }
  return frames;
}

/** Sample downscaled gray frames at planned times for motion scoring. */
export async function sampleGrayFrames(
  uri: string,
  duration: number,
  opts: {
    start?: number;
    end?: number;
    step?: number;
    maxSamples?: number;
    onProgress?: (p: SampleProgress) => void;
    cancelled?: { current: boolean };
  } = {},
): Promise<GrayFrame[]> {
  const times = planSampleTimes(duration, opts);
  if (!times.length) return [];
  if (Platform.OS === "web") return sampleWeb(uri, times, opts.onProgress, opts.cancelled);
  return sampleNative(uri, times, opts.onProgress, opts.cancelled);
}
