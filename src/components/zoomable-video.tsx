import { VideoPlayer, VideoView } from "expo-video";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  player: VideoPlayer;
};

const MIN_SCALE = 1;
const MAX_SCALE = 8;

/**
 * Pinch / pan / double-tap zoom over expo-video.
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

  const clampTranslate = (s: number, x: number, y: number) => {
    "worklet";
    const maxX = ((s - 1) * w.get()) / 2;
    const maxY = ((s - 1) * h.get()) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const resetZoom = () => {
    "worklet";
    scale.set(withTiming(1));
    tx.set(withTiming(0));
    ty.set(withTiming(0));
    savedScale.set(1);
    savedTx.set(0);
    savedTy.set(0);
  };

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
        <Animated.View
          style={styles.hit}
          collapsable={false}
        />
      </GestureDetector>
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
});
