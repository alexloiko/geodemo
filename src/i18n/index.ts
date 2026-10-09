import { useStore } from '../store/store'
import { type DictKey, en } from './en'
import { uk } from './uk'

export type Lang = 'en' | 'uk'
export const LANGS: Lang[] = ['en', 'uk']
const dicts = { en, uk }

export function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav.toLowerCase().startsWith('uk') ? 'uk' : 'en'
}

export function translate(lang: Lang, key: DictKey, vars?: Record<string, string>): string {
  let s: string = dicts[lang][key] ?? en[key]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v)
  return s
}

export function useT() {
  const lang = useStore((s) => s.lang)
  return (key: DictKey, vars?: Record<string, string>) => translate(lang, key, vars)
}

export type { DictKey }
