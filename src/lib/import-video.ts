/** Shared helpers for importing videos from URLs, files, or clipboard text. */

const VIDEO_URL_RE = /\.(mp4|mov|m4v|webm|mkv|avi|hls|m3u8)(\?|$)/i;

export function isVideoUrl(text: string) {
  const t = text.trim();
  if (!t.startsWith("http://") && !t.startsWith("https://")) return false;
  return VIDEO_URL_RE.test(t);
}

export function parseClipboardVideoUrl(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  // Prefer first http(s) token that looks like a video URL.
  const tokens = t.split(/\s+/);
  for (const token of tokens) {
    if (isVideoUrl(token)) return token;
  }
  if (isVideoUrl(t)) return t;
  return null;
}

export function isVideoFile(file: { type?: string; name?: string }) {
  if (file.type?.startsWith("video/")) return true;
  if (file.name && /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name)) return true;
  return false;
}
