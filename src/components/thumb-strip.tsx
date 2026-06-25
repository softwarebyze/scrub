import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { VideoPlayer } from "expo-video";
import { memo, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Thumb = { time: number; src: any };

type Props = {
  uri: string | null;
  player: VideoPlayer;
  duration: number;
  currentTime: number;
  markers: number[];
  onSeek: (t: number) => void;
  onAddMarkerAt: (t: number) => void;
};

const COUNT = 40;
const W = 72;
const H = 48;
const GAP = 4;
const MAX_W = 144;

async function extractWebThumbs(
  uri: string,
  times: number[],
  onProgress: (idx: number, src: string) => void,
  cancelled: { current: boolean }
) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = uri;
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onErr);
      resolve();
    };
    const onErr = () => {
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onErr);
      reject(new Error("video failed"));
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onErr);
  });

  const ratio = video.videoWidth / Math.max(1, video.videoHeight);
  const cw = Math.min(MAX_W, video.videoWidth || MAX_W);
  const ch = Math.round(cw / Math.max(0.01, ratio));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (let i = 0; i < times.length; i++) {
    if (cancelled.current) return;
    const t = times[i];
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
      try {
        video.currentTime = Math.min(t, video.duration - 0.001);
      } catch {
        resolve();
      }
    });
    if (cancelled.current) return;
    try {
      ctx.drawImage(video, 0, 0, cw, ch);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
      onProgress(i, dataUrl);
    } catch {}
  }
}

function tap() {
  if (Platform.OS !== "web") Haptics.selectionAsync();
}
function pop() {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

function ThumbStripInner({
  uri,
  player,
  duration,
  currentTime,
  markers,
  onSeek,
  onAddMarkerAt,
}: Props) {
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cancelledRef = useRef({ current: false });
  // Suppress auto-scroll only while the user is actively dragging the strip,
  // not on every tap. Reset on drag end so taps don't get penalized.
  const userDraggingRef = useRef(false);

  useEffect(() => {
    cancelledRef.current.current = true;
    cancelledRef.current = { current: false };
    setThumbs([]);
    if (!uri || !duration || duration < 0.05) return;
    setLoading(true);

    const times: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      times.push((duration * i) / (COUNT - 1));
    }
    const results: Thumb[] = new Array(COUNT);
    const cancelToken = cancelledRef.current;

    const flush = (idx: number) => {
      if (cancelToken.current) return;
      if (idx % 4 === 0 || idx === COUNT - 1) {
        setThumbs(results.filter(Boolean));
      }
    };

    const run = async () => {
      if (Platform.OS === "web") {
        await extractWebThumbs(
          uri,
          times,
          (idx, src) => {
            results[idx] = { time: times[idx], src: { uri: src } };
            flush(idx);
          },
          cancelToken
        );
      } else {
        try {
          const out = await player.generateThumbnailsAsync(times, {
            maxWidth: MAX_W,
          });
          if (cancelToken.current) return;
          for (let i = 0; i < out.length; i++) {
            results[i] = { time: times[i], src: out[i] };
          }
        } catch {}
      }
      if (!cancelToken.current) {
        setThumbs(results.filter(Boolean));
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelToken.current = true;
    };
  }, [uri, duration, player]);

  const activeIdx = duration
    ? Math.min(
        COUNT - 1,
        Math.max(0, Math.round((currentTime / duration) * (COUNT - 1)))
      )
    : 0;

  useEffect(() => {
    if (userDraggingRef.current) return;
    const id = requestAnimationFrame(() => {
      const target = Math.max(0, activeIdx * (W + GAP) - 120);
      scrollRef.current?.scrollTo({ x: target, animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [activeIdx]);

  const handleSeek = (t: number) => {
    tap();
    onSeek(t);
  };

  const handleLongPress = (t: number) => {
    pop();
    onAddMarkerAt(t);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onScrollBeginDrag={() => {
          userDraggingRef.current = true;
        }}
        onScrollEndDrag={() => {
          userDraggingRef.current = false;
        }}
        onMomentumScrollEnd={() => {
          userDraggingRef.current = false;
        }}
        scrollEventThrottle={16}
      >
        {thumbs.map((item, index) => {
          const isActive = index === activeIdx;
          const bucketStart = item.time - duration / (COUNT - 1) / 2;
          const bucketEnd = item.time + duration / (COUNT - 1) / 2;
          const hasMarker = markers.some(
            (m) => m >= bucketStart && m < bucketEnd
          );
          return (
            <ThumbItem
              key={`${item.time}-${index}`}
              src={item.src}
              time={item.time}
              active={isActive}
              hasMarker={hasMarker}
              onPress={handleSeek}
              onLongPress={handleLongPress}
            />
          );
        })}
      </ScrollView>
      {loading && thumbs.length < 4 && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>generating frames…</Text>
        </View>
      )}
      {thumbs.length > 0 && !loading && (
        <Text style={styles.hint}>tap to seek · long-press to mark</Text>
      )}
    </View>
  );
}

const ThumbItem = memo(function ThumbItem({
  src,
  time,
  active,
  hasMarker,
  onPress,
  onLongPress,
}: {
  src: any;
  time: number;
  active: boolean;
  hasMarker: boolean;
  onPress: (t: number) => void;
  onLongPress: (t: number) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(time)}
      onLongPress={() => onLongPress(time)}
      delayLongPress={280}
      style={({ pressed }) => [
        styles.itemWrap,
        pressed && { opacity: 0.85 },
      ]}
    >
      {hasMarker && <View style={styles.markerDot} pointerEvents="none" />}
      <Image
        source={src}
        style={[styles.thumb, active && styles.thumbActive]}
        contentFit="cover"
        cachePolicy="memory"
        transition={120}
      />
    </Pressable>
  );
});

export const ThumbStrip = memo(ThumbStripInner);

const styles = StyleSheet.create({
  wrap: { height: H + 24, justifyContent: "center" },
  row: { gap: GAP, paddingHorizontal: 16, alignItems: "flex-end" },
  itemWrap: { width: W, height: H, position: "relative" },
  thumb: {
    width: W,
    height: H,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  thumbActive: {
    borderWidth: 2,
    borderColor: "#ff3b30",
    transform: [{ scale: 1.06 }],
    shadowColor: "#ff3b30",
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  markerDot: {
    position: "absolute",
    top: -6,
    left: "50%",
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#facc15",
    zIndex: 1,
    shadowColor: "#facc15",
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
  hint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    textAlign: "center",
    marginTop: 4,
    // @ts-ignore
    userSelect: "none",
  },
});
