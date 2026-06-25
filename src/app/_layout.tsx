import { ThemeProvider } from "@/components/theme-provider";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
      <ThemeProvider>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#000" } }}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
