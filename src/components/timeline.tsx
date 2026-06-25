import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  duration: number;
  currentTime: number;
  markers: number[];
};

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Display-only top timeline. Shows full video length, current position, and markers.
// Intentionally non-interactive — tapping won't jump and lose your place.
function TimelineInner({ duration, currentTime, markers }: Props) {
  const pct = useMemo(() => {
    if (!duration) return 0;
    return Math.max(0, Math.min(1, currentTime / duration)) * 100;
  }, [currentTime, duration]);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{fmt(currentTime)}</Text>
        <Text style={styles.labelDim}>{fmt(duration)}</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.progress, { width: `${pct}%` }]} />
        {markers.map((m, i) => {
          if (!duration) return null;
          const left = (m / duration) * 100;
          return (
            <View
              key={`${m}-${i}`}
              style={[styles.marker, { left: `${left}%` }]}
            />
          );
        })}
        <View style={[styles.playhead, { left: `${pct}%` }]} />
      </View>
    </View>
  );
}

export const Timeline = memo(TimelineInner);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    color: "#fff",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    // @ts-ignore
    userSelect: "none",
  },
  labelDim: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    // @ts-ignore
    userSelect: "none",
  },
  bar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "visible",
    justifyContent: "center",
  },
  progress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,59,48,0.55)",
    borderRadius: 3,
  },
  playhead: {
    position: "absolute",
    width: 3,
    height: 14,
    backgroundColor: "#ff3b30",
    borderRadius: 2,
    marginLeft: -1.5,
    top: -4,
    shadowColor: "#ff3b30",
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  marker: {
    position: "absolute",
    width: 2,
    height: 10,
    backgroundColor: "#facc15",
    marginLeft: -1,
    top: -2,
    borderRadius: 1,
  },
});
