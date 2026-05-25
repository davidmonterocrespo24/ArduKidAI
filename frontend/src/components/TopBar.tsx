import { UserMenu } from './UserMenu'

export function TopBar() {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500 font-bold text-white"
        >
          A
        </span>
        <div className="leading-tight">
          <h1 className="text-base font-semibold">ArduKid</h1>
          <p className="text-xs text-slate-500">An AI Arduino IDE for kids</p>
        </div>
      </div>
      <UserMenu />
    </header>
  )
}
