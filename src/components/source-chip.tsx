import { Ionicons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = { uri: string };

function describe(uri: string) {
  if (!uri) return { icon: "videocam", source: "video", name: "" };
  if (uri.startsWith("blob:")) {
    return { icon: "cloud-upload-outline", source: "dropped file", name: "" };
  }
  if (uri.startsWith("http")) {
    try {
      const u = new URL(uri);
      const name = decodeURIComponent(u.pathname.split("/").pop() || "");
      return { icon: "globe-outline", source: u.host, name };
    } catch {
      return { icon: "globe-outline", source: "web", name: "" };
    }
  }
  if (uri.startsWith("content://")) {
    return { icon: "albums-outline", source: "shared", name: "" };
  }
  if (uri.startsWith("file://")) {
    const name = decodeURIComponent(uri.split("/").pop()?.split("?")[0] || "");
    if (uri.includes("ImagePicker") || uri.includes("Photos")) {
      return { icon: "image-outline", source: "Photos", name };
    }
    if (uri.includes("DocumentPicker") || uri.includes("Documents")) {
      return { icon: "folder-outline", source: "Files", name };
    }
    return { icon: "document-outline", source: "local", name };
  }
  return { icon: "videocam", source: "video", name: "" };
}

function SourceChipInner({ uri }: Props) {
  const { icon, source, name } = useMemo(() => describe(uri), [uri]);
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon as any} size={11} color="rgba(255,255,255,0.7)" />
      <Text style={styles.source} numberOfLines={1}>
        {source}
      </Text>
      {!!name && (
        <>
          <View style={styles.sep} />
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="middle">
            {name}
          </Text>
        </>
      )}
    </View>
  );
}

export const SourceChip = memo(SourceChipInner);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxWidth: "85%",
  },
  source: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    // @ts-ignore — web only
    userSelect: "none",
  },
  sep: {
    width: 1,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  name: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    maxWidth: 180,
    // @ts-ignore
    userSelect: "none",
  },
});
