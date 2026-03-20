import DatabaseSync, { Database as SQLiteDatabase } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export class Database {
    private db: SQLiteDatabase;

    constructor() {
        const userDataPath = app.getPath('userData');
        const dbDir = path.join(userDataPath, 'db');

        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const dbPath = path.join(dbDir, 'cycy.sqlite');
        this.db = new DatabaseSync(dbPath);
        this.initTables();
    }

    private initTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS agent_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }

    // --- Helpers for Chat History ---
    public saveMessage(sessionId: string, id: string, role: string, content: string) {
        const stmt = this.db.prepare('INSERT INTO chat_history (id, session_id, role, content) VALUES (?, ?, ?, ?)');
        stmt.run(id, sessionId, role, content);
    }

    public getSessionHistory(sessionId: string) {
        const stmt = this.db.prepare('SELECT * FROM chat_history WHERE session_id = ? ORDER BY timestamp ASC');
        return stmt.all(sessionId);
    }

    // --- Helpers for Preferences ---
    public setPreference(key: string, value: string) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)');
        stmt.run(key, value);
    }

    public getPreference(key: string): string | null {
        const stmt = this.db.prepare('SELECT value FROM preferences WHERE key = ?');
        const row = stmt.get(key) as { value: string } | undefined;
        return row ? row.value : null;
    }
}
