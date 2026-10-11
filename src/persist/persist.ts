import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { detectLang, type Lang } from '../i18n'
import type { Doc, Item } from '../scene/model'
import { useStore } from '../store/store'

const KEY = 'geodemo:v1'
const VERSION = 2

interface Saved {
  v: number
  doc: Doc
  lang?: Lang
}

export const encodeDoc = (doc: Doc): string => compressToEncodedURIComponent(JSON.stringify({ v: VERSION, doc }))

/** v1 → v2: lines were `{a, b}`; now they carry a definition and an extent. */
export function migrate(saved: { v: number; doc: Doc; lang?: Lang }): Saved | null {
  if (saved.v === 1) {
    const items = saved.doc.items.map((it) => {
      const old = it as unknown as { type: string; a?: string; b?: string; def?: unknown }
      if (old.type === 'line' && !old.def) {
        const { a, b, ...rest } = old
        return { ...rest, def: { kind: 'through', a, b }, extent: 'line' } as unknown as Item
      }
      return it
    })
    return { ...saved, v: VERSION, doc: { ...saved.doc, items } }
  }
  return saved.v === VERSION ? saved : null
}

function decode(s: string | null): Saved | null {
  if (!s) return null
  try {
    const raw = s.startsWith('{') ? s : decompressFromEncodedURIComponent(s)
    const parsed = raw ? (JSON.parse(raw) as Saved) : null
    return parsed && parsed.doc && 'items' in parsed.doc ? migrate(parsed) : null
  } catch {
    return null
  }
}

function readLocal(): Saved | null {
  try {
    return decode(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function shareUrl(doc: Doc): string {
  return `${location.origin}${location.pathname}#d=${encodeDoc(doc)}`
}

/** Load from URL hash, then localStorage; then keep both in sync. */
export function initPersistence() {
  const fromHash = decode(new URLSearchParams(location.hash.slice(1)).get('d'))
  const local = readLocal()
  const saved = fromHash ?? local
  useStore.setState({
    lang: local?.lang ?? detectLang(),
    ...(saved ? { doc: saved.doc } : {}),
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  useStore.subscribe((s, prev) => {
    if (s.doc === prev.doc && s.lang === prev.lang) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ v: VERSION, doc: s.doc, lang: s.lang }))
      } catch {
        /* storage unavailable */
      }
      history.replaceState(null, '', `#d=${encodeDoc(s.doc)}`)
    }, 250)
  })
}
