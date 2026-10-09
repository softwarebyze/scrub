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

export type LibraryDensity = "compact" | "comfortable";

type Props = {
  items: VideoRecord[];
  density: LibraryDensity;
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

export function LibraryList({ items, density, onOpen, onRefresh }: Props) {
  const compact = density === "compact";
  const renderItem = useCallback(
    ({ item }: { item: VideoRecord }) => (
      <Row
        item={item}
        compact={compact}
        onOpen={onOpen}
        onRefresh={onRefresh}
      />
    ),
    [compact, onOpen, onRefresh],
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      renderItem={renderItem}
      contentContainerStyle={[styles.list, compact && styles.listCompact]}
      removeClippedSubviews
      windowSize={9}
      maxToRenderPerBatch={12}
      initialNumToRender={10}
    />
  );
}

const Row = memo(function Row({
  item,
  compact,
  onOpen,
  onRefresh,
}: {
  item: VideoRecord;
  compact: boolean;
  onOpen: (r: VideoRecord) => void;
  onRefresh: () => void;
}) {
  const progress =
    item.duration > 0
      ? Math.max(0, Math.min(1, item.lastTime / item.duration))
      : 0;

  const onLongPress = useCallback(() => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const meta = [
    relativeAge(item.lastOpenedAt),
    item.duration > 0 ? fmtTime(item.duration) : null,
    item.markers.length > 0
      ? `${item.markers.length} marker${item.markers.length === 1 ? "" : "s"}`
      : null,
    compact && item.tags.length > 0 ? item.tags.slice(0, 2).join(" · ") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => onOpen(item)}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        pressed && { opacity: 0.7, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={[styles.thumb, compact && styles.thumbCompact]}>
        <Ionicons
          name="film"
          size={compact ? 18 : 26}
          color="rgba(255,255,255,0.5)"
        />
        {progress > 0 && (
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
        )}
      </View>
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
          {item.title || "Untitled"}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
        {!compact && item.tags.length > 0 && (
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
      <View style={styles.rowActions}>
        {/* Long-press still works, but delete was previously reachable only that
            way, which made it undiscoverable. */}
        <Pressable
          onPress={onLongPress}
          hitSlop={10}
          accessibilityLabel={`Remove ${item.title || "video"} from library`}
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.45)" />
        </Pressable>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 24, gap: 8 },
  listCompact: { gap: 4 },
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
  rowCompact: {
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
  thumbCompact: { width: 40, height: 40, borderRadius: 8 },
  progressTrack: {
    position: "absolute",
    left: 4,
    right: 4,
    bottom: 4,
    height: 2,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  progressFill: { height: "100%", backgroundColor: "#ff3b30", borderRadius: 2 },
  body: { flex: 1, gap: 4 },
  bodyCompact: { gap: 1 },
  title: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  titleCompact: { fontSize: 14, fontWeight: "600" },
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
