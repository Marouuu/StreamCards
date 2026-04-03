import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const DB_NAME = process.env.DB_NAME || 'streamcards';

async function initDatabase() {
  // 1. Connect to default 'postgres' DB to create our database
  const adminPool = new pg.Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
  });

  try {
    // Check if database exists
    const dbCheck = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`Creating database "${DB_NAME}"...`);
      await adminPool.query(`CREATE DATABASE ${DB_NAME}`);
      console.log(`Database "${DB_NAME}" created.`);
    } else {
      console.log(`Database "${DB_NAME}" already exists.`);
    }
  } catch (error) {
    console.error('Error creating database:', error.message);
    // Continue anyway — might just be a permissions issue and DB already exists
  } finally {
    await adminPool.end();
  }

  // 2. Connect to our database and run schema
  const appPool = new pg.Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: DB_NAME,
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
  });

  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    console.log('Running schema...');
    await appPool.query(schema);
    console.log('Schema applied successfully.');

    // Print table summary
    const tables = await appPool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log(`\nTables created (${tables.rows.length}):`);
    for (const row of tables.rows) {
      const count = await appPool.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
      console.log(`  - ${row.table_name} (${count.rows[0].count} rows)`);
    }

    console.log('\nDatabase ready!');
  } catch (error) {
    console.error('Error running schema:', error.message);
    process.exit(1);
  } finally {
    await appPool.end();
  }
}

initDatabase();
