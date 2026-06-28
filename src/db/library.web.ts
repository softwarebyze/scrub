// Web implementation: localStorage-backed mirror of the SQLite API used on
// native. Fine for hundreds of records; if it grows beyond that we can swap
// in IndexedDB without touching consumers.

export type VideoSourceKind = "photos" | "files" | "url" | "shared" | "drop";

export type VideoRecord = {
  id: string;
  uri: string;
  title: string;
  source: VideoSourceKind;
  createdAt: number;
  lastOpenedAt: number;
  lastTime: number;
  duration: number;
  tags: string[];
  markers: number[];
};

const STORAGE_KEY = "scrub-library-v1";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readAll(): VideoRecord[] {
  const ls = safeStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(records: VideoRecord[]) {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

function update(id: string, patch: Partial<VideoRecord>) {
  const all = readAll();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], ...patch };
  writeAll(all);
}

function hashUri(uri: string) {
  let h = 0;
  for (let i = 0; i < uri.length; i++) h = (h * 31 + uri.charCodeAt(i)) | 0;
  return `v${Date.now().toString(36)}-${(h >>> 0).toString(36)}`;
}

function defaultTitleFromUri(uri: string) {
  try {
    const tail = uri.split("/").pop() ?? uri;
    const base = decodeURIComponent(tail).split("?")[0];
    return base.replace(/\.[a-z0-9]{2,5}$/i, "") || "Untitled";
  } catch {
    return "Untitled";
  }
}

export async function addVideo(args: {
  uri: string;
  source: VideoSourceKind;
}): Promise<VideoRecord> {
  const now = Date.now();
  const all = readAll();
  const existing = all.find((r) => r.uri === args.uri);
  if (existing) {
    update(existing.id, { lastOpenedAt: now });
    return { ...existing, lastOpenedAt: now };
  }
  const rec: VideoRecord = {
    id: hashUri(args.uri),
    uri: args.uri,
    title: defaultTitleFromUri(args.uri),
    source: args.source,
    createdAt: now,
    lastOpenedAt: now,
    lastTime: 0,
    duration: 0,
    tags: [],
    markers: [],
  };
  writeAll([rec, ...all]);
  return rec;
}

export async function getVideo(id: string): Promise<VideoRecord | null> {
  return readAll().find((r) => r.id === id) ?? null;
}

export async function touchVideo(id: string): Promise<void> {
  update(id, { lastOpenedAt: Date.now() });
}

export async function setTitle(id: string, title: string): Promise<void> {
  update(id, { title });
}

export async function setTags(id: string, tags: string[]): Promise<void> {
  update(id, { tags });
}

export async function setMarkers(id: string, markers: number[]): Promise<void> {
  update(id, { markers });
}

export async function setPlaybackState(
  id: string,
  args: { lastTime: number; duration?: number }
): Promise<void> {
  update(id, {
    lastTime: args.lastTime,
    ...(args.duration !== undefined && args.duration > 0
      ? { duration: args.duration }
      : {}),
  });
}

export async function deleteVideo(id: string): Promise<void> {
  writeAll(readAll().filter((r) => r.id !== id));
}

export type LibraryQuery = { search?: string; tag?: string; limit?: number };

export async function listVideos(q: LibraryQuery = {}): Promise<VideoRecord[]> {
  let out = readAll().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  if (q.search && q.search.trim()) {
    const s = q.search.trim().toLowerCase();
    out = out.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        r.tags.some((t) => t.toLowerCase().includes(s))
    );
  }
  if (q.tag && q.tag.trim()) {
    out = out.filter((r) => r.tags.includes(q.tag!.trim()));
  }
  if (q.limit) out = out.slice(0, q.limit);
  return out;
}

export async function listAllTags(): Promise<string[]> {
  const set = new Set<string>();
  for (const r of readAll()) for (const t of r.tags) if (t) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b));
}
