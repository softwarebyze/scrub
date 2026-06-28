import { useEffect, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

type Props = { value: string; onChange: (v: string) => void };

export function TitleEditor({ value, onChange }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <View style={styles.wrap}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onEndEditing={() => onChange(draft)}
        onSubmitEditing={() => onChange(draft)}
        placeholder="Untitled"
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={styles.input}
        selectionColor="#ff3b30"
        returnKeyType="done"
        numberOfLines={1}
        maxLength={120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center" },
  input: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: "100%",
  },
});
