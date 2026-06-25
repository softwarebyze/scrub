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
    const maxX = ((s - 1) * w.value) / 2;
    const maxY = ((s - 1) * h.value) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const resetZoom = () => {
    "worklet";
    scale.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, savedScale.value * e.scale));
      scale.value = next;
      const c = clampTranslate(next, tx.value, ty.value);
      tx.value = c.x;
      ty.value = c.y;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      if (scale.value <= 1.02) resetZoom();
    });

  // Two-finger pan — always works.
  const panTwo = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      const c = clampTranslate(
        scale.value,
        savedTx.value + e.translationX,
        savedTy.value + e.translationY
      );
      tx.value = c.x;
      ty.value = c.y;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  // Single-finger pan — only active when zoomed in. Won't conflict with double-tap.
  const panOne = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(2)
    .enabled(true)
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1.02) return;
      const c = clampTranslate(
        scale.value,
        savedTx.value + e.translationX,
        savedTy.value + e.translationY
      );
      tx.value = c.x;
      ty.value = c.y;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      if (scale.value > 1.05) {
        resetZoom();
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  // Order matters: doubleTap should win over panOne for taps.
  const composed = Gesture.Simultaneous(
    pinch,
    panTwo,
    Gesture.Exclusive(doubleTap, panOne)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <View
        style={styles.wrap}
        onLayout={(e) => {
          w.value = e.nativeEvent.layout.width;
          h.value = e.nativeEvent.layout.height;
        }}
      >
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="contain"
            nativeControls={false}
            allowsPictureInPicture={false}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export const ZoomableVideo = memo(ZoomableVideoInner);

const styles = StyleSheet.create({
  wrap: { flex: 1, width: "100%", alignSelf: "stretch", overflow: "hidden" },
  video: { width: "100%", height: "100%", backgroundColor: "transparent" },
});
