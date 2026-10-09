import { useMemo, useState } from 'react'
import { type SolidKind, type SolidSpec, SOLID_KINDS, defaultSpec } from '../geometry/solids'
import { type DictKey, LANGS, useT } from '../i18n'
import { shareUrl } from '../persist/persist'
import { evaluate } from '../scene/evaluate'
import { prettyLabel } from '../scene/labels'
import { type Item, type ItemType, PALETTE, type PointRef } from '../scene/model'
import { loadExample } from '../scene/example'
import { type DisplayMode, type Tool, useStore } from '../store/store'
import { ConstructionForm, type FormKind } from './forms'

const TOOLS: Tool[] = ['select', 'point', 'segment', 'line', 'plane']
const FORMS: FormKind[] = ['pointOnEdge', 'segment', 'intersection', 'plane', 'face', 'ratio']
const TYPES: ItemType[] = ['point', 'segment', 'line', 'plane', 'face', 'ratio']
const MODES: DisplayMode[] = ['all', 'focus', 'selected']

export function Sidebar() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  return (
    <aside className="sidebar">
      <header className="sb-header">
        <div>
          <h1>{t('appTitle')}</h1>
          <div className="subtitle">{t('appSubtitle')}</div>
        </div>
        <div className="seg small">
          {LANGS.map((l) => (
            <button key={l} className={l === lang ? 'on' : ''} onClick={() => setLang(l)}>
              {l === 'en' ? 'EN' : 'УК'}
            </button>
          ))}
        </div>
      </header>
      <div className="sb-scroll">
        <FigurePanel />
        <ToolsPanel />
        <ElementsPanel />
        <DisplayPanel />
      </div>
      <Footer />
    </aside>
  )
}

function Section({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="sb-section">
      <div className="sb-title">
        <h2>{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function NumField({ label, value, onChange, min, max, step = 0.5 }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <label className="num-field">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value}</output>
    </label>
  )
}

function FigurePanel() {
  const t = useT()
  const solid = useStore((s) => s.doc.solid)
  const hasItems = useStore((s) => s.doc.items.length > 0)
  const setSolid = useStore((s) => s.setSolid)
  const [confirm, setConfirm] = useState<SolidSpec | null>(null)

  const change = (spec: SolidSpec) => {
    const destructive = hasItems && (spec.kind !== solid.kind || ('n' in spec && 'n' in solid && spec.n !== solid.n))
    if (destructive && (!confirm || JSON.stringify(confirm) !== JSON.stringify(spec))) return setConfirm(spec)
    setConfirm(null)
    setSolid(spec)
  }
  const upd = (patch: Record<string, number | string>) => change({ ...solid, ...patch } as SolidSpec)
  const num = (key: string, label: DictKey, min: number, max: number, step?: number) => (
    <NumField key={key} label={t(label)} value={(solid as unknown as Record<string, number>)[key]} min={min} max={max} step={step} onChange={(v) => upd({ [key]: v })} />
  )

  return (
    <Section title={t('figure')}>
      <select className="kind-select" value={solid.kind} onChange={(e) => change(defaultSpec(e.target.value as SolidKind))}>
        {SOLID_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`kind.${k}` as DictKey)}
          </option>
        ))}
      </select>
      {confirm && (
        <div className="warn">
          {t('changeFigureConfirm')}
          <button className="btn small danger" onClick={() => change(confirm)}>
            OK
          </button>
        </div>
      )}
      <div className="params">
        {'n' in solid && num('n', 'param.n', 3, 8, 1)}
        {(solid.kind === 'cube' || solid.kind === 'tetrahedron' || solid.kind === 'octahedron') && num('a', 'param.a', 2, 8)}
        {(solid.kind === 'cuboid' || solid.kind === 'parallelepiped') && [num('a', 'param.a', 1, 9), num('b', 'param.b', 1, 9), num('c', 'param.c', 1, 9)]}
        {(solid.kind === 'prism' || solid.kind === 'pyramid' || solid.kind === 'frustum') && [num('side', 'param.side', 1, 9), num('height', 'param.height', 1, 9)]}
        {(solid.kind === 'prism' || solid.kind === 'parallelepiped') && num('shift', 'param.shift', -4, 4)}
        {solid.kind === 'frustum' && num('top', 'param.top', 0.5, solid.side - 0.5)}
        {solid.kind === 'pyramid' && (
          <label className="num-field">
            <span>{t('param.apex')}</span>
            <select value={solid.apex} onChange={(e) => upd({ apex: e.target.value })}>
              <option value="center">{t('apex.center')}</option>
              <option value="vertex">{t('apex.vertex')}</option>
            </select>
          </label>
        )}
      </div>
    </Section>
  )
}

function ToolsPanel() {
  const t = useT()
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const pending = useStore((s) => s.pending)
  const doc = useStore((s) => s.doc)
  const [form, setForm] = useState<FormKind | null>(null)
  const ev = useMemo(() => evaluate(doc), [doc])
  return (
    <Section title={t('tools')}>
      <div className="tools">
        {TOOLS.map((k, i) => (
          <button key={k} className={`tool ${tool === k ? 'on' : ''}`} onClick={() => setTool(k)} title={`${t(`tool.${k}` as DictKey)} (${i + 1})`}>
            <ToolIcon tool={k} />
            <span>{t(`tool.${k}` as DictKey)}</span>
          </button>
        ))}
      </div>
      <p className="hint">{t(`hint.${tool}` as DictKey)}</p>
      {pending.length > 0 && (
        <p className="hint picked">
          {t('picked')}: {pending.map((p) => prettyLabel(ev.labels.get(p) ?? '')).join(', ')}
        </p>
      )}
      <div className="sub-title">{t('exact')}</div>
      <div className="form-buttons">
        {FORMS.map((f) => (
          <button key={f} className={`chip ${form === f ? 'on' : ''}`} onClick={() => setForm(form === f ? null : f)}>
            {t(`form.${f}` as DictKey)}
          </button>
        ))}
      </div>
      {form && <ConstructionForm key={form} kind={form} onClose={() => setForm(null)} />}
    </Section>
  )
}

function ToolIcon({ tool }: { tool: Tool }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const }
  switch (tool) {
    case 'select':
      return (
        <svg {...common}>
          <path d="M5 3l14 8-6 2-2 6z" />
        </svg>
      )
    case 'point':
      return (
        <svg {...common}>
          <path d="M3 18L21 6" />
          <circle cx="12" cy="12" r="3" fill="#fff" />
        </svg>
      )
    case 'segment':
      return (
        <svg {...common}>
          <path d="M5 19L19 5" />
          <circle cx="5" cy="19" r="2" fill="currentColor" />
          <circle cx="19" cy="5" r="2" fill="currentColor" />
        </svg>
      )
    case 'line':
      return (
        <svg {...common}>
          <path d="M2 22L22 2" strokeDasharray="0" />
          <circle cx="9" cy="15" r="2" fill="currentColor" />
          <circle cx="15" cy="9" r="2" fill="currentColor" />
        </svg>
      )
    case 'plane':
      return (
        <svg {...common}>
          <path d="M3 16l6-9h12l-6 9z" fill="currentColor" fillOpacity={0.2} />
        </svg>
      )
  }
}

function describe(it: Item, name: (r: PointRef) => string, t: ReturnType<typeof useT>, solidLabel: (i: number) => string, faceName: (f: number) => string): string {
  switch (it.type) {
    case 'point': {
      const d = it.def
      if (d.kind === 'onSegment') {
        const m = Math.round(d.t * 1000) / 1000
        return `∈ ${name(d.a)}${name(d.b)} · ${ratioOf(m)}`
      }
      if (d.kind === 'intersection') return t('desc.intersection', { a: name(d.a1) + name(d.a2), b: name(d.b1) + name(d.b2) })
      return t('desc.edgePlane', { e: solidLabel(d.a) + solidLabel(d.b) })
    }
    case 'segment':
    case 'line':
      return `${name(it.a)}${name(it.b)}`
    case 'plane':
      return `(${name(it.a)}${name(it.b)}${name(it.c)})`
    case 'face':
      return faceName(it.face)
    case 'ratio':
      return `${name(it.a)}${name(it.b)} = ${it.text}`
  }
}

function ratioOf(t: number): string {
  for (let den = 2; den <= 12; den++) {
    const num = Math.round(t * den)
    if (num > 0 && num < den && Math.abs(t - num / den) < 1e-6) return `${num}:${den - num}`
  }
  return `${Math.round(t * 100)}%`
}

function ElementsPanel() {
  const t = useT()
  const doc = useStore((s) => s.doc)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const updateItem = useStore((s) => s.updateItem)
  const removeItems = useStore((s) => s.removeItems)
  const ev = useMemo(() => evaluate(doc), [doc])
  const name = (r: PointRef) => prettyLabel(ev.labels.get(r) ?? '?')
  const solidLabel = (i: number) => prettyLabel(ev.solid.vertices[i]?.label ?? '?')
  const faceName = (f: number) => (ev.solid.faces[f] ?? []).map(solidLabel).join('')

  if (!doc.items.length)
    return (
      <Section title={t('elements')}>
        <p className="hint">{t('noElements')}</p>
      </Section>
    )

  return (
    <Section title={t('elements')}>
      {TYPES.map((type) => {
        const items = doc.items.filter((i) => i.type === type)
        if (!items.length) return null
        return (
          <div key={type} className="group">
            <div className="group-title">{t(`type.${type}` as DictKey)}</div>
            {items.map((it) => {
              const sel = selection.includes(it.id)
              const bad = ev.invalid.has(it.id)
              const cycle = () => updateItem(it.id, { color: PALETTE[(PALETTE.indexOf(it.color) + 1) % PALETTE.length] })
              return (
                <div key={it.id} className={`item ${sel ? 'sel' : ''} ${it.visible ? '' : 'off'}`} onClick={(e) => select(it.id, e.shiftKey || e.metaKey || e.ctrlKey)}>
                  <button
                    className="swatch"
                    style={{ background: it.color }}
                    title="color"
                    onClick={(e) => {
                      e.stopPropagation()
                      cycle()
                    }}
                  />
                  {it.type === 'point' ? (
                    <input
                      className="item-label"
                      value={prettyLabel(it.label)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateItem(it.id, { label: e.target.value.replace(/[₀-₉]/g, (c) => `_${c.charCodeAt(0) - 0x2080}`) })}
                    />
                  ) : null}
                  <span className="item-desc">
                    {describe(it, name, t, solidLabel, faceName)}
                    {bad && <em className="bad"> — {t('invalid')}</em>}
                  </span>
                  {it.type === 'segment' && (
                    <button className={`mini ${it.aux ? 'on' : ''}`} title={t('form.aux')} onClick={(e) => (e.stopPropagation(), updateItem(it.id, { aux: !it.aux }))}>
                      aux
                    </button>
                  )}
                  {it.type === 'plane' && (
                    <button className={`mini ${it.extend ? 'on' : ''}`} title={t('form.extend')} onClick={(e) => (e.stopPropagation(), updateItem(it.id, { extend: !it.extend }))}>
                      ext
                    </button>
                  )}
                  <button className="icon" title={it.visible ? t('hide') : t('show')} onClick={(e) => (e.stopPropagation(), updateItem(it.id, { visible: !it.visible }))}>
                    {it.visible ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  <button className="icon" title={t('delete')} onClick={(e) => (e.stopPropagation(), removeItems([it.id]))}>
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
    </Section>
  )
}

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" opacity={0.4} />
    <path d="M3 3l18 18" />
  </svg>
)

function DisplayPanel() {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const showGrid = useStore((s) => s.showGrid)
  const dashedHidden = useStore((s) => s.dashedHidden)
  const toggle = useStore((s) => s.toggle)
  return (
    <Section title={t('display')}>
      <div className="seg">
        {MODES.map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {t(`mode.${m}` as DictKey)}
          </button>
        ))}
      </div>
      <p className="hint">{t('mode.hint')}</p>
      <label className="check">
        <input type="checkbox" checked={showGrid} onChange={() => toggle('showGrid')} />
        {t('grid')}
      </label>
      <label className="check">
        <input type="checkbox" checked={dashedHidden} onChange={() => toggle('dashedHidden')} />
        {t('hiddenEdges')}
      </label>
    </Section>
  )
}

function Footer() {
  const t = useT()
  const st = useStore()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(st.doc))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <footer className="sb-footer">
      <button className="btn" onClick={st.undo} disabled={!st.past.length} title="Ctrl+Z">
        ↶ {t('undo')}
      </button>
      <button className="btn" onClick={st.redo} disabled={!st.future.length} title="Ctrl+Shift+Z">
        ↷ {t('redo')}
      </button>
      <button className="btn" onClick={copy}>
        {copied ? t('copied') : t('copyLink')}
      </button>
      <button className="btn" onClick={() => loadExample()}>
        {t('example')}
      </button>
      <button className="btn ghost" onClick={() => st.setDoc({ ...st.doc, items: [] })} disabled={!st.doc.items.length}>
        {t('clear')}
      </button>
    </footer>
  )
}
