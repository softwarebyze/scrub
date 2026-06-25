import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  tags: string[];
  activeTag: string | null;
  onTagChange: (t: string | null) => void;
};

export function LibrarySearch({
  search,
  onSearchChange,
  tags,
  activeTag,
  onTagChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search titles or tags"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.input}
          selectionColor="#ff3b30"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => onSearchChange("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
      </View>

      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagBar}
        >
          <TagChip
            label="All"
            active={activeTag === null}
            onPress={() => onTagChange(null)}
          />
          {tags.map((t) => (
            <TagChip
              key={t}
              label={t}
              active={activeTag === t}
              onPress={() => onTagChange(activeTag === t ? null : t)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function TagChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      hitSlop={6}
    >
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingVertical: 0,
  },
  tagBar: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipActive: {
    backgroundColor: "#ff3b30",
    borderColor: "#ff3b30",
  },
  chipTxt: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTxtActive: { color: "#fff" },
});
