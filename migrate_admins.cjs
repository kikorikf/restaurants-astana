const { Client } = require('pg')

const client = new Client({
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.pqyrwteuncphwdoswwgp',
  password: '744o0IM0dQWzO48F',
  ssl: { rejectUnauthorized: false },
})

async function run() {
  await client.connect()
  console.log('Connected')

  // 1. admins table
  await client.query(`
    CREATE TABLE IF NOT EXISTS admins (
      user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE
    );
    ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
  `)
  await client.query(`DROP POLICY IF EXISTS "admin_read_own" ON admins;`)
  await client.query(`
    CREATE POLICY "admin_read_own" ON admins
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  `)
  console.log('admins table ready')

  // 2. pending_places table
  await client.query(`
    CREATE TABLE IF NOT EXISTS pending_places (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      submitted_by uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
      submitter_name text DEFAULT '',
      name text NOT NULL,
      address text DEFAULT '',
      lat float8 DEFAULT 51.163,
      lon float8 DEFAULT 71.418,
      type text DEFAULT 'ресторан',
      cuisine text[] DEFAULT '{}',
      avg_check integer,
      firm_id text,
      rating float8,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE pending_places ENABLE ROW LEVEL SECURITY;
  `)
  await client.query(`DROP POLICY IF EXISTS "pending_submit" ON pending_places;`)
  await client.query(`DROP POLICY IF EXISTS "pending_read_admin" ON pending_places;`)
  await client.query(`DROP POLICY IF EXISTS "pending_delete_admin" ON pending_places;`)
  await client.query(`
    CREATE POLICY "pending_submit" ON pending_places
      FOR INSERT TO authenticated
      WITH CHECK (submitted_by = auth.uid());
    CREATE POLICY "pending_read_admin" ON pending_places
      FOR SELECT TO authenticated
      USING (auth.uid() IN (SELECT user_id FROM admins));
    CREATE POLICY "pending_delete_admin" ON pending_places
      FOR DELETE TO authenticated
      USING (auth.uid() IN (SELECT user_id FROM admins));
  `)
  console.log('pending_places table ready')

  // 3. restaurants — update RLS
  // Drop old policies (use IF EXISTS to be safe)
  for (const name of [
    'insert_own', 'update_own', 'read_own_places', 'read_public_list',
    'admin_insert', 'admin_update', 'admin_delete', 'read_all',
  ]) {
    await client.query(`DROP POLICY IF EXISTS "${name}" ON restaurants;`)
  }

  await client.query(`
    -- All restaurants visible to everyone
    CREATE POLICY "read_all" ON restaurants
      FOR SELECT TO anon, authenticated
      USING (true);

    -- Only admins can insert
    CREATE POLICY "admin_insert" ON restaurants
      FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND auth.uid() IN (SELECT user_id FROM admins)
      );

    -- Only admins can update any restaurant
    CREATE POLICY "admin_update" ON restaurants
      FOR UPDATE TO authenticated
      USING (auth.uid() IN (SELECT user_id FROM admins));

    -- Only admins can delete any restaurant
    CREATE POLICY "admin_delete" ON restaurants
      FOR DELETE TO authenticated
      USING (auth.uid() IN (SELECT user_id FROM admins));
  `)
  console.log('restaurants RLS updated')

  await client.end()
  console.log('Done ✓')
}

run().catch(e => { console.error(e.message); process.exit(1) })
