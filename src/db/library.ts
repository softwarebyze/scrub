import * as SQLite from "expo-sqlite";

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

type Row = {
  id: string;
  uri: string;
  title: string;
  source: string;
  created_at: number;
  last_opened_at: number;
  last_time: number;
  duration: number;
  tags: string;
  markers: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("scrub-library.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY NOT NULL,
          uri TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'files',
          created_at INTEGER NOT NULL,
          last_opened_at INTEGER NOT NULL,
          last_time REAL NOT NULL DEFAULT 0,
          duration REAL NOT NULL DEFAULT 0,
          tags TEXT NOT NULL DEFAULT '[]',
          markers TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS videos_last_opened_idx ON videos(last_opened_at DESC);
        CREATE INDEX IF NOT EXISTS videos_title_idx ON videos(title);
      `);
      return db;
    });
  }
  return dbPromise;
}

function rowToRecord(r: Row): VideoRecord {
  let tags: string[] = [];
  let markers: number[] = [];
  try {
    tags = JSON.parse(r.tags);
  } catch {}
  try {
    markers = JSON.parse(r.markers);
  } catch {}
  return {
    id: r.id,
    uri: r.uri,
    title: r.title,
    source: r.source as VideoSourceKind,
    createdAt: r.created_at,
    lastOpenedAt: r.last_opened_at,
    lastTime: r.last_time,
    duration: r.duration,
    tags,
    markers,
  };
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
  const db = await getDb();
  const existing = await db.getFirstAsync<Row>(
    "SELECT * FROM videos WHERE uri = ? LIMIT 1",
    [args.uri]
  );
  const now = Date.now();
  if (existing) {
    await db.runAsync("UPDATE videos SET last_opened_at = ? WHERE id = ?", [
      now,
      existing.id,
    ]);
    return rowToRecord({ ...existing, last_opened_at: now });
  }
  const id = hashUri(args.uri);
  const title = defaultTitleFromUri(args.uri);
  await db.runAsync(
    `INSERT INTO videos (id, uri, title, source, created_at, last_opened_at, last_time, duration, tags, markers)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, '[]', '[]')`,
    [id, args.uri, title, args.source, now, now]
  );
  return {
    id,
    uri: args.uri,
    title,
    source: args.source,
    createdAt: now,
    lastOpenedAt: now,
    lastTime: 0,
    duration: 0,
    tags: [],
    markers: [],
  };
}

export async function getVideo(id: string): Promise<VideoRecord | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>("SELECT * FROM videos WHERE id = ?", [id]);
  return r ? rowToRecord(r) : null;
}

export async function touchVideo(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE videos SET last_opened_at = ? WHERE id = ?", [
    Date.now(),
    id,
  ]);
}

export async function setTitle(id: string, title: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE videos SET title = ? WHERE id = ?", [title, id]);
}

export async function setTags(id: string, tags: string[]): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE videos SET tags = ? WHERE id = ?", [
    JSON.stringify(tags),
    id,
  ]);
}

export async function setMarkers(id: string, markers: number[]): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE videos SET markers = ? WHERE id = ?", [
    JSON.stringify(markers),
    id,
  ]);
}

export async function setPlaybackState(
  id: string,
  args: { lastTime: number; duration?: number }
): Promise<void> {
  const db = await getDb();
  if (args.duration !== undefined && args.duration > 0) {
    await db.runAsync(
      "UPDATE videos SET last_time = ?, duration = ? WHERE id = ?",
      [args.lastTime, args.duration, id]
    );
  } else {
    await db.runAsync("UPDATE videos SET last_time = ? WHERE id = ?", [
      args.lastTime,
      id,
    ]);
  }
}

export async function deleteVideo(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM videos WHERE id = ?", [id]);
}

export type LibraryQuery = {
  search?: string;
  tag?: string;
  limit?: number;
};

export async function listVideos(q: LibraryQuery = {}): Promise<VideoRecord[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q.search && q.search.trim()) {
    where.push("(title LIKE ? OR tags LIKE ?)");
    const s = `%${q.search.trim()}%`;
    params.push(s, s);
  }
  if (q.tag && q.tag.trim()) {
    where.push("tags LIKE ?");
    params.push(`%"${q.tag.trim()}"%`);
  }
  const sql =
    "SELECT * FROM videos" +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY last_opened_at DESC" +
    (q.limit ? ` LIMIT ${Math.max(1, Math.floor(q.limit))}` : "");
  const rows = await db.getAllAsync<Row>(sql, params);
  return rows.map(rowToRecord);
}

export async function listAllTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ tags: string }>("SELECT tags FROM videos");
  const set = new Set<string>();
  for (const r of rows) {
    try {
      const arr = JSON.parse(r.tags) as string[];
      for (const t of arr) if (t) set.add(t);
    } catch {}
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
