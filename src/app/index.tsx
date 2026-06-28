import { MarkersBar } from "@/components/markers-bar";
import { Scrubber } from "@/components/scrubber";
import { SourceChip } from "@/components/source-chip";
import { SpeedBar } from "@/components/speed-bar";
import { ThumbStrip } from "@/components/thumb-strip";
import { Timeline } from "@/components/timeline";
import { ZoomableVideo } from "@/components/zoomable-video";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useVideoPlayer } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FRAME = 1 / 30;

export default function Index() {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [markers, setMarkers] = useState<number[]>([]);
  const wasPlayingRef = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.03;
  });

  useEffect(() => {
    if (!uri) return;
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") {
        setDuration(player.duration || 0);
        player.playbackRate = speed;
      }
    });
    return () => sub.remove();
  }, [uri, player, speed]);

  useEffect(() => {
    if (!uri) return;
    try {
      player.playbackRate = speed;
    } catch {}
  }, [speed, player, uri]);

  useEffect(() => {
    if (!uri) return;
    const sub = player.addListener("timeUpdate", ({ currentTime: t }) => {
      setCurrentTime(t);
    });
    return () => sub.remove();
  }, [uri, player]);

  const loadUri = useCallback((u: string) => {
    setLoading(true);
    setDuration(0);
    setCurrentTime(0);
    setMarkers([]);
    setUri(u);
    setTimeout(() => setLoading(false), 400);
  }, []);

  const handleIncomingUrl = useCallback(
    (u: string) => {
      if (!u) return;
      if (u.startsWith("file://") || u.startsWith("content://")) {
        loadUri(u);
        return;
      }
      if (u.startsWith("http")) {
        if (/\.(mp4|mov|m4v|webm|mkv|avi|hls|m3u8)(\?|$)/i.test(u)) {
          loadUri(u);
        }
      }
    },
    [loadUri]
  );

  useEffect(() => {
    // On web, getInitialURL returns the current page URL — don't treat that as a video.
    if (Platform.OS !== "web") {
      Linking.getInitialURL().then((u) => {
        if (u) handleIncomingUrl(u);
      });
    }
    const sub = Linking.addEventListener("url", ({ url }) => handleIncomingUrl(url));
    return () => sub.remove();
  }, [handleIncomingUrl]);

  // Web-only: drag a video file onto the window to import it.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
      }
    };
    const onDrop = (e: DragEvent) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      if (!f.type.startsWith("video/")) return;
      e.preventDefault();
      const url = URL.createObjectURL(f);
      loadUri(url);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [loadUri]);

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
    if (!res.canceled && res.assets[0]) loadUri(res.assets[0].uri);
  }, [loadUri]);

  const pickFromFiles = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!res.canceled && res.assets[0]) loadUri(res.assets[0].uri);
  }, [loadUri]);

  const onScrubStart = useCallback(() => {
    wasPlayingRef.current = player.playing;
    player.pause();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [player]);

  const onScrub = useCallback(
    (t: number) => {
      player.currentTime = t;
      setCurrentTime(t);
    },
    [player]
  );

  const onScrubEnd = useCallback(() => {
    if (wasPlayingRef.current) player.play();
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [player]);

  const togglePlay = useCallback(() => {
    if (player.playing) player.pause();
    else player.play();
  }, [player]);

  const stepFrame = useCallback(
    (dir: 1 | -1) => {
      player.pause();
      const t = Math.max(0, Math.min(duration, player.currentTime + dir * FRAME));
      player.currentTime = t;
      setCurrentTime(t);
      if (Platform.OS !== "web") Haptics.selectionAsync();
    },
    [player, duration]
  );

  const reset = useCallback(() => {
    setUri(null);
    setDuration(0);
    setCurrentTime(0);
    setMarkers([]);
  }, []);

  const addMarker = useCallback(() => {
    setMarkers((prev) => {
      const t = currentTime;
      if (prev.some((m) => Math.abs(m - t) < 0.01)) return prev;
      const next = [...prev, t].sort((a, b) => a - b);
      return next;
    });
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentTime]);

  const jumpToMarker = useCallback(
    (t: number) => {
      player.currentTime = t;
      setCurrentTime(t);
      if (Platform.OS !== "web") Haptics.selectionAsync();
    },
    [player]
  );

  const removeMarker = useCallback((t: number) => {
    setMarkers((prev) => prev.filter((m) => Math.abs(m - t) > 0.001));
  }, []);

  const clearAllMarkers = useCallback(() => {
    setMarkers([]);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const prevMarker = useCallback(() => {
    const cands = markers.filter((m) => m < currentTime - 0.05);
    if (!cands.length) return;
    jumpToMarker(cands[cands.length - 1]);
  }, [markers, currentTime, jumpToMarker]);

  const nextMarker = useCallback(() => {
    const cand = markers.find((m) => m > currentTime + 0.05);
    if (cand === undefined) return;
    jumpToMarker(cand);
  }, [markers, currentTime, jumpToMarker]);

  const sortedMarkers = useMemo(() => [...markers].sort((a, b) => a - b), [markers]);

  if (!uri) {
    return <ImportScreen onLibrary={pickFromLibrary} onFiles={pickFromFiles} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
     <View style={styles.editorContainer}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={reset} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.topTitle}>Scrub</Text>
        <Pressable style={styles.iconBtn} onPress={pickFromLibrary} hitSlop={12}>
          <Ionicons name="videocam-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      <Timeline
        duration={duration}
        currentTime={currentTime}
        markers={sortedMarkers}
      />

      <View style={styles.videoWrap}>
        <ZoomableVideo player={player} />
        {loading && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        <View style={styles.sourceOverlay} pointerEvents="box-none">
          <SourceChip uri={uri} />
        </View>
      </View>

      <ThumbStrip
        uri={uri}
        player={player}
        duration={duration}
        currentTime={currentTime}
        onSeek={jumpToMarker}
      />

      <SpeedBar speed={speed} onChange={setSpeed} />

      <MarkersBar
        markers={sortedMarkers}
        currentTime={currentTime}
        onAdd={addMarker}
        onJump={jumpToMarker}
        onRemove={removeMarker}
        onPrev={prevMarker}
        onNext={nextMarker}
        onClearAll={clearAllMarkers}
      />

      <View style={styles.controls}>
        <Pressable style={styles.frameBtn} onPress={() => stepFrame(-1)} hitSlop={10}>
          <Ionicons name="play-back" size={22} color="#fff" />
          <Text style={styles.frameTxt}>frame</Text>
        </Pressable>
        <Pressable style={styles.playBtn} onPress={togglePlay} hitSlop={10}>
          <Ionicons
            name={player.playing ? "pause" : "play"}
            size={30}
            color="#000"
            style={!player.playing && { marginLeft: 4 }}
          />
        </Pressable>
        <Pressable style={styles.frameBtn} onPress={() => stepFrame(1)} hitSlop={10}>
          <Text style={styles.frameTxt}>frame</Text>
          <Ionicons name="play-forward" size={22} color="#fff" />
        </Pressable>
      </View>

      <Scrubber
        duration={duration}
        currentTime={currentTime}
        onScrub={onScrub}
        onScrubStart={onScrubStart}
        onScrubEnd={onScrubEnd}
      />
     </View>
    </SafeAreaView>
  );
}

function ImportScreen({
  onLibrary,
  onFiles,
}: {
  onLibrary: () => void;
  onFiles: () => void;
}) {
  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.importOuter}>
        <View style={styles.importInner}>
          <View style={styles.brandWrap}>
            <BrandMark />
            <Text style={styles.brand}>Scrub</Text>
            <Text style={styles.tagline}>
              import a video. drag the knob. frame-perfect or buttery smooth.
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <BigButton
              icon="videocam"
              label="Pick from Photos"
              subtitle="your video library"
              onPress={onLibrary}
              primary
            />
            <BigButton
              icon="cloud-upload-outline"
              label="Open from Files"
              subtitle="any file on your device or cloud"
              onPress={onFiles}
            />
            <View style={styles.hintCard}>
              <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.45)" />
              <Text style={styles.hintTxt}>
                {Platform.OS === "ios"
                  ? "Or: Photos → Share → “Copy to Scrub”"
                  : Platform.OS === "android"
                  ? "Or: share a video from any app → Scrub"
                  : "Or: drag a video file into the window"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function BrandMark() {
  // Film-strip frames stacked behind a scrubber track + chunky thumb.
  // Reads as "video" + "precise scrubbing" at a glance.
  return (
    <View style={styles.brandMark}>
      <View style={styles.brandGlow} pointerEvents="none" />
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
          style={[
            styles.bigBtnSubtitle,
            primary && { color: "rgba(0,0,0,0.6)" },
          ]}
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
  editorContainer: {
    flex: 1,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
    // @ts-ignore
    userSelect: "none",
  },
  videoWrap: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  sourceOverlay: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  loader: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 4,
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  frameBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  frameTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    // @ts-ignore — web-only, prevents text selection on click
    userSelect: "none",
  },

  importOuter: {
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  importInner: {
    width: "100%",
    maxWidth: 460,
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 24,
  },
  brandWrap: { alignItems: "center", marginTop: 20, gap: 16 },
  brandMark: {
    width: 220,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  brandGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#ff3b30",
    opacity: 0.1,
    top: -110,
    // @ts-ignore — web only, no-op on native
    filter: "blur(40px)",
  },
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
  brandThumbInner: {
    width: 3,
    height: 18,
    borderRadius: 1.5,
    backgroundColor: "#ff3b30",
  },
  brand: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  tagline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
    marginTop: -8,
  },
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
