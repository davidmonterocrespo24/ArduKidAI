/**
 * Small inline-SVG icon set used in the top bar and sim controls.
 * Kept as a single file because each icon is one component and the
 * SVGs are short - duplicating boilerplate per icon would be noisier
 * than this central palette.
 *
 * All icons share a 24-unit viewBox, 1.8-stroke linework, and inherit
 * `currentColor` so buttons control the colour via Tailwind classes.
 */

type IconProps = React.SVGProps<SVGSVGElement>

const baseProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function IconBook(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" />
      <path d="M4 17a3 3 0 0 1 3-3h11" />
      <path d="M9 8h6" />
    </svg>
  )
}

export function IconLibrary(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="4" height="16" rx="1" />
      <rect x="9" y="4" width="4" height="16" rx="1" />
      <path d="M15 4l4 1-2 15-4-1z" />
    </svg>
  )
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M7 5l13 7-13 7V5z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconBolt(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconStop(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconReset(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 4v6h6" />
      <path d="M4 10a8 8 0 1 1 2 8" />
    </svg>
  )
}

export function IconSave(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 4h11l3 3v13H5z" />
      <rect x="8" y="4" width="8" height="5" />
      <rect x="8" y="13" width="8" height="6" />
    </svg>
  )
}

export function IconUser(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
