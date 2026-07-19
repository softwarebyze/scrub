import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  inPoint: number | null;
  outPoint: number | null;
  looping: boolean;
  muted: boolean;
  onSetIn: () => void;
  onSetOut: () => void;
  onToggleLoop: () => void;
  onClear: () => void;
  onToggleMute: () => void;
};

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t - Math.floor(t)) * 1000);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export function LoopBar({
  inPoint,
  outPoint,
  looping,
  muted,
  onSetIn,
  onSetOut,
  onToggleLoop,
  onClear,
  onToggleMute,
}: Props) {
  const ready = inPoint != null && outPoint != null && outPoint > inPoint + 0.05;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.chip, inPoint != null && styles.chipSet]}
        onPress={onSetIn}
        hitSlop={8}
      >
        <Text style={[styles.chipLabel, inPoint != null && styles.chipLabelSet]}>
          In{inPoint != null ? ` ${fmt(inPoint)}` : ""}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.chip, outPoint != null && styles.chipSet]}
        onPress={onSetOut}
        hitSlop={8}
      >
        <Text style={[styles.chipLabel, outPoint != null && styles.chipLabelSet]}>
          Out{outPoint != null ? ` ${fmt(outPoint)}` : ""}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.iconBtn, looping && ready && styles.iconBtnActive]}
        onPress={onToggleLoop}
        disabled={!ready}
        hitSlop={8}
      >
        <Ionicons
          name="repeat"
          size={16}
          color={looping && ready ? "#000" : ready ? "#fff" : "rgba(255,255,255,0.35)"}
        />
      </Pressable>
      <Pressable
        style={[styles.iconBtn, (inPoint != null || outPoint != null) && styles.iconBtnDim]}
        onPress={onClear}
        disabled={inPoint == null && outPoint == null}
        hitSlop={8}
      >
        <Ionicons
          name="close"
          size={15}
          color={inPoint == null && outPoint == null ? "rgba(255,255,255,0.35)" : "#fff"}
        />
      </Pressable>
      <View style={styles.spacer} />
      <Pressable
        style={[styles.iconBtn, muted && styles.iconBtnActive]}
        onPress={onToggleMute}
        hitSlop={8}
      >
        <Ionicons
          name={muted ? "volume-mute" : "volume-medium"}
          size={16}
          color={muted ? "#000" : "#fff"}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  chipSet: {
    backgroundColor: "rgba(96,165,250,0.2)",
    borderColor: "rgba(96,165,250,0.45)",
  },
  chipLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  chipLabelSet: { color: "#93c5fd" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: "#93c5fd" },
  iconBtnDim: { backgroundColor: "rgba(255,255,255,0.12)" },
  spacer: { flex: 1 },
});
