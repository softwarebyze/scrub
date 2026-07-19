/** Keyboard → player actions. Pure mapping so it can be unit-checked. */

export type HotkeyAction =
  | { type: "togglePlay" }
  | { type: "jumpFrames"; frames: number }
  | { type: "addMarker" }
  | { type: "prevMarker" }
  | { type: "nextMarker" }
  | { type: "setIn" }
  | { type: "setOut" }
  | { type: "toggleLoop" }
  | { type: "toggleMute" }
  | { type: "saveFrame" };

function stepFrames(e: { shiftKey: boolean; altKey: boolean }, dir: 1 | -1) {
  const n = e.altKey ? 10 : e.shiftKey ? 5 : 1;
  return n * dir;
}

export function resolveHotkey(e: {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}): HotkeyAction | null {
  if (e.metaKey || e.ctrlKey) return null;
  const key = e.key;

  if (key === " " || key === "k") return { type: "togglePlay" };
  if (key === "m") return { type: "addMarker" };
  if (key === "i") return { type: "setIn" };
  if (key === "o") return { type: "setOut" };
  if (key === "l") return { type: "toggleLoop" };
  if (key === "u") return { type: "toggleMute" };
  if (key === "f" || key === "s") return { type: "saveFrame" };
  if (key === "[") return { type: "prevMarker" };
  if (key === "]") return { type: "nextMarker" };

  if (key === "ArrowLeft" || key === "j" || key === ",") {
    return { type: "jumpFrames", frames: stepFrames(e, -1) };
  }
  if (key === "ArrowRight" || key === ".") {
    return { type: "jumpFrames", frames: stepFrames(e, 1) };
  }

  return null;
}

export function clampLoop(inPoint: number | null, outPoint: number | null) {
  if (inPoint == null || outPoint == null) return null;
  if (!(outPoint > inPoint + 0.05)) return null;
  return { in: inPoint, out: outPoint };
}
