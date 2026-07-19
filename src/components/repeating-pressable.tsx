import { useCallback, useEffect, useRef } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Props = Omit<PressableProps, "onPress" | "style"> & {
  onPress: () => void;
  // Delay before auto-repeat kicks in (ms).
  initialDelay?: number;
  // Repeat interval after the initial delay (ms).
  interval?: number;
  // Minimum interval — repeat accelerates down to this floor.
  minInterval?: number;
  // Every N repeats, interval shrinks by `accelerationStep`.
  accelerationStep?: number;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

// Hold-to-repeat press. Fires onPress once immediately, then again after
// `initialDelay`, then at `interval` accelerating to `minInterval`. Stops on
// pressOut / cancel / unmount.
export function RepeatingPressable({
  onPress,
  initialDelay = 320,
  interval = 90,
  minInterval = 40,
  accelerationStep = 6,
  ...rest
}: Props) {
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAll = useCallback(() => {
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearAll, [clearAll]);

  const beginRepeat = useCallback(() => {
    let count = 0;
    let cur = interval;
    const tick = () => {
      onPressRef.current();
      count += 1;
      if (count % accelerationStep === 0) {
        cur = Math.max(minInterval, cur - 10);
      }
      intervalRef.current = setTimeout(tick, cur);
    };
    intervalRef.current = setTimeout(tick, cur);
  }, [interval, minInterval, accelerationStep]);

  const onPressIn = useCallback(() => {
    onPressRef.current();
    startTimeoutRef.current = setTimeout(beginRepeat, initialDelay);
  }, [beginRepeat, initialDelay]);

  const onPressOut = useCallback(() => {
    clearAll();
  }, [clearAll]);

  return <Pressable {...rest} onPressIn={onPressIn} onPressOut={onPressOut} />;
}
