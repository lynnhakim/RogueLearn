// Hand-drawn primitives — React versions of templates/_macros.html.
import type { CSSProperties, ReactNode } from 'react'

export function Tack({ color = '#ff4d4d' }: { color?: string }) {
  return (
    <span
      className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-[#2d2d2d] z-10"
      style={{ background: color, boxShadow: '1px 2px 0 0 rgba(45,45,45,.4)' }}
    />
  )
}

export function Tape({ rotation = -3 }: { rotation?: number }) {
  return (
    <span
      className="absolute -top-3 left-1/2 w-24 h-6 z-10"
      style={{
        background: 'rgba(45,45,45,.15)',
        border: '1px solid rgba(45,45,45,.2)',
        borderRadius: 3,
        transform: `translateX(-50%) rotate(${rotation}deg)`,
      }}
    />
  )
}

export function StickyTag({
  children,
  color = '#fff9c4',
  rotation = -2,
  className = '',
}: {
  children: ReactNode
  color?: string
  rotation?: number
  className?: string
}) {
  return (
    <span
      className={`inline-block px-3 py-1 text-sm border-2 border-[#2d2d2d] r-small ${className}`}
      style={{ background: color, transform: `rotate(${rotation}deg)` }}
    >
      {children}
    </span>
  )
}

export function HandArrow({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 70"
      className={className}
      fill="none"
      stroke="#2d2d2d"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 35 C 35 5, 75 65, 120 30" strokeDasharray="5 5" />
      <path d="M120 30 L 108 22 M120 30 L 113 42" />
    </svg>
  )
}

const HEART_PATH = 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'

export function HeartFull({ size = 'w-7 h-7' }: { size?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="#ff4d4d"
      stroke="#2d2d2d"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={size}
    >
      <path d={HEART_PATH} />
    </svg>
  )
}

export function HeartEmpty({ size = 'w-7 h-7' }: { size?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2d2d2d"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="3 3"
      className={size}
      style={{ opacity: 0.45 }}
    >
      <path d={HEART_PATH} />
    </svg>
  )
}

export function HeartBonus({ size = 'w-7 h-7' }: { size?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="#ff9999"
      stroke="#2d2d2d"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={size}
    >
      <path d={HEART_PATH} />
      <path d="M12 7v6 M9 10h6" stroke="#fff" strokeWidth={2.5} />
    </svg>
  )
}

export function PaperCard({
  children,
  variant,
  alt,
  rotation,
  className = '',
  style,
}: {
  children: ReactNode
  variant?: 'postit' | 'postit-blue' | 'postit-pink' | 'postit-violet'
  alt?: boolean
  rotation?: number
  className?: string
  style?: CSSProperties
}) {
  const classes = ['paper-card']
  if (alt) classes.push('alt')
  if (variant) classes.push(variant)
  if (className) classes.push(className)
  return (
    <div
      className={classes.join(' ')}
      style={{
        ...(rotation !== undefined ? { transform: `rotate(${rotation}deg)` } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
