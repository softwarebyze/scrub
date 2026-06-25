import { LibraryList } from "@/components/library-list";
import { LibrarySearch } from "@/components/library-search";
import {
  addVideo,
  listAllTags,
  listVideos,
  type VideoRecord,
  type VideoSourceKind,
} from "@/db/library";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Library() {
  const [items, setItems] = useState<VideoRecord[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [list, tags] = await Promise.all([
      listVideos({ search, tag: activeTag ?? undefined }),
      listAllTags(),
    ]);
    setItems(list);
    setAllTags(tags);
    setReady(true);
  }, [search, activeTag]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openVideo = useCallback(async (uri: string, source: VideoSourceKind) => {
    const rec = await addVideo({ uri, source });
    router.push({ pathname: "/play/[id]", params: { id: rec.id } });
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      videoQuality: 1,
      allowsMultipleSelection: false,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (!res.canceled && res.assets[0]) openVideo(res.assets[0].uri, "photos");
  }, [openVideo]);

  const pickFromFiles = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!res.canceled && res.assets[0]) openVideo(res.assets[0].uri, "files");
  }, [openVideo]);

  const handleIncomingUrl = useCallback(
    (u: string) => {
      if (!u) return;
      if (u.startsWith("file://") || u.startsWith("content://")) {
        openVideo(u, "shared");
        return;
      }
      if (u.startsWith("http")) {
        if (/\.(mp4|mov|m4v|webm|mkv|avi|hls|m3u8)(\?|$)/i.test(u)) {
          openVideo(u, "url");
        }
      }
    },
    [openVideo]
  );

  useEffect(() => {
    if (Platform.OS !== "web") {
      Linking.getInitialURL().then((u) => {
        if (u) handleIncomingUrl(u);
      });
    }
    const sub = Linking.addEventListener("url", ({ url }) => handleIncomingUrl(url));
    return () => sub.remove();
  }, [handleIncomingUrl]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f || !f.type.startsWith("video/")) return;
      e.preventDefault();
      openVideo(URL.createObjectURL(f), "drop");
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [openVideo]);

  const hasAny = items.length > 0 || search.length > 0 || activeTag !== null;

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>Scrub</Text>
            <Text style={styles.subtitle}>
              {items.length === 0 && !search && !activeTag
                ? "Frame-perfect scrubbing for any video"
                : `${items.length} ${items.length === 1 ? "video" : "videos"}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.headerBtn} onPress={pickFromFiles} hitSlop={10}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            </Pressable>
            <Pressable
              style={[styles.headerBtn, styles.headerBtnPrimary]}
              onPress={pickFromLibrary}
              hitSlop={10}
            >
              <Ionicons name="add" size={22} color="#000" />
            </Pressable>
          </View>
        </View>

        {hasAny && (
          <LibrarySearch
            search={search}
            onSearchChange={setSearch}
            tags={allTags}
            activeTag={activeTag}
            onTagChange={setActiveTag}
          />
        )}
      </View>

      {!ready ? (
        <View style={{ flex: 1 }} />
      ) : items.length === 0 ? (
        <EmptyState
          searching={Boolean(search || activeTag)}
          onLibrary={pickFromLibrary}
          onFiles={pickFromFiles}
        />
      ) : (
        <LibraryList
          items={items}
          onOpen={(rec) =>
            router.push({ pathname: "/play/[id]", params: { id: rec.id } })
          }
          onRefresh={refresh}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({
  searching,
  onLibrary,
  onFiles,
}: {
  searching: boolean;
  onLibrary: () => void;
  onFiles: () => void;
}) {
  if (searching) {
    return (
      <View style={styles.emptySearching}>
        <Ionicons name="search" size={28} color="rgba(255,255,255,0.3)" />
        <Text style={styles.emptyText}>No videos match.</Text>
      </View>
    );
  }
  return (
    <View style={styles.emptyOuter}>
      <View style={styles.emptyInner}>
        <BrandMark />
        <Text style={styles.emptyTagline}>
          Scrub any video down to a single frame. Drag, fling, mark.
        </Text>
        <View style={{ gap: 10, width: "100%" }}>
          <BigButton
            icon="videocam"
            label="Pick from Photos"
            subtitle="Recent recordings and saved clips"
            onPress={onLibrary}
            primary
          />
          <BigButton
            icon="cloud-upload-outline"
            label="Open from Files"
            subtitle="On-device, iCloud, or Drive"
            onPress={onFiles}
          />
          <View style={styles.hintCard}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="rgba(255,255,255,0.45)"
            />
            <Text style={styles.hintTxt}>
              {Platform.OS === "ios"
                ? "Tip: Photos → Share → “Copy to Scrub”"
                : Platform.OS === "android"
                ? "Tip: share a video from any app to Scrub"
                : "Tip: drag a video file anywhere on the window"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function BrandMark() {
  return (
    <View style={styles.brandMark}>
      <View style={styles.brandGlowGroup} pointerEvents="none">
        <View style={[styles.brandGlowRing, styles.brandGlowOuter]} />
        <View style={[styles.brandGlowRing, styles.brandGlowMid]} />
        <View style={[styles.brandGlowRing, styles.brandGlowInner]} />
      </View>
      <View style={styles.brandFilmStrip}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={styles.brandFrame} />
        ))}
      </View>
      <View style={styles.brandTrack} />
      <View style={styles.brandThumb}>
        <View style={styles.brandThumbInner} />
      </View>
    </View>
  );
}

function BigButton({
  icon,
  label,
  subtitle,
  onPress,
  primary,
}: {
  icon: any;
  label: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.bigBtn,
        primary && styles.bigBtnPrimary,
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View
        style={[
          styles.bigBtnIcon,
          { backgroundColor: primary ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)" },
        ]}
      >
        <Ionicons name={icon} size={22} color={primary ? "#000" : "#fff"} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bigBtnLabel, primary && { color: "#000" }]}>{label}</Text>
        <Text
          style={[styles.bigBtnSubtitle, primary && { color: "rgba(0,0,0,0.6)" }]}
        >
          {subtitle}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={primary ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)"}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6, gap: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -1 },
  subtitle: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnPrimary: { backgroundColor: "#fff" },

  emptySearching: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyText: { color: "rgba(255,255,255,0.55)", fontSize: 14 },
  emptyOuter: {
    flex: 1,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyInner: {
    width: "100%",
    maxWidth: 460,
    alignItems: "center",
    gap: 18,
  },
  emptyTagline: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  brandMark: { width: 220, height: 96, alignItems: "center", justifyContent: "center" },
  brandGlowGroup: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    top: -90,
  },
  brandGlowRing: { position: "absolute", backgroundColor: "#ff3b30" },
  brandGlowOuter: { width: 340, height: 340, borderRadius: 170, opacity: 0.05 },
  brandGlowMid: { width: 240, height: 240, borderRadius: 120, opacity: 0.08 },
  brandGlowInner: { width: 140, height: 140, borderRadius: 70, opacity: 0.14 },
  brandFilmStrip: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  brandFrame: {
    width: 32,
    height: 44,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  brandTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#ff3b30",
    shadowColor: "#ff3b30",
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  brandThumb: {
    position: "absolute",
    left: "62%",
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fff",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
  },
  brandThumbInner: { width: 3, height: 18, borderRadius: 1.5, backgroundColor: "#ff3b30" },

  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  bigBtnPrimary: { backgroundColor: "#fff", borderColor: "transparent" },
  bigBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bigBtnLabel: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  bigBtnSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 },
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  hintTxt: { color: "rgba(255,255,255,0.5)", fontSize: 12, flex: 1, lineHeight: 16 },
});
