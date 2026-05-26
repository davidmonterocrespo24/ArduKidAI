import { useCallback, useEffect, useState } from 'react'
import { getJson, postJson } from '../lib/api'

interface LibraryItem {
  name: string
  version: string | null
  sentence: string | null
  author: string | null
}

interface Props {
  open: boolean
  onClose: () => void
}

const CURATED: { name: string; why: string }[] = [
  { name: 'LiquidCrystal I2C', why: 'I2C 16x2 / 20x4 LCDs (LCM1602 backpack)' },
  { name: 'Servo', why: 'standard hobby RC servos on D9/D10' },
  { name: 'Adafruit NeoPixel', why: 'WS2812 / NeoPixel strips and rings' },
  { name: 'DHT sensor library', why: 'DHT11 / DHT22 temperature + humidity' },
  { name: 'IRremote', why: 'IR receivers and transmitters' },
]

export function LibrariesModal({ open, onClose }: Props) {
  const [installed, setInstalled] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busyName, setBusyName] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<LibraryItem[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await getJson<LibraryItem[]>('/api/libraries')
      setInstalled(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function install(name: string) {
    setBusyName(name)
    setError(null)
    try {
      await postJson('/api/libraries/install', { name })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyName(null)
    }
  }

  async function uninstall(name: string) {
    setBusyName(name)
    setError(null)
    try {
      await postJson('/api/libraries/uninstall', { name })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyName(null)
    }
  }

  async function doSearch() {
    if (!search.trim()) return
    setSearching(true)
    setError(null)
    try {
      const hits = await getJson<LibraryItem[]>(
        `/api/libraries/search?q=${encodeURIComponent(search.trim())}`,
      )
      setResults(hits)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSearching(false)
    }
  }

  if (!open) return null

  const installedNames = new Set(installed.map((l) => l.name.toLowerCase()))

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Arduino libraries</h2>
            <p className="text-xs text-slate-500">
              Install or remove libraries used by your sketches.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-3">
          {error && (
            <p className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}

          <section className="mb-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Suggested for kid projects
            </h3>
            <ul className="space-y-1">
              {CURATED.map((c) => {
                const isInstalled = installedNames.has(c.name.toLowerCase())
                return (
                  <li
                    key={c.name}
                    className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.why}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => (isInstalled ? uninstall(c.name) : install(c.name))}
                      disabled={busyName === c.name}
                      className={
                        isInstalled
                          ? 'rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'
                          : 'rounded border border-brand-300 bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50'
                      }
                    >
                      {busyName === c.name
                        ? 'Working...'
                        : isInstalled
                          ? 'Remove'
                          : 'Install'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="mb-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Installed
            </h3>
            {loading ? (
              <p className="text-xs text-slate-500">Loading...</p>
            ) : installed.length === 0 ? (
              <p className="text-xs text-slate-500">No libraries installed yet.</p>
            ) : (
              <ul className="space-y-1">
                {installed.map((lib) => (
                  <li
                    key={lib.name}
                    className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">
                        {lib.name}{' '}
                        {lib.version && (
                          <span className="font-mono text-xs text-slate-500">
                            v{lib.version}
                          </span>
                        )}
                      </div>
                      {lib.sentence && (
                        <div className="truncate text-xs text-slate-500">{lib.sentence}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => uninstall(lib.name)}
                      disabled={busyName === lib.name}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busyName === lib.name ? 'Working...' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                doSearch()
              }}
              className="mb-2 flex gap-2"
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="library name (e.g. DHT)"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={searching || !search.trim()}
                className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>
            {results.length > 0 && (
              <ul className="space-y-1">
                {results.map((lib) => {
                  const isInstalled = installedNames.has(lib.name.toLowerCase())
                  return (
                    <li
                      key={lib.name}
                      className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          {lib.name}
                          {lib.version && (
                            <span className="ml-1 font-mono text-xs text-slate-500">
                              v{lib.version}
                            </span>
                          )}
                        </div>
                        {lib.sentence && (
                          <div className="truncate text-xs text-slate-500">{lib.sentence}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => install(lib.name)}
                        disabled={busyName === lib.name || isInstalled}
                        className={
                          isInstalled
                            ? 'rounded border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500'
                            : 'rounded border border-brand-300 bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50'
                        }
                      >
                        {isInstalled
                          ? 'Installed'
                          : busyName === lib.name
                            ? 'Working...'
                            : 'Install'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
