Expo Router project with API Routes and server-rendering. This is a starter template — the placeholder files should be replaced when building an app.

```
src/
├── app/
│   ├── _layout.tsx       # Root layout (Stack with ThemeProvider) — replace with tabs/etc as needed
│   └── index.tsx          # Placeholder home screen — replace
└── components/
    └── theme-provider.tsx # Dark/light mode ThemeProvider using @react-navigation/native
```

The root layout wraps children in a ThemeProvider (dark/light mode via useColorScheme). When building a new app, delete the placeholder files and create the appropriate navigation structure.

## Principles

- Target iOS, Android, web.
- Install dependencies with `bunx expo add <package>`
- Use `expo-image` for images and icons.
- Routes go in `src/app/`, components go in `src/components/`
- Use kebab-case for file names (e.g., `user-card.tsx`)
