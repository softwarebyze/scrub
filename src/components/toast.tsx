import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type ToastHandle = { show: (msg: string) => void };

// Lightweight, non-blocking, auto-dismissing pill. Designed to be triggered
// imperatively via a ref so callers don't need a context provider.
export const Toast = forwardRef<ToastHandle, {}>(function Toast(_props, ref) {
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const offset = useSharedValue(8);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    show(next: string) {
      setMsg(next);
      cancelAnimation(opacity);
      cancelAnimation(offset);
      opacity.value = withTiming(1, { duration: 110 });
      offset.value = withTiming(0, { duration: 160 });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 220 });
        offset.value = withTiming(6, { duration: 220 });
      }, 1100);
    },
  }));

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));

  if (!msg) return null;

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={[styles.pill, animStyle]}>
        <Text style={styles.txt}>{msg}</Text>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 70,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(20,20,20,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  txt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
    // @ts-ignore
    userSelect: "none",
  },
});
