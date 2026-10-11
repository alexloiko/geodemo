import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { detectLang, type Lang } from '../i18n'
import { defaultCamera } from '../render/camera'
import type { Doc, Item } from '../scene/model'
import { useStore } from '../store/store'

const KEY = 'geodemo:v1'
const VERSION = 3

interface Saved {
  v: number
  doc: Doc
  lang?: Lang
}

export const encodeDoc = (doc: Doc): string => compressToEncodedURIComponent(JSON.stringify({ v: VERSION, doc }))

/**
 * Old documents → current format.
 * v1 → v2: lines were `{a, b}`; now they carry a definition and an extent.
 * v2 → v3: planes were `{a, b, c}`; now they carry a definition.
 */
export function migrate(saved: { v: number; doc: Doc; lang?: Lang }): Saved | null {
  let { v, doc } = saved
  const mapItems = (f: (it: Record<string, unknown>) => Record<string, unknown>) =>
    (doc = { ...doc, items: doc.items.map((it) => f(it as unknown as Record<string, unknown>) as unknown as Item) })
  if (v === 1) {
    mapItems((it) => {
      if (it.type !== 'line' || it.def) return it
      const { a, b, ...rest } = it
      return { ...rest, def: { kind: 'through', a, b }, extent: 'line' }
    })
    v = 2
  }
  if (v === 2) {
    mapItems((it) => {
      if (it.type !== 'plane' || it.def) return it
      const { a, b, c, ...rest } = it
      return { ...rest, def: { kind: 'three', a, b, c } }
    })
    v = 3
  }
  return v === VERSION ? { ...saved, v, doc } : null
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
    ...(saved ? { doc: saved.doc, camera: defaultCamera(saved.doc.solid?.kind ?? null) } : {}),
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
