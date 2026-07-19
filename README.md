# Scrub

Frame-perfect video scrubbing for web, iOS, and Android.

Photos and most player UIs are built for casual watching. Scrub is built for the moment you need **one exact frame** — golf swings, dance takes, coaching review, or any clip you refuse to upload to a subscription cloud first.

## Product

- **Tick-wheel scrubber** with precision modes (slide down = finer)
- **±1 / ±5 / ±10 frame jumps** (hold to repeat; keyboard on web)
- **A–B loop**, mute, markers, tags, resume position
- **Local-first library** (SQLite on native, localStorage on web)
- **Marketing landing** at `/` (web); native opens the library

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing (web) → redirects to library on native |
| `/library` | Video library, import, search |
| `/play/[id]` | Player + scrubber |

## Develop

```bash
bun install
bun run ci          # typecheck + knip + unit checks
bunx expo start     # pick a free port if others are running
```

Web export:

```bash
bunx expo export --platform web
```

## Quality gates

Every PR and push to `main` runs GitHub Actions CI:

- `bun run typecheck`
- `bun run knip` — unused/unlisted dependency graph must stay clean
- `bun run test` — hotkey / loop mapping self-check

## Ship

EAS project is already linked (`extra.eas.projectId`).

```bash
# Dev client (simulator)
bunx eas build --profile development --platform ios

# Internal preview
bunx eas build --profile preview --platform all

# Store production
bunx eas build --profile production --platform all
bunx eas submit --profile production
```

Profiles live in [`eas.json`](./eas.json). OTA updates use the `preview` / `production` channels with `runtimeVersion.policy: appVersion`.

## Stack

Expo Router · expo-video · Reanimated · Gesture Handler · expo-sqlite · TypeScript · knip
