import { Redirect } from "expo-router";

/**
 * The app is the tool. `/` goes straight to the library on every platform —
 * no landing page, no brochure, no extra click. Marketing lives at `/about`
 * for anyone who wants the pitch.
 */
export default function Index() {
  return <Redirect href="/library" />;
}