import { VideoPlayer, VideoView } from "expo-video";
import { memo, useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  player: VideoPlayer;
};

type SavedView = { id: string; scale: number; tx: number; ty: number };

const MIN_SCALE = 1;
const MAX_SCALE = 8;
/** Fixed overview box (16:9-ish) used to draw the viewport rectangle. */
const MAP_W = 108;
const MAP_H = 61;
const ZOOMED = 1.02;

/**
 * Pinch / pan / double-tap zoom over expo-video, plus the readouts you need to
 * actually control it:
 *   - a scale badge, so you know how far in you are
 *   - a viewport minimap, so you know *where* in the frame you are
 *   - saved views, so you can snap back to a detail you found
 *
 * Gestures live on a transparent overlay so the underlying <video> (esp. Safari)
 * cannot steal touches or pop its own chrome.
 */
function ZoomableVideoInner({ player }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);

  // JS-side mirrors. `scale` is quantised so we re-render only when the badge
  // text would actually change, not on every frame of a pinch.
  const [scaleText, setScaleText] = useState("1.0×");
  const [zoomed, setZoomed] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);

  const clampTranslate = (s: number, x: number, y: number) => {
    "worklet";
    const maxX = ((s - 1) * w.get()) / 2;
    const maxY = ((s - 1) * h.get()) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const applyView = useCallback(
    (v: { scale: number; tx: number; ty: number }) => {
      scale.set(withTiming(v.scale, { duration: 220 }));
      tx.set(withTiming(v.tx, { duration: 220 }));
      ty.set(withTiming(v.ty, { duration: 220 }));
      savedScale.set(v.scale);
      savedTx.set(v.tx);
      savedTy.set(v.ty);
    },
    [savedScale, savedTx, savedTy, scale, tx, ty]
  );

  const resetZoom = () => {
    "worklet";
    scale.set(withTiming(1));
    tx.set(withTiming(0));
    ty.set(withTiming(0));
    savedScale.set(1);
    savedTx.set(0);
    savedTy.set(0);
  };

  // Badge text + zoomed flag, pushed across only when they change.
  useAnimatedReaction(
    () => ({
      q: Math.round(scale.get() * 10) / 10,
      z: scale.get() > ZOOMED,
    }),
    (cur, prev) => {
      if (!prev) return;
      if (cur.q !== prev.q) runOnJS(setScaleText)(`${cur.q.toFixed(1)}×`);
      if (cur.z !== prev.z) runOnJS(setZoomed)(cur.z);
    }
  );

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.set(scale.get());
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    })
    .onUpdate((e) => {
      const next = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, savedScale.get() * e.scale),
      );
      scale.set(next);
      const c = clampTranslate(next, tx.get(), ty.get());
      tx.set(c.x);
      ty.set(c.y);
    })
    .onEnd(() => {
      savedScale.set(scale.get());
      savedTx.set(tx.get());
      savedTy.set(ty.get());
      if (scale.get() <= 1.02) resetZoom();
    });

  const panTwo = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onStart(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    })
    .onUpdate((e) => {
      const c = clampTranslate(
        scale.get(),
        savedTx.get() + e.translationX,
        savedTy.get() + e.translationY,
      );
      tx.set(c.x);
      ty.set(c.y);
    })
    .onEnd(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    });

  const panOne = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(2)
    .onStart(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    })
    .onUpdate((e) => {
      if (scale.get() <= 1.02) return;
      const c = clampTranslate(
        scale.get(),
        savedTx.get() + e.translationX,
        savedTy.get() + e.translationY,
      );
      tx.set(c.x);
      ty.set(c.y);
    })
    .onEnd(() => {
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      if (scale.get() > 1.05) {
        resetZoom();
      } else {
        scale.set(withTiming(2.5));
        savedScale.set(2.5);
      }
    });

  const composed = Gesture.Simultaneous(
    pinch,
    panTwo,
    Gesture.Exclusive(doubleTap, panOne),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: scale.get() },
    ],
  }));

  /**
   * Viewport rectangle inside the overview box.
   *
   * Screen x maps to content as: contentX = (screenX - w/2 - tx)/s + w/2, so the
   * left edge of what you can see sits at 0.5 - (0.5 + tx/w)/s of the frame,
   * and the visible width is exactly 1/s of it.
   */
  const mapStyle = useAnimatedStyle(() => {
    const s = scale.get();
    const safeS = s < ZOOMED ? 1 : s;
    const vw = w.get() || 1;
    const vh = h.get() || 1;
    const leftFrac = 0.5 - (0.5 + tx.get() / vw) / safeS;
    const topFrac = 0.5 - (0.5 + ty.get() / vh) / safeS;
    return {
      opacity: safeS > ZOOMED ? 1 : 0,
      transform: [
        { translateX: Math.max(0, Math.min(1 - 1 / safeS, leftFrac)) * MAP_W },
        { translateY: Math.max(0, Math.min(1 - 1 / safeS, topFrac)) * MAP_H },
      ],
      width: Math.max(3, (MAP_W / safeS)),
      height: Math.max(2, (MAP_H / safeS)),
    };
  });

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: scale.get() > ZOOMED ? 1 : 0,
  }));

  const saveCurrentView = useCallback(() => {
    const entry: SavedView = {
      id: `${Date.now()}`,
      scale: Math.round(scale.get() * 100) / 100,
      tx: Math.round(tx.get()),
      ty: Math.round(ty.get()),
    };
    setViews((prev) => [...prev, entry].slice(-6));
  }, [scale, tx, ty]);

  const chips = useMemo(
    () =>
      views.map((v) => ({
        ...v,
        onPress: () => applyView(v),
        onRemove: () => setViews((prev) => prev.filter((p) => p.id !== v.id)),
      })),
    [views, applyView]
  );

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        w.set(e.nativeEvent.layout.width);
        h.set(e.nativeEvent.layout.height);
      }}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, animatedStyle]}
        pointerEvents="none"
      >
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          // Mobile Safari: keep playback in-page — no giant play overlay /
          // accidental fullscreen from the default video chrome.
          playsInline
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
          // The gesture overlay below owns pinch/pan/double-tap, so the
          // VideoView itself must not intercept touches.
          pointerEvents="none"
        />
      </Animated.View>

      <GestureDetector gesture={composed}>
        <Animated.View style={styles.hit} collapsable={false} />
      </GestureDetector>

      {/* How far in we are. */}
      <Animated.View style={[styles.badge, badgeStyle]} pointerEvents="none">
        <Text style={styles.badgeTxt}>{scaleText}</Text>
      </Animated.View>

      {/* Where in the frame we are. */}
      <View style={styles.map} pointerEvents="none">
        <Animated.View style={[styles.mapBox, mapStyle]} />
      </View>

      {/* Snap back to a detail you liked. */}
      <View style={styles.viewBar} pointerEvents="box-none">
        <Pressable
          onPress={saveCurrentView}
          disabled={!zoomed}
          style={({ pressed }) => [
            styles.viewChip,
            !zoomed && { opacity: 0.35 },
            pressed && { opacity: 0.6 },
          ]}
          accessibilityLabel="Save this zoom view"
        >
          <Text style={styles.viewChipTxt}>+ save view</Text>
        </Pressable>
        {chips.map((c) => (
          <View key={c.id} style={styles.viewWrap}>
            <Pressable
              onPress={c.onPress}
              style={({ pressed }) => [styles.viewChip, pressed && { opacity: 0.6 }]}
              accessibilityLabel={`Go to ${c.scale}× view`}
            >
              <Text style={styles.viewChipTxt}>{c.scale.toFixed(1)}×</Text>
            </Pressable>
            <Pressable onPress={c.onRemove} hitSlop={6} style={styles.viewDel}>
              <Text style={styles.viewDelTxt}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

export const ZoomableVideo = memo(ZoomableVideoInner);

const styles = StyleSheet.create({
  wrap: { flex: 1, width: "100%", alignSelf: "stretch", overflow: "hidden" },
  video: { width: "100%", height: "100%", backgroundColor: "transparent" },
  hit: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
    // @ts-ignore — RN web: prevent browser gesture interception
    touchAction: "none",
  },
  badge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  badgeTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: Platform.OS === "ios" ? "600" : "700",
    letterSpacing: 0.3,
  },
  map: {
    position: "absolute",
    right: 10,
    top: 10,
    width: MAP_W,
    height: MAP_H,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    overflow: "hidden",
  },
  mapBox: {
    position: "absolute",
    left: 0,
    top: 0,
    borderWidth: 1.5,
    borderColor: "#f5c518",
    backgroundColor: "rgba(245,197,24,0.18)",
  },
  viewBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    flexWrap: "wrap",
  },
  viewWrap: { flexDirection: "row", alignItems: "center" },
  viewChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.62)",
    borderWidth: 1,
    borderColor: "rgba(245,197,24,0.4)",
  },
  viewChipTxt: { color: "#f5c518", fontSize: 11, letterSpacing: 0.3 },
  viewDel: { marginLeft: -3, paddingHorizontal: 2 },
  viewDelTxt: { color: "rgba(255,255,255,0.55)", fontSize: 13 },
});