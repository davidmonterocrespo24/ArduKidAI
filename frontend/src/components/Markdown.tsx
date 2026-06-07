import type { ReactNode } from 'react'

// A small, dependency-free Markdown renderer (no raw HTML -> no XSS). Handles the
// formatting the agent and the knowledge notes use: headings, fenced code
// blocks, ordered/unordered lists, bold/italic, inline code, and links. Shared
// by the chat and the Knowledge preview so both render markdown the same way.

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re =
    /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)\s]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2] !== undefined || m[3] !== undefined) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{m[2] ?? m[3]}</strong>)
    } else if (m[4] !== undefined) {
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="rounded bg-slate-200 px-1 font-mono text-[0.85em]">
          {m[4]}
        </code>,
      )
    } else if (m[5] !== undefined) {
      nodes.push(<em key={`${keyBase}-i${i}`}>{m[5]}</em>)
    } else if (m[6] !== undefined) {
      nodes.push(
        <a
          key={`${keyBase}-l${i}`}
          href={m[7]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-700 underline"
        >
          {m[6]}
        </a>,
      )
    }
    last = m.index + m[0].length
    i += 1
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let code: string[] | null = null
  let key = 0

  const flushList = () => {
    if (!list) return
    const k = `l${key++}`
    const items = list.items.map((it, j) => <li key={`${k}-${j}`}>{renderInline(it, `${k}-${j}`)}</li>)
    blocks.push(
      list.ordered ? (
        <ol key={k} className="ml-5 list-decimal space-y-1">{items}</ol>
      ) : (
        <ul key={k} className="ml-5 list-disc space-y-1">{items}</ul>
      ),
    )
    list = null
  }

  for (const line of lines) {
    if (code !== null) {
      if (line.trim().startsWith('```')) {
        blocks.push(
          <pre
            key={`code${key++}`}
            className="overflow-auto rounded-md bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100"
          >
            {code.join('\n')}
          </pre>,
        )
        code = null
      } else {
        code.push(line)
      }
      continue
    }
    if (/^```/.test(line.trim())) {
      flushList()
      code = []
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushList()
      const level = heading[1].length
      const cls =
        level <= 1
          ? 'mt-2 text-base font-bold text-slate-900'
          : level === 2
            ? 'mt-2 text-sm font-bold text-slate-900'
            : 'mt-1 text-sm font-semibold text-slate-800'
      blocks.push(
        <p key={`h${key++}`} className={cls}>
          {renderInline(heading[2], `h${key}`)}
        </p>,
      )
      continue
    }
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (ol) {
      if (!list || !list.ordered) flushList()
      ;(list ??= { ordered: true, items: [] }).items.push(ol[1])
    } else if (ul) {
      if (!list || list.ordered) flushList()
      ;(list ??= { ordered: false, items: [] }).items.push(ul[1])
    } else {
      flushList()
      if (line.trim() !== '') blocks.push(<p key={`p${key++}`}>{renderInline(line, `p${key}`)}</p>)
    }
  }
  flushList()
  if (code !== null) {
    blocks.push(
      <pre
        key={`code${key++}`}
        className="overflow-auto rounded-md bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100"
      >
        {code.join('\n')}
      </pre>,
    )
  }
  return <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">{blocks}</div>
}
