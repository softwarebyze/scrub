import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const HEIGHT = 112;
const TICK_PX = 10;
// Cap on total strip width so we don't render tens of thousands of ticks
// for a long video. Drag feel adjusts via the down-finer modes instead.
const TARGET_STRIP_PX = 5200;
const MAX_TICKS = 800;
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
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
}
function modeHaptic() {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}

function niceMajorStep(tickStepSec: number) {
  // Major tick every "nice" interval, at least every 4 minor ticks.
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
  for (const c of candidates) if (c / tickStepSec >= 4) return c;
  return 1800;
}

export function Scrubber({
  duration,
  currentTime,
  onScrub,
  onScrubStart,
  onScrubEnd,
}: Props) {
  // Virtual head time. Source of truth during interaction; mirrors
  // `currentTime` while idle.
  const headTime = useSharedValue(currentTime);
  const isInteracting = useSharedValue(false);
  const lastSeekMs = useSharedValue(0);
  const lastTickBucket = useSharedValue(0);
  const lastTickMs = useSharedValue(0);
  const edgeState = useSharedValue(0);
  const lastMode = useSharedValue(0);

  const [scrubbing, setScrubbing] = useState(false);
  const [displayTime, setDisplayTime] = useState(currentTime);
  const [mode, setMode] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const lastInteractionEnd = useRef(0);

  const layout = useMemo(() => {
    if (!duration || duration < 0.05) {
      return { pxPerSec: 80, tickStepSec: 10 / 80, majorStepSec: 1, stripPx: 0, tickCount: 0 };
    }
    const pxPerSec = Math.min(140, TARGET_STRIP_PX / duration);
    const tickStepSec = TICK_PX / pxPerSec;
    const majorStepSec = niceMajorStep(tickStepSec);
    const stripPx = duration * pxPerSec;
    const tickCount = Math.min(MAX_TICKS, Math.ceil(stripPx / TICK_PX) + 1);
    return { pxPerSec, tickStepSec, majorStepSec, stripPx, tickCount };
  }, [duration]);

  // Sync external currentTime → headTime while idle.
  useEffect(() => {
    if (scrubbing) return;
    if (Date.now() - lastInteractionEnd.current < 250) return;
    setDisplayTime(currentTime);
    headTime.set(currentTime);
  }, [currentTime, scrubbing, headTime]);

  // During interaction: throttle seek pushes, fire tick + edge haptics.
  useAnimatedReaction(
    () => headTime.get(),
    (t, prev) => {
      if (prev === null || prev === undefined) return;
      if (!isInteracting.get()) return;
      runOnJS(setDisplayTime)(t);
      const now = Date.now();
      if (now - lastSeekMs.get() >= 30) {
        lastSeekMs.set(now);
        runOnJS(onScrub)(t);
      }
      // Haptic detents: bucket size depends on precision mode so finer modes
      // tick more often — gives the wheel a real "geared" feel.
      const m = lastMode.get();
      const bucketSec =
        m === 0
          ? layout.majorStepSec
          : m === 1
          ? Math.max(layout.tickStepSec, layout.majorStepSec / 2)
          : m === 2
          ? layout.tickStepSec
          : 1 / 30;
      const bucket = Math.floor(t / Math.max(0.01, bucketSec));
      if (bucket !== lastTickBucket.get()) {
        lastTickBucket.set(bucket);
        if (now - lastTickMs.get() >= 22) {
          lastTickMs.set(now);
          runOnJS(tickHaptic)();
        }
      }
      let edge: 0 | 1 | -1 = 0;
      if (t <= 0.001) edge = -1;
      else if (duration > 0 && t >= duration - 0.001) edge = 1;
      if (edge !== 0 && edge !== edgeState.get()) {
        edgeState.set(edge);
        runOnJS(edgeHaptic)();
      } else if (edge === 0 && edgeState.get() !== 0) {
        edgeState.set(0);
      }
    }
  );

  const setModeJs = useCallback((m: number) => {
    setMode(m);
    modeHaptic();
  }, []);

  const setScrubbingJs = useCallback((v: boolean) => {
    setScrubbing(v);
  }, []);

  const finishScrub = useCallback(
    (finalTime: number) => {
      onScrub(finalTime);
      lastInteractionEnd.current = Date.now();
      setScrubbing(false);
      setMode(0);
      onScrubEnd();
    },
    [onScrub, onScrubEnd]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          cancelAnimation(headTime);
          isInteracting.set(true);
          lastSeekMs.set(0);
          lastTickBucket.set(
            Math.floor(headTime.get() / Math.max(0.01, layout.majorStepSec))
          );
          lastTickMs.set(0);
          edgeState.set(0);
          runOnJS(setScrubbingJs)(true);
          runOnJS(onScrubStart)();
        })
        .onChange((e) => {
          const dy = Math.max(0, e.y);
          const speed = dy > 140 ? 0.05 : dy > 100 ? 0.25 : dy > 70 ? 0.5 : 1;
          const m = speed === 1 ? 0 : speed === 0.5 ? 1 : speed === 0.25 ? 2 : 3;
          if (m !== lastMode.get()) {
            lastMode.set(m);
            runOnJS(setModeJs)(m);
          }
          const dt = (-e.changeX / layout.pxPerSec) * speed;
          headTime.set(Math.max(0, Math.min(duration, headTime.get() + dt)));
        })
        .onEnd((e) => {
          const dy = Math.max(0, e.y);
          const speed = dy > 140 ? 0.05 : dy > 100 ? 0.25 : dy > 70 ? 0.5 : 1;
          const v = (-e.velocityX / layout.pxPerSec) * speed;
          if (Math.abs(v) < 0.5) {
            isInteracting.set(false);
            lastMode.set(0);
            runOnJS(finishScrub)(headTime.get());
            return;
          }
          headTime.set(
            withDecay(
              { velocity: v, clamp: [0, duration], deceleration: 0.998 },
              (finished) => {
                if (!finished) return;
                isInteracting.set(false);
                lastMode.set(0);
                runOnJS(finishScrub)(headTime.get());
              }
            )
          );
        })
        .onFinalize((_e, success) => {
          if (!success) {
            cancelAnimation(headTime);
            isInteracting.set(false);
            lastMode.set(0);
            runOnJS(finishScrub)(headTime.get());
          }
        }),
    [
      duration,
      layout.majorStepSec,
      layout.pxPerSec,
      finishScrub,
      onScrubStart,
      setModeJs,
      setScrubbingJs,
      headTime,
      isInteracting,
      lastSeekMs,
      lastTickBucket,
      lastTickMs,
      edgeState,
      lastMode,
    ]
  );

  // The tick strip translates so headTime aligns with the playhead at center.
  const stripStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: trackW / 2 - headTime.get() * layout.pxPerSec },
      { scaleY: withSpring(isInteracting.get() ? 1.03 : 1, { damping: 14 }) },
    ],
  }));

  const majorEveryN = Math.max(1, Math.round(layout.majorStepSec / Math.max(0.0001, layout.tickStepSec)));

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
          onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[styles.strip, { width: layout.stripPx }, stripStyle]}
            pointerEvents="none"
          >
            {Array.from({ length: layout.tickCount }).map((_, i) => {
              const isMajor = i % majorEveryN === 0;
              return (
                <View
                  key={i}
                  style={[
                    styles.tick,
                    { left: i * TICK_PX },
                    isMajor && styles.tickMajor,
                  ]}
                />
              );
            })}
          </Animated.View>

          <View style={styles.playhead} pointerEvents="none" />
        </View>
      </GestureDetector>

      <View style={styles.bottomRow}>
        <Text style={styles.hint}>spin the wheel · slide down = finer</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 0, paddingTop: 6, paddingBottom: 14 },
  modeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    height: 22,
    marginBottom: 4,
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
    marginBottom: 8,
    // @ts-ignore
    userSelect: "none",
  },
  track: {
    height: HEIGHT,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
  },
  strip: { height: HEIGHT, position: "relative" },
  tick: {
    position: "absolute",
    top: HEIGHT / 2 - 16,
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  tickMajor: {
    top: HEIGHT / 2 - 26,
    width: 2,
    height: 52,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  playhead: {
    position: "absolute",
    left: "50%",
    marginLeft: -2,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
    backgroundColor: "#ff3b30",
    shadowColor: "#ff3b30",
    shadowOpacity: 0.85,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 16,
  },
  hint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    // @ts-ignore
    userSelect: "none",
  },
});
