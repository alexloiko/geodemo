import { useSyncExternalStore } from 'react'

const hasMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (!hasMedia()) return () => {}
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => hasMedia() && window.matchMedia(query).matches,
    () => false,
  )
}

/** `?touch=1` forces the touch layout on a desktop, `?touch=compact` the portrait one (for testing). */
const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('touch') : null

/**
 * Touch devices (finger as the primary pointer) get bigger targets and gestures;
 * `compact` (touch + portrait or narrow) moves the tools into a drawer.
 * Desktops keep the original layout and behaviour.
 */
export function useDevice() {
  const coarse = useMedia('(pointer: coarse)')
  const portrait = useMedia('(orientation: portrait), (max-width: 900px)')
  const touch = coarse || forced === '1' || forced === 'compact'
  return { touch, compact: forced === 'compact' || (touch && portrait) }
}
