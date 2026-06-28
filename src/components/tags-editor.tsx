import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  tags: string[];
  onChange: (next: string[]) => void;
};

export function TagsEditor({ tags, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const commit = useCallback(() => {
    const v = draft.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setDraft("");
      return;
    }
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onChange([...tags, v].slice(0, 16));
    setDraft("");
  }, [draft, tags, onChange]);

  const removeAt = useCallback(
    (label: string) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(tags.filter((t) => t !== label));
    },
    [tags, onChange]
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconPill}>
          <Ionicons name="pricetag-outline" size={13} color="rgba(255,255,255,0.55)" />
        </View>
        {tags.map((t) => (
          <Pressable
            key={t}
            onPress={() => removeAt(t)}
            style={styles.tagPill}
            hitSlop={4}
          >
            <Text style={styles.tagTxt}>{t}</Text>
            <Ionicons name="close" size={12} color="#ff8a82" />
          </Pressable>
        ))}
        <View style={[styles.inputPill, focused && styles.inputPillFocused]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            onEndEditing={commit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={tags.length === 0 ? "Add a label…" : "+"}
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            blurOnSubmit={false}
            selectionColor="#ff3b30"
            maxLength={24}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  iconPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,59,48,0.15)",
  },
  tagTxt: { color: "#ff8a82", fontSize: 12, fontWeight: "600" },
  inputPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minWidth: 80,
  },
  inputPillFocused: { borderColor: "rgba(255,59,48,0.5)" },
  input: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 2,
    minWidth: 60,
  },
});
