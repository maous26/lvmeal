import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function migrate() {
  console.log('🔄 Running database migrations...\n')

  try {
    // Read the full migration file
    const migrationPath = path.join(__dirname, '../../supabase/full_migration.sql')
    const migration = fs.readFileSync(migrationPath, 'utf8')

    // Execute migration
    await pool.query(migration)
    console.log('✅ Migrations completed successfully!')

    // Check tables
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `)
    console.log('\n📋 Tables created:')
    result.rows.forEach(row => console.log(`  - ${row.table_name}`))

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
