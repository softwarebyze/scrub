import { clampLoop, resolveHotkey } from "./player-hotkeys";

function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

const base = {
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
};

eq(resolveHotkey({ ...base, key: " " }), { type: "togglePlay" }, "space");
eq(
  resolveHotkey({ ...base, key: "ArrowLeft" }),
  { type: "jumpFrames", frames: -1 },
  "left",
);
eq(
  resolveHotkey({ ...base, key: "ArrowRight", shiftKey: true }),
  { type: "jumpFrames", frames: 5 },
  "shift-right",
);
eq(
  resolveHotkey({ ...base, key: "ArrowLeft", altKey: true }),
  { type: "jumpFrames", frames: -10 },
  "alt-left",
);
eq(resolveHotkey({ ...base, key: "m" }), { type: "addMarker" }, "mark");
eq(resolveHotkey({ ...base, key: "i" }), { type: "setIn" }, "in");
eq(resolveHotkey({ ...base, key: "o" }), { type: "setOut" }, "out");
eq(resolveHotkey({ ...base, key: "l" }), { type: "toggleLoop" }, "loop");
eq(resolveHotkey({ ...base, key: "f" }), { type: "saveFrame" }, "save");
eq(resolveHotkey({ ...base, key: "a", metaKey: true }), null, "meta ignored");

eq(clampLoop(1, 3), { in: 1, out: 3 }, "clamp ok");
eq(clampLoop(3, 1), null, "clamp reversed");
eq(clampLoop(1, 1.02), null, "clamp too tight");
eq(clampLoop(null, 2), null, "clamp missing");

console.log("player-hotkeys.test.ts: ok");
