import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as RNTheme,
} from "expo-router/react-navigation";
import { useColorScheme } from "react-native";

export function ThemeProvider(props: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  return (
    <RNTheme value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      {props.children}
    </RNTheme>
  );
}
