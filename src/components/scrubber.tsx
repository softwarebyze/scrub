import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from "react-native-reanimated";

type Props = {
  duration: number;
  currentTime: number;
  onScrub: (time: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
};

const TRACK_HEIGHT = 110;
const TICK_COUNT = 60;
const MODE_LABELS = ["1× full", "½ half", "¼ fine", "1/20 frame"];

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t - Math.floor(t)) * 1000);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function tickHaptic() {
  if (Platform.OS !== "web") Haptics.selectionAsync();
}

function edgeHaptic() {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
}

function modeHaptic() {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}

export function Scrubber({
  duration,
  currentTime,
  onScrub,
  onScrubStart,
  onScrubEnd,
}: Props) {
  const width = useSharedValue(0);
  // isInteracting: user finger down OR decay still animating.
  const isInteracting = useSharedValue(false);
  const headX = useSharedValue(0);
  const lastSeekMs = useSharedValue(0);
  // Tracks the last "tick bucket" the head was in, for haptic emission as it
  // crosses time-based boundaries during drag.
  const lastTickBucket = useSharedValue(-1);
  const lastTickMs = useSharedValue(0);
  // Edge state: -1 = at left, 1 = at right, 0 = middle. Used to fire one
  // sharper haptic per edge contact, not continuously.
  const edgeState = useSharedValue(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [displayTime, setDisplayTime] = useState(currentTime);
  const [mode, setMode] = useState(0);
  const lastMode = useSharedValue(0);
  // Refractory period to avoid the post-scrub snap-back caused by lagging player.
  const lastInteractionEnd = useRef(0);

  // Sync displayTime to incoming currentTime when NOT scrubbing/flinging
  // and outside a small refractory window.
  useEffect(() => {
    if (scrubbing) return;
    if (Date.now() - lastInteractionEnd.current < 250) return;
    setDisplayTime(currentTime);
  }, [currentTime, scrubbing]);

  // Sync headX to incoming currentTime ONLY when fully idle. No withTiming —
  // the animation was the source of the "drift" feel after release.
  useEffect(() => {
    if (scrubbing) return;
    if (Date.now() - lastInteractionEnd.current < 250) return;
    if (width.value === 0 || duration === 0) return;
    const target = (currentTime / duration) * width.value;
    if (Math.abs(target - headX.value) > 0.5) {
      headX.value = target;
    }
  }, [currentTime, duration, scrubbing]);

  // Throttled push of headX changes (during drag + decay) back to player.
  // Limits seeks to ~33Hz so the native seek can keep up during a fast fling.
  useAnimatedReaction(
    () => headX.value,
    (x, prev) => {
      if (prev === null || prev === undefined) return;
      if (!isInteracting.value) return;
      const w = Math.max(1, width.value);
      const t = (x / w) * duration;
      runOnJS(setDisplayTime)(t);
      const now = Date.now();
      if (now - lastSeekMs.value >= 30) {
        lastSeekMs.value = now;
        runOnJS(onScrub)(t);
      }
      // Tick haptics: emit a selection click each time the head crosses a
      // time bucket boundary. Bucket size shrinks with finer scrub mode so
      // frame-mode feels like a notched ratchet.
      const m = lastMode.value;
      const bucketSec = m === 0 ? 1.0 : m === 1 ? 0.5 : m === 2 ? 0.1 : 1 / 30;
      const bucket = Math.floor(t / bucketSec);
      if (bucket !== lastTickBucket.value) {
        lastTickBucket.value = bucket;
        // Rate-limit so a flick doesn't machine-gun the taptic engine.
        if (now - lastTickMs.value >= 22) {
          lastTickMs.value = now;
          runOnJS(tickHaptic)();
        }
      }
      // Edge haptics: fire once when the head hits 0 or width.
      let edge: 0 | 1 | -1 = 0;
      if (x <= 0.5) edge = -1;
      else if (x >= w - 0.5) edge = 1;
      if (edge !== 0 && edge !== edgeState.value) {
        edgeState.value = edge;
        runOnJS(edgeHaptic)();
      } else if (edge === 0 && edgeState.value !== 0) {
        edgeState.value = 0;
      }
    }
  );

  const setModeJs = (m: number) => {
    setMode(m);
    modeHaptic();
  };

  const finishScrub = (finalTime: number) => {
    // Final precise seek so player & UI converge exactly.
    onScrub(finalTime);
    lastInteractionEnd.current = Date.now();
    setScrubbing(false);
    setMode(0);
    onScrubEnd();
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      cancelAnimation(headX);
      isInteracting.value = true;
      lastSeekMs.value = 0;
      // Seed buckets so the first tick after touchdown doesn't fire spuriously.
      const w = Math.max(1, width.value);
      const t0 = (headX.value / w) * duration;
      lastTickBucket.value = Math.floor(t0 / 1.0);
      lastTickMs.value = 0;
      edgeState.value = 0;
      runOnJS(setScrubbingJs)(true);
      runOnJS(onScrubStart)();
    })
    .onChange((e) => {
      const dy = Math.max(0, e.y);
      const speed = dy > 120 ? 0.05 : dy > 70 ? 0.25 : dy > 30 ? 0.5 : 1;
      const m = speed === 1 ? 0 : speed === 0.5 ? 1 : speed === 0.25 ? 2 : 3;
      if (m !== lastMode.value) {
        lastMode.value = m;
        runOnJS(setModeJs)(m);
      }
      const next = headX.value + e.changeX * speed;
      headX.value = Math.max(0, Math.min(width.value, next));
    })
    .onEnd((e) => {
      const dy = Math.max(0, e.y);
      const speed = dy > 120 ? 0.05 : dy > 70 ? 0.25 : dy > 30 ? 0.5 : 1;
      const v = e.velocityX * speed;
      // Skip decay on tiny flicks — feels like jitter otherwise.
      if (Math.abs(v) < 40) {
        isInteracting.value = false;
        lastMode.value = 0;
        const w = Math.max(1, width.value);
        const t = (headX.value / w) * duration;
        runOnJS(finishScrub)(t);
        return;
      }
      headX.value = withDecay(
        {
          velocity: v,
          clamp: [0, width.value],
          deceleration: 0.996,
        },
        (finished) => {
          if (!finished) return;
          isInteracting.value = false;
          lastMode.value = 0;
          const w = Math.max(1, width.value);
          const t = (headX.value / w) * duration;
          runOnJS(finishScrub)(t);
        }
      );
    })
    .onFinalize((_e, success) => {
      if (!success) {
        cancelAnimation(headX);
        isInteracting.value = false;
        lastMode.value = 0;
        const w = Math.max(1, width.value);
        const t = (headX.value / w) * duration;
        runOnJS(finishScrub)(t);
      }
    });

  const headStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: headX.value - 2 },
      { scaleY: withSpring(isInteracting.value ? 1.15 : 1, { damping: 14 }) },
    ],
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: headX.value - 28 },
      { scale: withSpring(isInteracting.value ? 1.08 : 1, { damping: 14 }) },
    ],
  }));

  function setScrubbingJs(v: boolean) {
    setScrubbing(v);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.modeRow}>
        {MODE_LABELS.map((l, i) => (
          <View
            key={l}
            style={[
              styles.pill,
              i === mode && scrubbing && styles.pillActive,
              !scrubbing && { opacity: 0 },
            ]}
          >
            <Text style={[styles.pillText, i === mode && scrubbing && styles.pillTextActive]}>
              {l}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.time}>{fmt(displayTime)}</Text>

      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width;
            if (duration > 0) {
              headX.value = (currentTime / duration) * e.nativeEvent.layout.width;
            }
          }}
        >
          <View style={styles.ticks} pointerEvents="none">
            {Array.from({ length: TICK_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[styles.tick, i % 10 === 0 && styles.tickMajor]}
              />
            ))}
          </View>
          <Animated.View style={[styles.head, headStyle]} pointerEvents="none" />
          <Animated.View style={[styles.knob, knobStyle]} pointerEvents="none">
            <View style={styles.knobInner} />
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.bottomRow}>
        <Text style={styles.hint}>drag relative • flick to fling • down = finer</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
  },
  modeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    height: 22,
    marginBottom: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pillActive: { backgroundColor: "#fff" },
  pillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.3,
    // @ts-ignore
    userSelect: "none",
  },
  pillTextActive: { color: "#000" },
  time: {
    color: "#fff",
    fontSize: 30,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 6,
    // @ts-ignore
    userSelect: "none",
  },
  track: {
    height: TRACK_HEIGHT,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
  },
  ticks: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    alignItems: "center",
    height: "100%",
  },
  tick: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  tickMajor: {
    height: 28,
    width: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  head: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#ff3b30",
    borderRadius: 2,
  },
  knob: {
    position: "absolute",
    top: TRACK_HEIGHT / 2 - 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  knobInner: {
    width: 4,
    height: 26,
    borderRadius: 2,
    backgroundColor: "#ff3b30",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  hint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    // @ts-ignore
    userSelect: "none",
  },
});
