import { deleteVideo, type VideoRecord } from "@/db/library";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { memo, useCallback } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  items: VideoRecord[];
  onOpen: (rec: VideoRecord) => void;
  onRefresh: () => void;
};

function fmtTime(s: number) {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function relativeAge(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(ts).toLocaleDateString();
}

export function LibraryList({ items, onOpen, onRefresh }: Props) {
  const renderItem = useCallback(
    ({ item }: { item: VideoRecord }) => (
      <Row item={item} onOpen={onOpen} onRefresh={onRefresh} />
    ),
    [onOpen, onRefresh]
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      removeClippedSubviews
      windowSize={9}
      maxToRenderPerBatch={12}
      initialNumToRender={10}
    />
  );
}

const Row = memo(function Row({
  item,
  onOpen,
  onRefresh,
}: {
  item: VideoRecord;
  onOpen: (r: VideoRecord) => void;
  onRefresh: () => void;
}) {
  const progress =
    item.duration > 0 ? Math.max(0, Math.min(1, item.lastTime / item.duration)) : 0;

  const onLongPress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const doDelete = async () => {
      await deleteVideo(item.id);
      onRefresh();
    };
    if (Platform.OS === "web") {
      if (confirm(`Remove "${item.title}" from your library?`)) doDelete();
      return;
    }
    Alert.alert("Remove video", `Remove "${item.title}" from your library?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: doDelete },
    ]);
  }, [item, onRefresh]);

  return (
    <Pressable
      onPress={() => onOpen(item)}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={styles.thumb}>
        <Ionicons name="film" size={26} color="rgba(255,255,255,0.5)" />
        {progress > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title || "Untitled"}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {relativeAge(item.lastOpenedAt)}
            {item.duration > 0 && ` · ${fmtTime(item.duration)}`}
            {item.markers.length > 0 &&
              ` · ${item.markers.length} marker${item.markers.length === 1 ? "" : "s"}`}
          </Text>
        </View>
        {item.tags.length > 0 && (
          <View style={styles.tagRow}>
            {item.tags.slice(0, 4).map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagTxt}>{t}</Text>
              </View>
            ))}
            {item.tags.length > 4 && (
              <Text style={styles.tagMore}>+{item.tags.length - 4}</Text>
            )}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 24, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  progressTrack: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  progressFill: { height: "100%", backgroundColor: "#ff3b30", borderRadius: 2 },
  body: { flex: 1, gap: 4 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  metaRow: { flexDirection: "row" },
  meta: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,59,48,0.15)",
  },
  tagTxt: { color: "#ff8a82", fontSize: 11, fontWeight: "600" },
  tagMore: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "600",
    alignSelf: "center",
  },
});
