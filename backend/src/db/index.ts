import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../afloat.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let SQL: SqlJsStatic;
let db: Database;

// Thin wrapper that mimics the better-sqlite3 synchronous API
// so all route code can use .prepare(sql).run(...args) / .get(...args) / .all(...args)
class Statement {
  private sql: string;
  private database: Database;

  constructor(database: Database, sql: string) {
    this.database = database;
    this.sql = sql;
  }

  run(...args: any[]): void {
    this.database.run(this.sql, args.flat());
  }

  get(...args: any[]): any {
    const stmt = this.database.prepare(this.sql);
    stmt.bind(args.flat());
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...args: any[]): any[] {
    const stmt = this.database.prepare(this.sql);
    stmt.bind(args.flat());
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }
}

class DbWrapper {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  prepare(sql: string): Statement {
    return new Statement(this.database, sql);
  }

  exec(sql: string): void {
    this.database.run(sql);
  }

  // Persist DB to disk
  save(): void {
    const data = this.database.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

let dbWrapper: DbWrapper;

export async function initDb(): Promise<DbWrapper> {
  if (dbWrapper) return dbWrapper;

  SQL = await initSqlJs();

  let database: Database;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    database = new SQL.Database(fileBuffer);
  } else {
    database = new SQL.Database();
  }

  dbWrapper = new DbWrapper(database);

  // Run schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  dbWrapper.exec(schema);

  // Save after schema creation
  dbWrapper.save();

  return dbWrapper;
}

export function getDb(): DbWrapper {
  if (!dbWrapper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbWrapper;
}

// Auto-save wrapper: call this after any write operation
export function saveDb(): void {
  if (dbWrapper) {
    dbWrapper.save();
  }
}

export default getDb;
