import { createClient } from '@supabase/supabase-js'

const URL = 'https://pqyrwteuncphwdoswwgp.supabase.co'
const KEY = 'sb_publishable_adAL-e0TlSgbkArOITEhVQ_yt_4xwqI'

export const supabase = createClient(URL, KEY)

// DB row → app object
export function fromRow(r) {
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine ?? [],
    type: r.type,
    rating: r.rating,
    avgCheck: r.avg_check,
    address: r.address,
    lat: r.lat,
    lon: r.lon,
    firmId: r.firm_id,
    source: r.source,
    status: r.status,
    myVisited: r.my_visited,
    myRating: r.my_rating,
  }
}

// app object → DB row
export function toRow(r) {
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    type: r.type,
    rating: r.rating,
    avg_check: r.avgCheck,
    address: r.address,
    lat: r.lat,
    lon: r.lon,
    firm_id: r.firmId,
    source: r.source,
    status: r.status,
    my_visited: r.myVisited,
    my_rating: r.myRating,
  }
}
