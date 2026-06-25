import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const PRESETS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 2, 3, 5, 10];

type Props = {
  speed: number;
  onChange: (s: number) => void;
};

export function SpeedBar({ speed, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const isPreset = PRESETS.includes(speed);

  const submitCustom = () => {
    const n = parseFloat(customInput);
    if (isFinite(n) && n > 0 && n <= 32) {
      onChange(n);
      setCustomOpen(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {PRESETS.map((p) => {
          const active = p === speed;
          return (
            <Pressable
              key={p}
              onPress={() => onChange(p)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {p}×
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setCustomInput(isPreset ? "" : String(speed));
            setCustomOpen(true);
          }}
          style={[styles.pill, !isPreset && styles.pillActive]}
        >
          <Ionicons
            name="create-outline"
            size={12}
            color={!isPreset ? "#000" : "#fff"}
          />
          <Text style={[styles.pillText, !isPreset && styles.pillTextActive]}>
            {isPreset ? "custom" : `${speed}×`}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={customOpen}
        onRequestClose={() => setCustomOpen(false)}
      >
        <Pressable style={styles.modalBg} onPress={() => setCustomOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>custom speed</Text>
            <TextInput
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="e.g. 0.15"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="decimal-pad"
              style={styles.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitCustom}
              blurOnSubmit={false}
            />
            <View style={styles.modalRow}>
              <Pressable
                style={styles.modalBtn}
                onPress={() => setCustomOpen(false)}
              >
                <Text style={styles.modalBtnText}>cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={submitCustom}
              >
                <Text style={[styles.modalBtnText, { color: "#000" }]}>set</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  row: { gap: 6, paddingHorizontal: 16, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pillActive: { backgroundColor: "#fff" },
  pillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    // @ts-ignore
    userSelect: "none",
  },
  pillTextActive: { color: "#000" },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#181818",
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  modalRow: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalBtnPrimary: { backgroundColor: "#fff" },
  modalBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
