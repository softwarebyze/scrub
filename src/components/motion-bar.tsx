import {
  consecutiveDiffs,
  findPeaks,
  nearestPeak,
  type DiffSample,
  type Peak,
} from "@/lib/frame-diff";
import { sampleGrayFrames } from "@/lib/sample-frames";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  uri: string;
  duration: number;
  currentTime: number;
  /** Prefer A–B range when set */
  rangeStart?: number | null;
  rangeEnd?: number | null;
  onSeek: (t: number) => void;
  onMarkTimes: (times: number[]) => void;
};

function Sparkline({
  samples,
  peaks,
  duration,
  currentTime,
  onSeek,
}: {
  samples: DiffSample[];
  peaks: Peak[];
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
}) {
  const max = useMemo(
    () => Math.max(1, ...samples.map((s) => s.score)),
    [samples],
  );
  const widthRef = useRef(1);
  if (!samples.length || !duration) {
    return (
      <View style={styles.sparkEmpty}>
        <Text style={styles.hint}>Scan to find frame changes</Text>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.spark}
      onLayout={(e) => {
        widthRef.current = Math.max(1, e.nativeEvent.layout.width);
      }}
      onPress={(e) => {
        const x = e.nativeEvent.locationX;
        onSeek(Math.max(0, Math.min(duration, (x / widthRef.current) * duration)));
      }}
    >
      {samples.map((s, i) => {
        const h = Math.max(2, Math.round((s.score / max) * 28));
        const isPeak = peaks.some((p) => p.index === i);
        return (
          <View
            key={`${s.time}-${i}`}
            style={[
              styles.bar,
              {
                height: h,
                backgroundColor: isPeak
                  ? "rgba(255,59,48,0.9)"
                  : "rgba(255,255,255,0.28)",
              },
            ]}
          />
        );
      })}
      <View
        pointerEvents="none"
        style={[
          styles.playhead,
          { left: `${Math.max(0, Math.min(1, currentTime / duration)) * 100}%` },
        ]}
      />
    </Pressable>
  );
}

export function MotionBar({
  uri,
  duration,
  currentTime,
  rangeStart,
  rangeEnd,
  onSeek,
  onMarkTimes,
}: Props) {
  const [samples, setSamples] = useState<DiffSample[]>([]);
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const cancelledRef = useRef({ current: false });
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const scan = useCallback(async () => {
    if (!uri || !duration || scanning) return;
    cancelledRef.current.current = false;
    setScanning(true);
    setProgress({ done: 0, total: 1 });
    try {
      const hasRange =
        rangeStart != null &&
        rangeEnd != null &&
        rangeEnd > rangeStart + 0.05;
      const t = currentTimeRef.current;
      const start = hasRange
        ? (rangeStart as number)
        : duration <= 8
          ? 0
          : Math.max(0, t - 3);
      const end = hasRange
        ? (rangeEnd as number)
        : duration <= 8
          ? duration
          : Math.min(duration, t + 3);

      const frames = await sampleGrayFrames(uri, duration, {
        start,
        end,
        step: 1 / 30,
        maxSamples: 240,
        cancelled: cancelledRef.current,
        onProgress: setProgress,
      });
      if (cancelledRef.current.current) return;
      const diffs = consecutiveDiffs(frames);
      const found = findPeaks(diffs, {
        k: 2.2,
        minScore: 1.2,
        minSeparation: 2 / 30,
      });
      setSamples(diffs);
      setPeaks(found);
      if (Platform.OS !== "web") Haptics.selectionAsync();
    } catch {
      setSamples([]);
      setPeaks([]);
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }, [uri, duration, rangeStart, rangeEnd, scanning]);

  useEffect(() => {
    return () => {
      cancelledRef.current.current = true;
    };
  }, []);

  const jumpPeak = useCallback(
    (dir: -1 | 1) => {
      const p = nearestPeak(peaks, currentTimeRef.current, dir);
      if (!p) return;
      onSeek(p.time);
      if (Platform.OS !== "web") Haptics.selectionAsync();
    },
    [peaks, onSeek],
  );

  const markPeaks = useCallback(() => {
    if (!peaks.length) return;
    onMarkTimes(peaks.map((p) => p.time));
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [peaks, onMarkTimes]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, scanning && styles.btnDisabled]}
          onPress={scan}
          disabled={scanning}
          hitSlop={6}
        >
          {scanning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="pulse-outline" size={16} color="#fff" />
          )}
          <Text style={styles.btnTxt}>
            {scanning
              ? progress
                ? `${progress.done}/${progress.total}`
                : "…"
              : "Scan changes"}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.iconBtn, !peaks.length && styles.btnDisabled]}
          onPress={() => jumpPeak(-1)}
          disabled={!peaks.length}
          hitSlop={8}
          accessibilityLabel="Previous change"
        >
          <Ionicons name="play-skip-back-outline" size={16} color="#fff" />
        </Pressable>
        <Pressable
          style={[styles.iconBtn, !peaks.length && styles.btnDisabled]}
          onPress={() => jumpPeak(1)}
          disabled={!peaks.length}
          hitSlop={8}
          accessibilityLabel="Next change"
        >
          <Ionicons name="play-skip-forward-outline" size={16} color="#fff" />
        </Pressable>
        <Pressable
          style={[styles.btn, !peaks.length && styles.btnDisabled]}
          onPress={markPeaks}
          disabled={!peaks.length}
          hitSlop={6}
        >
          <Ionicons name="bookmark-outline" size={14} color="#fff" />
          <Text style={styles.btnTxt}>
            Mark {peaks.length ? peaks.length : ""}
          </Text>
        </Pressable>
      </View>
      <Sparkline
        samples={samples}
        peaks={peaks}
        duration={duration}
        currentTime={currentTime}
        onSeek={onSeek}
      />
      {peaks.length > 0 && (
        <Text style={styles.meta}>
          {peaks.length} change{peaks.length === 1 ? "" : "s"} · tap sparkline to
          seek
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  btnDisabled: { opacity: 0.35 },
  btnTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    // @ts-ignore
    userSelect: "none",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  spark: {
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingBottom: 4,
    overflow: "hidden",
    position: "relative",
  },
  sparkEmpty: {
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
  },
  bar: {
    flex: 1,
    marginHorizontal: 0.5,
    borderRadius: 1,
    minWidth: 1,
  },
  playhead: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: "#ff3b30",
  },
  meta: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    textAlign: "center",
  },
});
