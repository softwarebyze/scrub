// Metro picks `library.native.ts` on iOS/Android and `library.web.ts` on web
// before this file. This file exists so TypeScript and the editor have a
// surface to resolve `@/db/library` against; it re-exports the web variant,
// which has the simplest type signatures.
export * from "./library.web";
