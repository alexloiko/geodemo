const POOL = 'KLMNPQRTEFGHUVWXYZ'

/** Next free single-letter label, then K_2, L_2, … */
export function nextLabel(used: Iterable<string>): string {
  const set = new Set(used)
  for (let k = 1; k < 100; k++) {
    for (const ch of POOL) {
      const name = k === 1 ? ch : `${ch}_${k}`
      if (!set.has(name)) return name
    }
  }
  return '?'
}

const VARS = 'xyzuvw'

/** Next free variable letter for ratio annotations ("x", then "y", …). */
export function nextVariable(usedTexts: Iterable<string>): string {
  const used = new Set<string>()
  for (const t of usedTexts) for (const ch of t) if (VARS.includes(ch)) used.add(ch)
  for (const ch of VARS) if (!used.has(ch)) return ch
  return 'x'
}

/** Split "A_1" into base and subscript parts. */
export function splitLabel(label: string): { base: string; sub: string } {
  const i = label.indexOf('_')
  return i < 0 ? { base: label, sub: '' } : { base: label.slice(0, i), sub: label.slice(i + 1) }
}

const SUBS: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' }

/** Plain-text label with Unicode subscripts, for UI lists. */
export const prettyLabel = (label: string): string => {
  const { base, sub } = splitLabel(label)
  return base + [...sub].map((c) => SUBS[c] ?? c).join('')
}
