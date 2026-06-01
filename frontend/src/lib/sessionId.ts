// The agent session id is ephemeral per page load. A reload starts a fresh
// conversation, which matches the canvas (it also resets on reload), so the
// agent never "remembers" a circuit that is no longer on screen. Calling
// newSession() (e.g. on Reset) starts a clean conversation on demand.

function makeId(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return `session-${Math.floor(performance.now())}`
}

let current = makeId()

export function getSessionId(): string {
  return current
}

export function newSession(): string {
  current = makeId()
  return current
}

/** Adopt an existing id (e.g. when reopening a past chat from history). */
export function setSessionId(id: string): void {
  current = id
}
