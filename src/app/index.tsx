import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts } from "expo-font";
import { Redirect, Stack, router } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Marketing surface for web. Native launches straight into the library —
 * the product is the app, not a brochure.
 */
export default function Landing() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  if (Platform.OS !== "web") {
    return <Redirect href="/library" />;
  }

  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  return <LandingWeb />;
}

function LandingWeb() {
  const { width } = useWindowDimensions();
  const narrow = width < 720;

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "Scrub — Land on the exact frame",
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView edges={["top"]}>
          <Hero narrow={narrow} />
        </SafeAreaView>
        <PainSection />
        <FeaturesSection />
        <FinalCta />
        <Footer />
      </ScrollView>
    </View>
  );
}

function Hero({ narrow }: { narrow: boolean }) {
  return (
    <View style={[styles.hero, narrow && styles.heroNarrow]}>
      <View style={styles.heroCopy}>
        <Text style={styles.brand}>SCRUB</Text>
        <Text style={styles.headline}>Land on the exact frame.</Text>
        <Text style={styles.lede}>
          Built for the moment Photos fails you — golf swings, dance takes,
          anything you need one frame at a time. Local files. No upload. No
          subscription.
        </Text>
        <View style={styles.ctaRow}>
          <Pressable
            style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.88 }]}
            onPress={() => router.push("/library")}
          >
            <Text style={styles.ctaPrimaryTxt}>Open the library</Text>
          </Pressable>
          <Text style={styles.ctaHint}>Web · iOS · Android</Text>
        </View>
      </View>
      <TickWheelVisual />
    </View>
  );
}

function TickWheelVisual() {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    driftLoop.start();
    pulseLoop.start();
    return () => {
      driftLoop.stop();
      pulseLoop.stop();
    };
  }, [drift, pulse]);

  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -240],
  });
  const needleOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  const ticks = Array.from({ length: 48 }, (_, i) => i);

  return (
    <View style={styles.wheel} accessibilityLabel="Animated scrubber tick wheel">
      <View style={styles.wheelWindow}>
        <Animated.View style={[styles.tickStrip, { transform: [{ translateX }] }]}>
          {ticks.map((i) => {
            const major = i % 5 === 0;
            return (
              <View key={i} style={styles.tickCol}>
                <View
                  style={[
                    styles.tick,
                    major ? styles.tickMajor : styles.tickMinor,
                  ]}
                />
                {major && (
                  <Text style={styles.tickLabel}>
                    0:{(i).toString().padStart(2, "0")}
                  </Text>
                )}
              </View>
            );
          })}
        </Animated.View>
        <Animated.View style={[styles.needle, { opacity: needleOpacity }]} />
      </View>
      <Text style={styles.wheelCaption}>Slide down for finer control · ±1 frame jumps</Text>
    </View>
  );
}

function PainSection() {
  const pains = [
    {
      title: "Photos scrubbing is a joke for precision",
      body: "Golfers and coaches watched Apple strip the useful scrubber. Landing milliseconds apart became a fight with a minimal slider.",
    },
    {
      title: "Frame-by-frame shouldn’t need the cloud",
      body: "People want to zoom, slow down, and step frames on the video already on their phone — not upload to a subscription app first.",
    },
    {
      title: "Editors need mute + exact cuts, not lag",
      body: "Hunting good parts means jogging frames, looping a take, and silencing audio while you look. Scrub is built around that grind.",
    },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>WHY IT EXISTS</Text>
      <Text style={styles.sectionTitle}>Modern video apps forgot precision.</Text>
      <View style={styles.painGrid}>
        {pains.map((p) => (
          <View key={p.title} style={styles.painCard}>
            <View style={styles.painRule} />
            <Text style={styles.painTitle}>{p.title}</Text>
            <Text style={styles.painBody}>{p.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FeaturesSection() {
  const features = [
    ["Tick-wheel scrubber", "Spin like a jog dial. Pull down for half / quarter / frame modes."],
    ["±1 / ±5 / ±10 jumps", "Hold to repeat. Haptics on device. Keyboard on web."],
    ["A–B loops", "Set In and Out. Replay the swing or take until it clicks."],
    ["Markers + tags", "Bookmark frames, label videos, search your library."],
    ["0.05× → 10× speed", "Crawl through impact. Or rip through selects."],
    ["Local-first", "Photos, Files, share sheet, drag-and-drop. Your bits stay yours."],
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>THE TOOL</Text>
      <Text style={styles.sectionTitle}>Feature-rich without getting in the way.</Text>
      <View style={styles.featureGrid}>
        {features.map(([title, body]) => (
          <View key={title} style={styles.featureItem}>
            <Text style={styles.featureTitle}>{title}</Text>
            <Text style={styles.featureBody}>{body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FinalCta() {
  return (
    <View style={styles.finalCta}>
      <Text style={styles.finalHeadline}>Stop fighting the timeline.</Text>
      <Pressable
        style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.88 }]}
        onPress={() => router.push("/library")}
      >
        <Text style={styles.ctaPrimaryTxt}>Start scrubbing</Text>
      </Pressable>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerBrand}>SCRUB</Text>
      <Text style={styles.footerMeta}>Frame-perfect video review · cross-platform</Text>
    </View>
  );
}

const AMBER = "#f5c518";
const INK = "#070707";
const FOG = "rgba(255,255,255,0.62)";
const FOG_DIM = "rgba(255,255,255,0.38)";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  scroll: { paddingBottom: 64 },

  hero: {
    minHeight: 720,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 48,
    justifyContent: "space-between",
    gap: 40,
    // Atmosphere: deep radial falloff via layered fills (no flat black slab).
    backgroundColor: "#0b0b0b",
  },
  heroNarrow: { minHeight: 640, paddingHorizontal: 20 },
  heroCopy: { maxWidth: 640, gap: 18 },
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
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8, flexWrap: "wrap" },
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

  wheel: { gap: 12, marginTop: 8 },
  wheelWindow: {
    height: 120,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "rgba(245,197,24,0.28)",
    justifyContent: "center",
  },
  tickStrip: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: "100%",
    paddingBottom: 28,
    paddingLeft: 20,
    gap: 10,
  },
  tickCol: { width: 28, alignItems: "center", gap: 6 },
  tick: { width: 2, borderRadius: 1, backgroundColor: AMBER },
  tickMajor: { height: 42, opacity: 0.95 },
  tickMinor: { height: 22, opacity: 0.35 },
  tickLabel: {
    position: "absolute",
    bottom: -22,
    color: FOG_DIM,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 10,
  },
  needle: {
    position: "absolute",
    left: "50%",
    marginLeft: -1,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: "#fff",
    shadowColor: AMBER,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  wheelCaption: {
    color: FOG_DIM,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 12,
  },

  section: {
    paddingHorizontal: 28,
    paddingVertical: 72,
    gap: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  sectionEyebrow: {
    color: AMBER,
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 12,
    letterSpacing: 2,
  },
  sectionTitle: {
    color: "#fff",
    fontFamily: "BebasNeue_400Regular",
    fontSize: 40,
    letterSpacing: 1,
    lineHeight: 42,
    maxWidth: 560,
  },
  painGrid: { gap: 22, maxWidth: 820 },
  painCard: { gap: 10, paddingTop: 4 },
  painRule: { width: 36, height: 2, backgroundColor: AMBER },
  painTitle: {
    color: "#fff",
    fontFamily: "IBMPlexMono_500Medium",
    fontSize: 16,
    lineHeight: 24,
  },
  painBody: {
    color: FOG,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 640,
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

  finalCta: {
    paddingHorizontal: 28,
    paddingVertical: 80,
    alignItems: "flex-start",
    gap: 24,
    backgroundColor: "#0e0e0e",
    borderTopWidth: 1,
    borderTopColor: "rgba(245,197,24,0.18)",
  },
  finalHeadline: {
    color: "#fff",
    fontFamily: "BebasNeue_400Regular",
    fontSize: 48,
    letterSpacing: 1,
    lineHeight: 50,
  },

  footer: {
    paddingHorizontal: 28,
    paddingVertical: 28,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  footerBrand: {
    color: AMBER,
    fontFamily: "BebasNeue_400Regular",
    fontSize: 22,
    letterSpacing: 3,
  },
  footerMeta: {
    color: FOG_DIM,
    fontFamily: "IBMPlexMono_400Regular",
    fontSize: 12,
  },
});
