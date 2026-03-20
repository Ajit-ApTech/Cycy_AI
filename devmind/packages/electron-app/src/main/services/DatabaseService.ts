import { app } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';

export class DatabaseService {
    private db: Database.Database;

    constructor() {
        // Store the DB in the Electron user data directory
        const dbPath = path.join(app.getPath('userData'), 'cycy_local.db');
        this.db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });

        console.log(`[DatabaseService] Initialized SQLite DB strictly at ${dbPath}`);
        this.runMigrations();
    }

    private runMigrations() {
        try {
            // Chat history table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    session_id TEXT NOT NULL
                );
            `);

            // App settings/preferences table
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            `);

            console.log(`[DatabaseService] Migrations executed successfully.`);
        } catch (err) {
            console.error(`[DatabaseService] Migration failed:`, err);
            throw err;
        }
    }

    // --- Chat Methods ---
    public saveChatMessage(id: string, role: string, content: string, timestamp: string, sessionId: string = 'default') {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO chat_messages (id, role, content, timestamp, session_id) VALUES (?, ?, ?, ?, ?)');
        stmt.run(id, role, content, timestamp, sessionId);
    }

    public getChatMessages(sessionId: string = 'default') {
        const stmt = this.db.prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC');
        return stmt.all(sessionId);
    }

    public clearChatHistory(sessionId: string = 'default') {
        const stmt = this.db.prepare('DELETE FROM chat_messages WHERE session_id = ?');
        stmt.run(sessionId);
    }

    // --- Setting Methods ---
    public saveSetting(key: string, value: string) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        stmt.run(key, value);
    }

    public getSetting(key: string): string | null {
        const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
        const row = stmt.get(key) as { value: string } | undefined;
        return row ? row.value : null;
    }

    // Gracefully shut down SQLite connection
    public close() {
        if (this.db) {
            this.db.close();
        }
    }
}
