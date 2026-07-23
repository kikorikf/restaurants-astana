const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const body = await req.json()
    const initData: string = body.initData ?? ''

    if (!initData) {
      return new Response(JSON.stringify({ error: 'No initData' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const validated = await validateInitData(initData)
    if (!validated) {
      return new Response(JSON.stringify({ error: 'Invalid initData (HMAC mismatch)' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    if (!validated.user) {
      return new Response(JSON.stringify({ error: 'No user field in initData' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const tgUser = JSON.parse(validated.user)
    const email = `tg_${tgUser.id}@tma.app`
    const password = `tgauth_${tgUser.id}_${BOT_TOKEN.slice(0, 8)}`

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    let { data: signInData, error: signInErr } = await admin.auth.signInWithPassword({ email, password })

    if (!signInData?.session) {
      const { error: createErr } = await admin.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: {
          telegram_id: tgUser.id,
          first_name: tgUser.first_name ?? '',
          last_name: tgUser.last_name ?? '',
          username: tgUser.username ?? '',
        }
      })

      if (createErr && !createErr.message.includes('already')) {
        return new Response(JSON.stringify({ error: `createUser failed: ${createErr.message}` }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }

      const { data: newSignIn, error: newSignInErr } = await admin.auth.signInWithPassword({ email, password })
      if (!newSignIn?.session) {
        return new Response(JSON.stringify({ error: `signIn failed after create: ${newSignInErr?.message}` }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
      signInData = newSignIn
    }

    return new Response(JSON.stringify({ session: signInData.session }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: `Exception: ${String(e)}` }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
