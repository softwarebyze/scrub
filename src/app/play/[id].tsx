import { MarkersBar } from "@/components/markers-bar";
import { RepeatingPressable } from "@/components/repeating-pressable";
import { Scrubber } from "@/components/scrubber";
import { SourceChip } from "@/components/source-chip";
import { SpeedBar } from "@/components/speed-bar";
import { TagsEditor } from "@/components/tags-editor";
import { ThumbStrip } from "@/components/thumb-strip";
import { Timeline } from "@/components/timeline";
import { TitleEditor } from "@/components/title-editor";
import { Toast, type ToastHandle } from "@/components/toast";
import { ZoomableVideo } from "@/components/zoomable-video";
import {
  getVideo,
  setMarkers as dbSetMarkers,
  setPlaybackState,
  setTags as dbSetTags,
  setTitle as dbSetTitle,
  touchVideo,
  type VideoRecord,
} from "@/db/library";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, type VideoPlayer } from "expo-video";
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

function applyPlaybackRate(player: VideoPlayer, rate: number) {
  try {
    player.playbackRate = rate;
  } catch {}
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [record, setRecord] = useState<VideoRecord | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [markers, setMarkers] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const wasPlayingRef = useRef(false);
  const initialSeekRef = useRef<number | null>(null);
  const toastRef = useRef<ToastHandle>(null);
  const jumpAccumRef = useRef<{ total: number; timer: ReturnType<typeof setTimeout> | null }>({
    total: 0,
    timer: null,
  });

  // Mirrors of fast-changing state so stable callbacks/effects can read the
  // latest values without re-running on every timeUpdate tick (~30ms).
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const speedRef = useRef(1);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Hydrate from DB once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      const r = await getVideo(id);
      if (cancelled || !r) {
        if (!cancelled) router.replace("/");
        return;
      }
      setRecord(r);
      setTitle(r.title);
      setMarkers(r.markers);
      setTags(r.tags);
      initialSeekRef.current = r.lastTime;
      setHydrated(true);
      touchVideo(r.id).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const player = useVideoPlayer(record?.uri ?? null, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.03;
  });

  useEffect(() => {
    if (!record) return;
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") {
        setDuration(player.duration || 0);
        try {
          applyPlaybackRate(player, speedRef.current);
        } catch {}
        // Resume from saved position once.
        if (initialSeekRef.current !== null && initialSeekRef.current > 0.05) {
          const seek = Math.min(initialSeekRef.current, (player.duration || 0) - 0.05);
          if (seek > 0) {
            player.currentTime = seek;
            setCurrentTime(seek);
          }
          initialSeekRef.current = null;
        }
      }
    });
    return () => sub.remove();
  }, [record, player]);

  useEffect(() => {
    if (!record) return;
    applyPlaybackRate(player, speed);
  }, [speed, player, record]);

  useEffect(() => {
    if (!record) return;
    const sub = player.addListener("timeUpdate", ({ currentTime: t }) => {
      setCurrentTime(t);
    });
    return () => sub.remove();
  }, [record, player]);

  // Periodic save + force-save on unmount. Reads latest values from refs so
  // this effect doesn't re-subscribe on every timeUpdate tick — otherwise the
  // interval gets reset before it can fire and the cleanup hammers storage.
  useEffect(() => {
    if (!record) return;
    const id = record.id;
    const interval = setInterval(() => {
      setPlaybackState(id, {
        lastTime: currentTimeRef.current,
        duration: durationRef.current || undefined,
      }).catch(() => {});
    }, 1500);
    return () => {
      clearInterval(interval);
      setPlaybackState(id, {
        lastTime: currentTimeRef.current,
        duration: durationRef.current || undefined,
      }).catch(() => {});
    };
  }, [record]);

  // Persist markers when they change.
  useEffect(() => {
    if (!record || !hydrated) return;
    dbSetMarkers(record.id, markers).catch(() => {});
  }, [record, hydrated, markers]);

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
    if (player.playing) {
      player.pause();
      return;
    }
    // If we're paused at (or within a frame of) the end, rewind to the start
    // before resuming so the play button never feels like a dead button.
    if (duration > 0 && player.currentTime >= duration - 1 / 30) {
      player.currentTime = 0;
      setCurrentTime(0);
    }
    player.play();
  }, [player, duration]);

  const jumpFrames = useCallback(
    (frames: number) => {
      player.pause();
      const t = Math.max(
        0,
        Math.min(durationRef.current, player.currentTime + frames * FRAME)
      );
      player.currentTime = t;
      setCurrentTime(t);
      if (Platform.OS !== "web") {
        if (Math.abs(frames) >= 10) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (Math.abs(frames) >= 5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          Haptics.selectionAsync();
        }
      }
      const accum = jumpAccumRef.current;
      // Reset accumulator if direction flipped.
      if ((accum.total > 0 && frames < 0) || (accum.total < 0 && frames > 0)) {
        accum.total = 0;
      }
      accum.total += frames;
      const n = Math.abs(accum.total);
      const dir = accum.total > 0 ? "ahead" : "back";
      toastRef.current?.show(`${n} frame${n === 1 ? "" : "s"} ${dir}`);
      if (accum.timer) clearTimeout(accum.timer);
      accum.timer = setTimeout(() => {
        accum.total = 0;
        accum.timer = null;
      }, 900);
    },
    [player]
  );

  const goBack = useCallback(() => {
    if (record) {
      setPlaybackState(record.id, {
        lastTime: currentTimeRef.current,
        duration: durationRef.current || undefined,
      }).catch(() => {});
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [record]);

  const addMarker = useCallback(() => {
    const t = currentTimeRef.current;
    let added = false;
    setMarkers((prev) => {
      if (prev.some((m) => Math.abs(m - t) < 0.01)) return prev;
      added = true;
      return [...prev, t].sort((a, b) => a - b);
    });
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (added) toastRef.current?.show("Marker added");
  }, []);

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

  const addMarkerAt = useCallback((t: number) => {
    let added = false;
    setMarkers((prev) => {
      if (prev.some((m) => Math.abs(m - t) < 0.01)) return prev;
      added = true;
      return [...prev, t].sort((a, b) => a - b);
    });
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (added) toastRef.current?.show("Marker added");
  }, []);

  const clearAllMarkers = useCallback(() => {
    setMarkers([]);
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const prevMarker = useCallback(() => {
    const t = currentTimeRef.current;
    const cands = markers.filter((m) => m < t - 0.05);
    if (!cands.length) return;
    jumpToMarker(cands[cands.length - 1]);
  }, [markers, jumpToMarker]);

  const nextMarker = useCallback(() => {
    const t = currentTimeRef.current;
    const cand = markers.find((m) => m > t + 0.05);
    if (cand === undefined) return;
    jumpToMarker(cand);
  }, [markers, jumpToMarker]);

  const sortedMarkers = useMemo(() => [...markers].sort((a, b) => a - b), [markers]);

  const onChangeTags = useCallback(
    (next: string[]) => {
      setTags(next);
      if (record) dbSetTags(record.id, next).catch(() => {});
    },
    [record]
  );

  const onChangeTitle = useCallback(
    (next: string) => {
      const clean = next.trim() || "Untitled";
      setTitle(clean);
      if (record) dbSetTitle(record.id, clean).catch(() => {});
    },
    [record]
  );

  if (!record) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.editorContainer}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={goBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <TitleEditor value={title} onChange={onChangeTitle} />
          <View style={styles.iconBtn} />
        </View>

        <TagsEditor tags={tags} onChange={onChangeTags} />

        <Timeline
          duration={duration}
          currentTime={currentTime}
          markers={sortedMarkers}
        />

        <View style={styles.videoWrap}>
          <ZoomableVideo player={player} />
          <View style={styles.sourceOverlay} pointerEvents="box-none">
            <SourceChip uri={record.uri} />
          </View>
        </View>

        <ThumbStrip
          uri={record.uri}
          player={player}
          duration={duration}
          currentTime={currentTime}
          markers={sortedMarkers}
          onSeek={jumpToMarker}
          onAddMarkerAt={addMarkerAt}
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
          <View style={styles.jumpCluster}>
            <RepeatingPressable style={styles.jumpBtn} onPress={() => jumpFrames(-10)} hitSlop={8}>
              <Text style={styles.jumpTxt}>−10</Text>
            </RepeatingPressable>
            <RepeatingPressable style={styles.jumpBtn} onPress={() => jumpFrames(-5)} hitSlop={8}>
              <Text style={styles.jumpTxt}>−5</Text>
            </RepeatingPressable>
            <RepeatingPressable style={styles.jumpBtnPrimary} onPress={() => jumpFrames(-1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
              <Text style={styles.jumpTxtPrimary}>1</Text>
            </RepeatingPressable>
          </View>
          <Pressable style={styles.playBtn} onPress={togglePlay} hitSlop={10}>
            <Ionicons
              name={player.playing ? "pause" : "play"}
              size={30}
              color="#000"
              style={!player.playing ? { marginLeft: 4 } : undefined}
            />
          </Pressable>
          <View style={styles.jumpCluster}>
            <RepeatingPressable style={styles.jumpBtnPrimary} onPress={() => jumpFrames(1)} hitSlop={8}>
              <Text style={styles.jumpTxtPrimary}>1</Text>
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </RepeatingPressable>
            <RepeatingPressable style={styles.jumpBtn} onPress={() => jumpFrames(5)} hitSlop={8}>
              <Text style={styles.jumpTxt}>+5</Text>
            </RepeatingPressable>
            <RepeatingPressable style={styles.jumpBtn} onPress={() => jumpFrames(10)} hitSlop={8}>
              <Text style={styles.jumpTxt}>+10</Text>
            </RepeatingPressable>
          </View>
        </View>

        <Scrubber
          duration={duration}
          currentTime={currentTime}
          onScrub={onScrub}
          onScrubStart={onScrubStart}
          onScrubEnd={onScrubEnd}
        />
      </View>
      <Toast ref={toastRef} />
    </SafeAreaView>
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
    gap: 12,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
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
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  playBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  jumpCluster: { flexDirection: "row", alignItems: "center", gap: 6 },
  jumpBtn: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  jumpBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  jumpTxt: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    // @ts-ignore
    userSelect: "none",
  },
  jumpTxtPrimary: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    // @ts-ignore
    userSelect: "none",
  },
});
