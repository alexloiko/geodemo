import { useMemo, useState } from 'react'
import { intersectLines, planeFrom3 } from '../geometry/plane'
import { useT } from '../i18n'
import { makeIntersection, makePlane, makePointOnSegment, makeRatioMarks } from '../scene/build'
import { evaluate, solidEdges } from '../scene/evaluate'
import { prettyLabel } from '../scene/labels'
import { DEFAULT_COLOR, type Item, type PointRef, newId } from '../scene/model'
import { useStore } from '../store/store'

export type FormKind = 'pointOnEdge' | 'segment' | 'intersection' | 'plane' | 'face' | 'ratio'

function useScene() {
  const doc = useStore((s) => s.doc)
  const ev = useMemo(() => evaluate(doc), [doc])
  const name = (r: PointRef) => prettyLabel(ev.labels.get(r) ?? '?')
  const points = [...ev.points.keys()]
  return { doc, ev, name, points }
}

function PointSelect({ value, onChange, points, name }: { value: PointRef; onChange: (v: PointRef) => void; points: PointRef[]; name: (r: PointRef) => string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="pt-select">
      {points.map((p) => (
        <option key={p} value={p}>
          {name(p)}
        </option>
      ))}
    </select>
  )
}

function Actions({ onAdd, onClose, disabled }: { onAdd: () => void; onClose: () => void; disabled?: boolean }) {
  const t = useT()
  return (
    <div className="form-actions">
      <button className="btn primary" onClick={onAdd} disabled={disabled}>
        {t('form.add')}
      </button>
      <button className="btn ghost" onClick={onClose}>
        {t('form.cancel')}
      </button>
    </div>
  )
}

export function ConstructionForm({ kind, onClose }: { kind: FormKind; onClose: () => void }) {
  switch (kind) {
    case 'pointOnEdge':
      return <PointOnEdgeForm onClose={onClose} />
    case 'segment':
      return <SegmentForm onClose={onClose} />
    case 'intersection':
      return <IntersectionForm onClose={onClose} />
    case 'plane':
      return <PlaneForm onClose={onClose} />
    case 'face':
      return <FaceForm onClose={onClose} />
    case 'ratio':
      return <RatioForm onClose={onClose} />
  }
}

function PointOnEdgeForm({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { doc, ev, name } = useScene()
  const addItems = useStore((s) => s.addItems)
  const segs = useMemo(() => {
    const list: [PointRef, PointRef][] = solidEdges(ev.solid)
    for (const it of doc.items) if (it.type === 'segment' && !ev.invalid.has(it.id)) list.push([it.a, it.b])
    return list
  }, [doc, ev])
  const [seg, setSeg] = useState(0)
  const [m, setM] = useState(3)
  const [n, setN] = useState(1)
  const [marks, setMarks] = useState(true)
  const [label, setLabel] = useState('')
  const ok = m > 0 && n > 0 && segs[seg]
  const add = () => {
    const [a, b] = segs[seg]
    const p = makePointOnSegment(doc, a, b, m / (m + n), label.trim() || undefined)
    const items: Item[] = [p]
    if (marks) items.push(...makeRatioMarks(doc, a, p.id, b, m, n))
    addItems(items)
    onClose()
  }
  return (
    <div className="form">
      <label>
        {t('form.edge')}
        <select value={seg} onChange={(e) => setSeg(Number(e.target.value))}>
          {segs.map(([a, b], i) => (
            <option key={i} value={i}>
              {name(a)}
              {name(b)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('form.ratioMN')}
        <span className="ratio-inputs">
          <input type="number" min={0.1} step={1} value={m} onChange={(e) => setM(Number(e.target.value))} />
          :
          <input type="number" min={0.1} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </span>
      </label>
      <label>
        {t('form.label')}
        <input value={label} placeholder="K" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={marks} onChange={(e) => setMarks(e.target.checked)} />
        {t('form.addMarks')}
      </label>
      <Actions onAdd={add} onClose={onClose} disabled={!ok} />
    </div>
  )
}

function SegmentForm({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { points, name } = useScene()
  const addItems = useStore((s) => s.addItems)
  const [a, setA] = useState(points[0])
  const [b, setB] = useState(points[1])
  const [aux, setAux] = useState(false)
  const add = () => {
    addItems([
      { id: newId('s'), type: 'segment', a, b, aux, color: aux ? DEFAULT_COLOR.line : DEFAULT_COLOR.segment, visible: true },
    ])
    onClose()
  }
  return (
    <div className="form">
      <div className="row">
        <PointSelect value={a} onChange={setA} points={points} name={name} />
        <PointSelect value={b} onChange={setB} points={points} name={name} />
      </div>
      <label className="check">
        <input type="checkbox" checked={aux} onChange={(e) => setAux(e.target.checked)} />
        {t('form.aux')}
      </label>
      {a === b && <div className="error">{t('err.same')}</div>}
      <Actions onAdd={add} onClose={onClose} disabled={a === b} />
    </div>
  )
}

function IntersectionForm({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { doc, ev, points, name } = useScene()
  const addItems = useStore((s) => s.addItems)
  const [r, setR] = useState<PointRef[]>([points[0], points[1], points[2] ?? points[0], points[3] ?? points[1]])
  const set = (i: number) => (v: PointRef) => setR(r.map((x, k) => (k === i ? v : x)))
  const p = r.map((x) => ev.points.get(x)!)
  const hit = r[0] !== r[1] && r[2] !== r[3] ? intersectLines(p[0], p[1], p[2], p[3]) : null
  const add = () => {
    addItems([makeIntersection(doc, r[0], r[1], r[2], r[3])])
    onClose()
  }
  return (
    <div className="form">
      <label>
        {t('form.line1')}
        <div className="row">
          <PointSelect value={r[0]} onChange={set(0)} points={points} name={name} />
          <PointSelect value={r[1]} onChange={set(1)} points={points} name={name} />
        </div>
      </label>
      <label>
        {t('form.line2')}
        <div className="row">
          <PointSelect value={r[2]} onChange={set(2)} points={points} name={name} />
          <PointSelect value={r[3]} onChange={set(3)} points={points} name={name} />
        </div>
      </label>
      {!hit && <div className="error">{t('err.skew')}</div>}
      <Actions onAdd={add} onClose={onClose} disabled={!hit} />
    </div>
  )
}

function PlaneForm({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { doc, ev, points, name } = useScene()
  const addItems = useStore((s) => s.addItems)
  const [r, setR] = useState<PointRef[]>(points.slice(0, 3))
  const [extend, setExtend] = useState(false)
  const set = (i: number) => (v: PointRef) => setR(r.map((x, k) => (k === i ? v : x)))
  const p = r.map((x) => ev.points.get(x)!)
  const ok = !!planeFrom3(p[0], p[1], p[2])
  const add = () => {
    addItems(makePlane(doc, r[0], r[1], r[2], extend))
    onClose()
  }
  return (
    <div className="form">
      <div className="row">
        {r.map((x, i) => (
          <PointSelect key={i} value={x} onChange={set(i)} points={points} name={name} />
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={extend} onChange={(e) => setExtend(e.target.checked)} />
        {t('form.extend')}
      </label>
      {!ok && <div className="error">{t('err.collinear')}</div>}
      <Actions onAdd={add} onClose={onClose} disabled={!ok} />
    </div>
  )
}

function FaceForm({ onClose }: { onClose: () => void }) {
  const { ev } = useScene()
  const addItems = useStore((s) => s.addItems)
  const [face, setFace] = useState(0)
  const add = () => {
    addItems([{ id: newId('f'), type: 'face', face, color: DEFAULT_COLOR.face, visible: true }])
    onClose()
  }
  return (
    <div className="form">
      <select value={face} onChange={(e) => setFace(Number(e.target.value))}>
        {ev.solid?.faces.map((f, i) => (
          <option key={i} value={i}>
            {f.map((v) => prettyLabel(ev.solid!.vertices[v].label)).join('')}
          </option>
        ))}
      </select>
      <Actions onAdd={add} onClose={onClose} />
    </div>
  )
}

function RatioForm({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { points, name } = useScene()
  const addItems = useStore((s) => s.addItems)
  const [a, setA] = useState(points[0])
  const [b, setB] = useState(points[1])
  const [text, setText] = useState('x')
  const add = () => {
    addItems([{ id: newId('r'), type: 'ratio', a, b, text, color: DEFAULT_COLOR.ratio, visible: true }])
    onClose()
  }
  return (
    <div className="form">
      <div className="row">
        <PointSelect value={a} onChange={setA} points={points} name={name} />
        <PointSelect value={b} onChange={setB} points={points} name={name} />
      </div>
      <label>
        {t('form.text')}
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <Actions onAdd={add} onClose={onClose} disabled={a === b} />
    </div>
  )
}
