import { Ionicons } from "@expo/vector-icons";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  markers: number[];
  currentTime: number;
  onAdd: () => void;
  onJump: (t: number) => void;
  onRemove: (t: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onClearAll: () => void;
};

function fmt(t: number) {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t - Math.floor(t)) * 1000);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Legacy fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    }
  } catch {}
  return false;
}

async function flashToast(msg: string) {
  if (Platform.OS !== "web") return;
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    bottom: "40px",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: "600",
    zIndex: "99999",
    boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
    transition: "opacity 0.2s",
    opacity: "0",
    fontFamily: "system-ui, sans-serif",
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 250);
  }, 1500);
}

export function MarkersBar({
  markers,
  currentTime,
  onAdd,
  onJump,
  onRemove,
  onPrev,
  onNext,
  onClearAll,
}: Props) {
  const exportAll = async () => {
    if (!markers.length) return;
    const lines = markers
      .map((t, i) => `${String(i + 1).padStart(2, "0")}. ${fmt(t)}`)
      .join("\n");
    const message = `Frame markers:\n${lines}`;

    if (Platform.OS === "web") {
      // Try Web Share API first (mobile web, modern desktop)
      const navAny: any = typeof navigator !== "undefined" ? navigator : null;
      if (navAny?.share) {
        try {
          await navAny.share({ title: "Frame markers", text: message });
          return;
        } catch {
          // user cancelled or share rejected — fall through to clipboard
        }
      }
      const copied = await copyToClipboard(message);
      flashToast(copied ? "copied to clipboard" : "couldn't share");
      return;
    }

    try {
      await Share.share({ message, title: "Frame markers" });
    } catch {}
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.toolRow}>
        <Pressable style={styles.tool} onPress={onPrev} hitSlop={10}>
          <Ionicons name="chevron-back" size={16} color="#fff" />
        </Pressable>
        <Pressable style={styles.addBtn} onPress={onAdd} hitSlop={10}>
          <Ionicons name="bookmark" size={14} color="#000" />
          <Text style={styles.addText}>mark frame</Text>
        </Pressable>
        <Pressable style={styles.tool} onPress={onNext} hitSlop={10}>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </Pressable>
        <Pressable
          style={[styles.tool, !markers.length && styles.toolDisabled]}
          onPress={exportAll}
          disabled={!markers.length}
          hitSlop={10}
        >
          <Ionicons name="share-outline" size={16} color="#fff" />
        </Pressable>
        <Pressable
          style={[styles.tool, !markers.length && styles.toolDisabled]}
          onPress={onClearAll}
          disabled={!markers.length}
          hitSlop={10}
        >
          <Ionicons name="trash-outline" size={15} color="#fff" />
        </Pressable>
      </View>

      {markers.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {markers.map((t, i) => {
            const active = Math.abs(t - currentTime) < 0.05;
            return (
              <View
                key={`${t}-${i}`}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Pressable
                  onPress={() => onJump(t)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 6 }}
                  style={styles.chipLabel}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {fmt(t)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onRemove(t)}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
                  style={styles.chipClose}
                >
                  <Ionicons
                    name="close"
                    size={13}
                    color={active ? "#000" : "rgba(255,255,255,0.7)"}
                  />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingVertical: 4 },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  tool: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  toolDisabled: { opacity: 0.35 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#facc15",
  },
  addText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
    // @ts-ignore
    userSelect: "none",
  },
  chipRow: { gap: 6, paddingHorizontal: 16, paddingVertical: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(250,204,21,0.18)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.35)",
  },
  chipActive: { backgroundColor: "#facc15", borderColor: "#facc15" },
  chipLabel: {
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    justifyContent: "center",
  },
  chipClose: {
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    // @ts-ignore
    userSelect: "none",
  },
  chipTextActive: { color: "#000" },
});
