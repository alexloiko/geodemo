import { useEffect, useMemo, useState } from 'react'
import { type SolidKind, type SolidSpec, SOLID_KINDS, defaultSpec, isRevolution } from '../geometry/solids'
import { type DictKey, LANGS, useT } from '../i18n'
import { shareUrl } from '../persist/persist'
import { flatFaces } from '../geometry/polyhedron'
import { evaluate } from '../scene/evaluate'
import { loadExample } from '../scene/example'
import { prettyLabel } from '../scene/labels'
import { type ItemType, PALETTE } from '../scene/model'
import { makeNamer } from '../scene/names'
import { GROUPS, TOOLS, type ToolGroup, toolById } from '../scene/tools'
import { type DisplayMode, useStore } from '../store/store'
import { ConstructionForm, type FormKind } from './forms'
import { ToolIcon } from './ToolIcon'

const FORMS_3D: FormKind[] = ['pointOnEdge', 'segment', 'intersection', 'plane', 'face', 'ratio']
const FORMS_2D: FormKind[] = ['segment', 'intersection', 'ratio']
const FORMS_ROUND: FormKind[] = ['segment', 'intersection', 'plane', 'ratio']
const TYPES: ItemType[] = ['point', 'segment', 'line', 'vector', 'circle', 'polygon', 'angle', 'plane', 'face', 'mark', 'ratio']
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sb-section">
      <div className="sb-title">
        <h2>{title}</h2>
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

type FigureChoice = SolidKind | 'sheet'

function FigurePanel() {
  const t = useT()
  const solid = useStore((s) => s.doc.solid)
  const hasItems = useStore((s) => s.doc.items.length > 0)
  const setSolid = useStore((s) => s.setSolid)
  const [confirm, setConfirm] = useState<{ spec: SolidSpec | null } | null>(null)

  const change = (spec: SolidSpec | null) => {
    const destructive =
      hasItems && (!spec !== !solid || (spec && solid && (spec.kind !== solid.kind || ('n' in spec && 'n' in solid && spec.n !== solid.n))))
    if (destructive && (!confirm || JSON.stringify(confirm.spec) !== JSON.stringify(spec))) return setConfirm({ spec })
    setConfirm(null)
    setSolid(spec)
  }
  const upd = (patch: Record<string, number | string>) => solid && change({ ...solid, ...patch } as SolidSpec)
  const num = (key: string, label: DictKey, min: number, max: number, step?: number) => (
    <NumField key={key} label={t(label)} value={(solid as unknown as Record<string, number>)[key]} min={min} max={max} step={step} onChange={(v) => upd({ [key]: v })} />
  )
  const value: FigureChoice = solid?.kind ?? 'sheet'

  return (
    <Section title={t('figure')}>
      <select
        className="kind-select"
        value={value}
        onChange={(e) => {
          const v = e.target.value as FigureChoice
          change(v === 'sheet' ? null : defaultSpec(v))
        }}
      >
        <optgroup label={t('figureGroup.flat')}>
          <option value="sheet">{t('kind.sheet')}</option>
        </optgroup>
        {([false, true] as const).map((round) => (
          <optgroup key={String(round)} label={t(round ? 'figureGroup.round' : 'figureGroup.poly')}>
            {SOLID_KINDS.filter((k) => isRevolution(k) === round).map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}` as DictKey)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {confirm && (
        <div className="warn">
          {t('changeFigureConfirm')}
          <button className="btn small danger" onClick={() => change(confirm.spec)}>
            OK
          </button>
        </div>
      )}
      {solid && (
        <div className="params">
          {'n' in solid && num('n', 'param.n', 3, 8, 1)}
          {(solid.kind === 'cube' || solid.kind === 'tetrahedron' || solid.kind === 'octahedron') && num('a', 'param.a', 2, 8)}
          {(solid.kind === 'cuboid' || solid.kind === 'parallelepiped') && [num('a', 'param.a', 1, 9), num('b', 'param.b', 1, 9), num('c', 'param.c', 1, 9)]}
          {(solid.kind === 'prism' || solid.kind === 'pyramid' || solid.kind === 'frustum') && [num('side', 'param.side', 1, 9), num('height', 'param.height', 1, 9)]}
          {(solid.kind === 'prism' || solid.kind === 'parallelepiped') && num('shift', 'param.shift', -4, 4)}
          {solid.kind === 'frustum' && num('top', 'param.top', 0.5, solid.side - 0.5)}
          {(solid.kind === 'cylinder' || solid.kind === 'cone') && [num('r', 'param.r', 0.5, 6), num('h', 'param.h', 1, 9)]}
          {solid.kind === 'truncatedCone' && [num('r1', 'param.r1', 0.5, 6), num('r2', 'param.r2', 0.2, 6), num('h', 'param.h', 1, 9)]}
          {solid.kind === 'sphere' && num('r', 'param.r', 1, 6)}
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
      )}
    </Section>
  )
}

function ToolsPanel() {
  const t = useT()
  const st = useStore()
  const { tool, picks, doc, opts, message, planeChoice } = st
  const [form, setForm] = useState<FormKind | null>(null)
  const ev = useMemo(() => evaluate(doc), [doc])
  const names = useMemo(() => makeNamer(doc, ev, t), [doc, ev, t])
  const sheet = !doc.solid
  const available = (g: ToolGroup) => TOOLS.filter((d) => d.group === g && !(sheet && d.solidOnly))
  const tabs = GROUPS.filter((g) => g !== 'basic' && available(g).length > 0)
  const toolGroup = toolById(tool).group
  const [tab, setTab] = useState<ToolGroup>(toolGroup !== 'basic' ? toolGroup : 'construct')
  // Follow the active tool when it is chosen elsewhere (keyboard shortcuts).
  useEffect(() => {
    if (toolGroup !== 'basic') setTab(toolGroup)
  }, [toolGroup])
  const shown = tabs.includes(tab) ? tab : tabs[0]

  const pickName = (p: (typeof picks)[number]) =>
    p.kind === 'point'
      ? names.point(p.ref)
      : p.kind === 'line'
        ? names.line(p.ref)
        : p.kind === 'circle'
          ? names.circle(p.ref)
          : p.kind === 'face'
            ? names.face(p.face)
            : p.kind === 'vector'
              ? names.vector(p.ref)
              : p.kind === 'polygon'
                ? names.describe(doc.items.find((i) => i.id === p.ref)!)
                : names.plane(p.ref)

  const toolButton = (d: (typeof TOOLS)[number]) => (
    <button key={d.id} className={`tool ${tool === d.id ? 'on' : ''}`} onClick={() => st.setTool(d.id)} title={t(`hint.${d.id}` as DictKey)}>
      <ToolIcon tool={d.id} />
      <span>{t(`tool.${d.id}` as DictKey)}</span>
    </button>
  )

  return (
    <Section title={t('tools')}>
      <div className="tools basic">{available('basic').map(toolButton)}</div>
      <div className="tool-tabs" role="tablist">
        {tabs.map((g) => (
          <button key={g} role="tab" aria-selected={shown === g} className={shown === g ? 'on' : ''} onClick={() => setTab(g)}>
            {t(`group.${g}` as DictKey)}
          </button>
        ))}
      </div>
      <div className="tools">{available(shown).map(toolButton)}</div>

      <div className="tool-status">
        <p className="hint">{t(`hint.${tool}` as DictKey)}</p>
        {picks.length > 0 && (
          <p className="hint picked">
            {t('picked')}: {picks.map(pickName).join(', ')}
            {tool === 'polygon' && picks.length >= 3 && (
              <button className="btn small primary inline" onClick={st.finishPolygon}>
                {t('finishPolygon')}
              </button>
            )}
          </p>
        )}
        {message && <p className={`hint ${message.startsWith('err') ? 'error' : 'note'}`}>{t(message)}</p>}
        {planeChoice && (
          <div className="plane-choice">
            {planeChoice.options.map((p) => (
              <button key={p} className="chip" onClick={() => st.choosePlane(p)}>
                {names.plane(p)}
              </button>
            ))}
            <button className="chip ghost" onClick={() => st.choosePlane(null)}>
              {t('form.cancel')}
            </button>
          </div>
        )}
      </div>

      {(tool === 'circleCR' || tool === 'ratio' || tool === 'ticks' || tool === 'rotate' || tool === 'dilate') && (
        <div className="tool-options">
          {tool === 'rotate' && (
            <label className="opt">
              {t('opt.angle')}
              <input type="number" step={15} value={opts.angle} onChange={(e) => st.setOpts({ angle: Number(e.target.value) || 0 })} />
            </label>
          )}
          {tool === 'dilate' && (
            <label className="opt">
              {t('opt.k')}
              <input type="number" step={0.5} value={opts.k} onChange={(e) => st.setOpts({ k: Number(e.target.value) || 1 })} />
            </label>
          )}
          {tool === 'circleCR' && (
            <label className="opt">
              {t('opt.radius')}
              <input type="number" min={0.1} step={0.5} value={opts.radius} onChange={(e) => st.setOpts({ radius: Number(e.target.value) || 1 })} />
            </label>
          )}
          {tool === 'ratio' && (
            <label className="opt">
              {t('opt.ratioText')}
              <input value={opts.ratioText} onChange={(e) => st.setOpts({ ratioText: e.target.value })} />
            </label>
          )}
          {tool === 'ticks' && (
            <div className="opt">
              {t('opt.ticks')}
              <div className="seg small">
                {[1, 2, 3].map((n) => (
                  <button key={n} className={opts.ticks === n ? 'on' : ''} onClick={() => st.setOpts({ ticks: n })}>
                    {'|'.repeat(n)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!sheet && (
        <label className="opt wide">
          {t('opt.workingPlane')}
          <select value={opts.workingPlane} onChange={(e) => st.setOpts({ workingPlane: e.target.value })}>
            <option value="auto">{t('plane.auto')}</option>
            {ev.solid &&
              flatFaces(ev.solid).map((i) => (
                <option key={i} value={`f${i}`}>
                  {names.plane(`f${i}`)}
                </option>
              ))}
            {[...ev.planes.keys()].map((id) => (
              <option key={id} value={id}>
                {names.plane(id)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="sub-title">{t('exact')}</div>
      <div className="form-buttons">
        {(sheet ? FORMS_2D : doc.solid && isRevolution(doc.solid.kind) ? FORMS_ROUND : FORMS_3D).map((f) => (
          <button key={f} className={`chip ${form === f ? 'on' : ''}`} onClick={() => setForm(form === f ? null : f)}>
            {t(`form.${f}` as DictKey)}
          </button>
        ))}
      </div>
      {form && <ConstructionForm key={form} kind={form} onClose={() => setForm(null)} />}
    </Section>
  )
}

function ElementsPanel() {
  const t = useT()
  const doc = useStore((s) => s.doc)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const updateItem = useStore((s) => s.updateItem)
  const removeItems = useStore((s) => s.removeItems)
  const ev = useMemo(() => evaluate(doc), [doc])
  const names = useMemo(() => makeNamer(doc, ev, t), [doc, ev, t])

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
              const stop = (f: () => void) => (e: React.MouseEvent) => {
                e.stopPropagation()
                f()
              }
              const cycle = () => updateItem(it.id, { color: PALETTE[(PALETTE.indexOf(it.color) + 1) % PALETTE.length] })
              const short = names.nameOf(it)
              return (
                <div key={it.id} className={`item ${sel ? 'sel' : ''} ${it.visible ? '' : 'off'}`} onClick={(e) => select(it.id, e.shiftKey || e.metaKey || e.ctrlKey)}>
                  <button className="swatch" style={{ background: it.color }} title="color" onClick={stop(cycle)} />
                  {it.type === 'point' && (
                    <input
                      className="item-label"
                      value={prettyLabel(it.label)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateItem(it.id, { label: e.target.value.replace(/[₀-₉]/g, (c) => `_${c.charCodeAt(0) - 0x2080}`) })}
                    />
                  )}
                  {short && <span className="item-name">{short}</span>}
                  <span className="item-desc" title={names.describe(it)}>
                    {names.describe(it)}
                    {bad && <em className="bad"> — {t('invalid')}</em>}
                  </span>
                  {(it.type === 'segment' || it.type === 'line') && (
                    <button className={`mini ${it.aux ? 'on' : ''}`} title={t('form.aux')} onClick={stop(() => updateItem(it.id, { aux: !it.aux }))}>
                      aux
                    </button>
                  )}
                  {it.type === 'plane' && (
                    <button className={`mini ${it.extend ? 'on' : ''}`} title={t('form.extend')} onClick={stop(() => updateItem(it.id, { extend: !it.extend }))}>
                      ext
                    </button>
                  )}
                  {it.type === 'angle' && (
                    <>
                      <button className={`mini ${it.showValue ? 'on' : ''}`} title={t('showDegrees')} onClick={stop(() => updateItem(it.id, { showValue: !it.showValue }))}>
                        °
                      </button>
                      <button className="mini" onClick={stop(() => updateItem(it.id, { arcs: (it.arcs % 3) + 1 }))}>
                        {')'.repeat(it.arcs)}
                      </button>
                    </>
                  )}
                  {it.type === 'mark' && it.def.kind === 'ticks' && (
                    <button className="mini" onClick={stop(() => it.def.kind === 'ticks' && updateItem(it.id, { def: { ...it.def, count: (it.def.count % 3) + 1 } }))}>
                      {'|'.repeat(it.def.count)}
                    </button>
                  )}
                  <button className="icon" title={it.visible ? t('hide') : t('show')} onClick={stop(() => updateItem(it.id, { visible: !it.visible }))}>
                    {it.visible ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  <button className="icon" title={t('delete')} onClick={stop(() => removeItems([it.id]))}>
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
  const snapGrid = useStore((s) => s.snapGrid)
  const dashedHidden = useStore((s) => s.dashedHidden)
  const sheet = useStore((s) => !s.doc.solid)
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
      {sheet ? (
        <label className="check">
          <input type="checkbox" checked={snapGrid} onChange={() => toggle('snapGrid')} />
          {t('snapGrid')}
        </label>
      ) : (
        <label className="check">
          <input type="checkbox" checked={dashedHidden} onChange={() => toggle('dashedHidden')} />
          {t('hiddenEdges')}
        </label>
      )}
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
