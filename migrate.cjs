const { Client } = require('pg')
const client = new Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.pqyrwteuncphwdoswwgp',
  password: '744o0IM0dQWzO48F',
  ssl: { rejectUnauthorized: false }
})

async function run() {
  await client.connect()
  console.log('Connected')

  await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`)
  console.log('Added user_id to restaurants')

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_data (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      restaurant_id TEXT NOT NULL,
      my_visited BOOLEAN DEFAULT FALSE,
      my_rating INTEGER,
      UNIQUE(user_id, restaurant_id)
    )
  `)
  console.log('Created user_data table')

  await client.query(`ALTER TABLE user_data ENABLE ROW LEVEL SECURITY`)
  await client.query(`DROP POLICY IF EXISTS "own data" ON user_data`)
  await client.query(`CREATE POLICY "own data" ON user_data FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`)
  console.log('user_data RLS done')

  await client.query(`DROP POLICY IF EXISTS "public access" ON restaurants`)
  await client.query(`DROP POLICY IF EXISTS "base visible to all" ON restaurants`)
  await client.query(`DROP POLICY IF EXISTS "user sees own" ON restaurants`)
  await client.query(`DROP POLICY IF EXISTS "user inserts own" ON restaurants`)
  await client.query(`DROP POLICY IF EXISTS "user deletes own" ON restaurants`)

  await client.query(`CREATE POLICY "base visible to all" ON restaurants FOR SELECT USING (user_id IS NULL)`)
  await client.query(`CREATE POLICY "user sees own" ON restaurants FOR SELECT USING (auth.uid() = user_id)`)
  await client.query(`CREATE POLICY "user inserts own" ON restaurants FOR INSERT WITH CHECK (auth.uid() = user_id)`)
  await client.query(`CREATE POLICY "user deletes own" ON restaurants FOR DELETE USING (auth.uid() = user_id)`)
  console.log('restaurants RLS done')

  await client.end()
  console.log('All done')
}

run().catch(e => { console.error('Error:', e.message); process.exit(1) })
