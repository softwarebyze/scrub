import { Platform } from "react-native";

export type SaveFrameResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function fmtStamp(t: number) {
  const m = Math.floor(Math.max(0, t) / 60);
  const s = Math.floor(Math.max(0, t) % 60);
  const ms = Math.floor((Math.max(0, t) % 1) * 1000);
  return `${m}-${s.toString().padStart(2, "0")}-${ms.toString().padStart(3, "0")}`;
}

async function saveFrameWeb(uri: string, time: number): Promise<SaveFrameResult> {
  try {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.src = uri;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video"));
    });
    const target = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.001));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Seek failed"));
      video.currentTime = target;
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, message: "Canvas unavailable" };
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return { ok: false, message: "Could not encode frame" };
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scrub-frame-${fmtStamp(time)}.png`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true, message: "Frame downloaded" };
  } catch {
    return { ok: false, message: "Couldn't capture frame" };
  }
}

async function saveFrameNative(uri: string, time: number): Promise<SaveFrameResult> {
  try {
    const VideoThumbnails = await import("expo-video-thumbnails");
    const MediaLibrary = await import("expo-media-library");

    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== "granted") {
      return { ok: false, message: "Photos permission needed" };
    }

    const thumb = await VideoThumbnails.getThumbnailAsync(uri, {
      time: Math.max(0, Math.round(time * 1000)),
      quality: 1,
    });

    await MediaLibrary.saveToLibraryAsync(thumb.uri);
    return { ok: true, message: "Frame saved to Photos" };
  } catch {
    return { ok: false, message: "Couldn't save frame" };
  }
}

/** Capture the current frame as a still — the Photos workaround people keep asking for. */
export async function saveFrame(uri: string, time: number): Promise<SaveFrameResult> {
  if (!uri) return { ok: false, message: "No video" };
  if (Platform.OS === "web") return saveFrameWeb(uri, time);
  return saveFrameNative(uri, time);
}
