// A stable per-browser id used to scope an anonymous user's chat history and
// memory on the backend. Persists in localStorage (unlike the per-conversation
// session id). For signed-in users the backend ignores it and uses the account.

const KEY = 'ardukid:client-id'

function makeId(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return `client-${Math.floor(performance.now())}-${Math.floor(Math.random() * 1e6)}`
}

let cached: string | null = null

export function getClientId(): string {
  if (cached) return cached
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = makeId()
      localStorage.setItem(KEY, id)
    }
    cached = id
    return id
  } catch {
    cached = makeId()
    return cached
  }
}
