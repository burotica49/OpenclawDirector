import initSqlJs from 'sql.js'
// Vite: récupère l’URL du wasm au build
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { Task } from '../types'

const DB_KEY = 'openclaw:kanban:sqlite-db'

type SqlJs = Awaited<ReturnType<typeof initSqlJs>>
type Database = InstanceType<SqlJs['Database']>

let _sql: SqlJs | null = null
let _db: Database | null = null
let _initPromise: Promise<void> | null = null

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('openclaw', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'))
  })
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  const db = await openIdb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly')
      const store = tx.objectStore('kv')
      const req = store.get(key)
      req.onsuccess = () => {
        const v = req.result as ArrayBuffer | Uint8Array | undefined
        if (!v) return resolve(null)
        if (v instanceof Uint8Array) return resolve(v)
        if (v instanceof ArrayBuffer) return resolve(new Uint8Array(v))
        resolve(null)
      }
      req.onerror = () => reject(req.error ?? new Error('idb get failed'))
    })
  } finally {
    db.close()
  }
}

async function idbSet(key: string, value: Uint8Array): Promise<void> {
  const db = await openIdb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite')
      const store = tx.objectStore('kv')
      const req = store.put(value, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error ?? new Error('idb put failed'))
    })
  } finally {
    db.close()
  }
}

function ensureSchema(db: Database) {
  db.run(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id   TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
  `)
}

async function ensureInit() {
  if (_initPromise) return _initPromise
  _initPromise = (async () => {
    if (!_sql) {
      _sql = await initSqlJs({
        locateFile: () => wasmUrl,
      })
    }
    const bytes = await idbGet(DB_KEY)
    _db = bytes ? new _sql!.Database(bytes) : new _sql!.Database()
    ensureSchema(_db)
    // Sauvegarde initiale si DB neuve (ou schéma ajouté)
    await idbSet(DB_KEY, _db.export())
  })()
  return _initPromise
}

export async function loadKanbanTasks(): Promise<Task[]> {
  await ensureInit()
  const db = _db!
  const res = db.exec('SELECT json FROM tasks')
  const rows = res[0]?.values ?? []
  const out: Task[] = []
  for (const r of rows) {
    const json = r?.[0]
    if (typeof json !== 'string') continue
    try {
      const t = JSON.parse(json) as Task
      if (t && typeof t.id === 'string' && t.id) out.push(t)
    } catch {
      // ignore row
    }
  }
  // Tri stable “raisonnable” si aucune autre notion d’ordre
  out.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  return out
}

export async function saveKanbanTasks(tasks: Task[]): Promise<void> {
  await ensureInit()
  const db = _db!
  db.run('BEGIN')
  try {
    db.run('DELETE FROM tasks')
    const stmt = db.prepare('INSERT INTO tasks (id, json) VALUES (?, ?)')
    try {
      for (const t of tasks) {
        stmt.run([t.id, JSON.stringify(t)])
      }
    } finally {
      stmt.free()
    }
    db.run('COMMIT')
  } catch (e) {
    db.run('ROLLBACK')
    throw e
  }
  await idbSet(DB_KEY, db.export())
}

