import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const EDGE_FN_URL = 'https://pqyrwteuncphwdoswwgp.supabase.co/functions/v1/telegram-auth'

export function useTelegramAuth() {
  const [user, setUser] = useState(null)
  const [tgUser, setTgUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const twa = window.Telegram?.WebApp
    if (!twa?.initData) {
      setLoading(false)
      return
    }

    twa.ready()
    twa.expand()

    const rawTgUser = twa.initDataUnsafe?.user
    setTgUser(rawTgUser ?? null)

    fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: twa.initData }),
    })
      .then(r => r.json())
      .then(async ({ session, error: err }) => {
        if (err || !session) { setError(err ?? 'Auth failed'); setLoading(false); return }
        const { data } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
        setUser(data.user)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  return { user, tgUser, loading, error }
}

export function isTelegramEnv() {
  return !!window.Telegram?.WebApp?.initData
}
