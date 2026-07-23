const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function validateInitData(initData: string): Promise<Record<string, string> | null> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const botKeyBytes = await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(BOT_TOKEN))

  const dataKey = await crypto.subtle.importKey(
    'raw', botKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', dataKey, new TextEncoder().encode(dataCheckString))

  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === hash ? Object.fromEntries(params) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { initData } = await req.json()
    const validated = await validateInitData(initData)
    if (!validated) {
      return new Response(JSON.stringify({ error: 'Invalid initData' }), { status: 401, headers: CORS })
    }

    const tgUser = JSON.parse(validated.user)
    const email = `tg_${tgUser.id}@tma.app`
    const password = `tgauth_${tgUser.id}_${BOT_TOKEN.slice(0, 8)}`

    // Import Supabase admin client inline (no npm in Edge Functions)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Try sign in first
    let { data: session } = await admin.auth.signInWithPassword({ email, password })

    if (!session?.session) {
      // Create user then sign in
      await admin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: {
          telegram_id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name ?? '',
          username: tgUser.username ?? '',
        }
      })
      const { data: newSession } = await admin.auth.signInWithPassword({ email, password })
      session = newSession
    }

    return new Response(JSON.stringify({ session: session?.session }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS })
  }
})
