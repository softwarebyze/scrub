import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const AMBER = "#f5c518";
const INK = "#070707";
const FOG = "rgba(255,255,255,0.62)";
const FOG_DIM = "rgba(255,255,255,0.38)";

const FEATURES: [string, string][] = [
  ["Tick-wheel scrubber", "Spin it like a jog dial. Slide down for finer steps."],
  ["±1 / ±5 / ±10 jumps", "Hold to repeat. Haptics on device, keyboard on web."],
  ["A–B loops", "Set In and Out, then replay the swing until it clicks."],
  ["Markers + tags", "Bookmark frames, label clips, search your library."],
  ["0.05× → 10× speed", "Crawl through impact, or rip through selects."],
  ["Pinch to zoom", "Two-finger pan when you need pixel detail."],
  ["Save the frame", "Export a still without screenshot chrome."],
  ["Local-first", "Files, Photos, share sheet, drag-and-drop. Nothing uploaded."],
];

/**
 * Optional marketing surface. Not the entry point — `/` is the library.
 * Kept compact and static so it reads like the product instead of a pitch deck.
 */
export default function About() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  const { width } = useWindowDimensions();
  const narrow = width < 720;

  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "About" }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SafeAreaView edges={["top"]}>
          <View style={[styles.hero, narrow && styles.heroNarrow]}>
            <Text style={styles.brand}>SCRUB</Text>
            <Text style={styles.headline}>Land on the exact frame.</Text>
            <Text style={styles.lede}>
              A frame-accurate scrubber for the clip you already have. Photos and most
              player UIs are built for casual watching; this one is built for the moment
              you need a single exact frame — golf swings, dance takes, coaching review.
            </Text>
            <View style={styles.ctaRow}>
              <Pressable
                style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.88 }]}
                onPress={() => router.replace("/library")}
              >
                <Text style={styles.ctaPrimaryTxt}>Back to the library</Text>
              </Pressable>
              <Text style={styles.ctaHint}>Web · iOS · Android</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Everything stays on your device.</Text>
            <Text style={styles.sectionBody}>
              No upload, no account, no subscription. Scrub reads the file in place and
              writes a small local index — SQLite on iOS and Android, localStorage on web.
              Clear your browser storage and it&apos;s gone; nothing lingers on a server
              you never signed up for.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>The tool.</Text>
            <View style={styles.featureGrid}>
              {FEATURES.map(([title, body]) => (
                <View key={title} style={styles.featureItem}>
                  <Text style={styles.featureTitle}>{title}</Text>
                  <Text style={styles.featureBody}>{body}</Text>
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  scroll: { paddingBottom: 64 },

  hero: {
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 56,
    gap: 18,
    backgroundColor: "#0b0b0b",
  },
  heroNarrow: { paddingHorizontal: 20 },
  brand: {
    color: AMBER,
    fontFamily: "BebasNeue_400Regular",
    fontSize: 64,
    letterSpacing: 4,
    lineHeight: 64,
  },
  headline: {
    color: "#fff",
    fontFamily: "BebasNeue_400Regular",
    fontSize: 56,
    letterSpacing: 1,
    lineHeight: 56,
    maxWidth: 520,
  },
  lede: {
    color: FOG,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 480,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
    flexWrap: "wrap",
  },
  ctaPrimary: {
    backgroundColor: AMBER,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 4,
  },
  ctaPrimaryTxt: {
    color: "#111",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  ctaHint: {
    color: FOG_DIM,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 12,
  },

  section: {
    paddingHorizontal: 28,
    paddingVertical: 56,
    gap: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  sectionTitle: {
    color: "#fff",
    fontFamily: "BebasNeue_400Regular",
    fontSize: 36,
    letterSpacing: 1,
    lineHeight: 38,
    maxWidth: 560,
  },
  sectionBody: {
    color: FOG,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 14,
    lineHeight: 23,
    maxWidth: 600,
  },

  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 28,
    maxWidth: 900,
  },
  featureItem: { width: 260, gap: 8 },
  featureTitle: {
    color: "#fff",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 14,
  },
  featureBody: {
    color: FOG,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
});