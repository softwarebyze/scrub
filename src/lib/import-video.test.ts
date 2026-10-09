import { isVideoFile, isVideoUrl, parseClipboardVideoUrl } from "./import-video";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

eq(isVideoUrl("https://cdn.example.com/clip.mp4"), true, "mp4 url");
eq(isVideoUrl("https://example.com/page"), false, "html url");
eq(
  parseClipboardVideoUrl("check this https://x.com/a.mov thanks"),
  "https://x.com/a.mov",
  "parse url from paste",
);
eq(isVideoFile({ type: "video/mp4", name: "a.mp4" }), true, "file type");
eq(isVideoFile({ name: "swing.MOV" }), true, "file ext");
eq(isVideoFile({ type: "image/png", name: "a.png" }), false, "not image");

console.log("import-video.test.ts: ok");
