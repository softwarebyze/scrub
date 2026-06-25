import { Image } from "expo-image";
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
  onSeek: (t: number) => void;
};

const COUNT = 40;
const W = 72;
const H = 44;
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

function ThumbStripInner({ uri, player, duration, currentTime, onSeek }: Props) {
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const cancelledRef = useRef({ current: false });
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        } catch {
          // ignore — leaves empty thumbs
        }
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
    ? Math.min(COUNT - 1, Math.max(0, Math.round((currentTime / duration) * (COUNT - 1))))
    : 0;

  // Auto-scroll active thumb into view (unless user is actively scrolling).
  useEffect(() => {
    if (userScrollingRef.current) return;
    const id = requestAnimationFrame(() => {
      const target = Math.max(0, activeIdx * (W + 4) - 100);
      scrollRef.current?.scrollTo({ x: target, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [activeIdx]);

  const markUserScrolling = () => {
    userScrollingRef.current = true;
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 700);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onScrollBeginDrag={markUserScrolling}
        onTouchStart={markUserScrolling}
        scrollEventThrottle={16}
      >
        {thumbs.map((item, index) => (
          <ThumbItem
            key={`${item.time}-${index}`}
            src={item.src}
            time={item.time}
            active={index === activeIdx}
            onPress={onSeek}
          />
        ))}
      </ScrollView>
      {loading && thumbs.length < 4 && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>generating frames…</Text>
        </View>
      )}
    </View>
  );
}

const ThumbItem = memo(function ThumbItem({
  src,
  time,
  active,
  onPress,
}: {
  src: any;
  time: number;
  active: boolean;
  onPress: (t: number) => void;
}) {
  return (
    <Pressable onPress={() => onPress(time)} style={styles.itemWrap}>
      <Image
        source={src}
        style={[styles.thumb, active && styles.thumbActive]}
        contentFit="cover"
        cachePolicy="memory"
        transition={0}
      />
    </Pressable>
  );
});

export const ThumbStrip = memo(ThumbStripInner);

const styles = StyleSheet.create({
  wrap: { height: H + 10, justifyContent: "center" },
  row: { gap: 4, paddingHorizontal: 16 },
  itemWrap: { width: W, height: H },
  thumb: {
    width: W,
    height: H,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  thumbActive: {
    borderWidth: 2,
    borderColor: "#ff3b30",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
});
