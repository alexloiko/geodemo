import { useEffect } from 'react'
import { SvgCanvas } from './render/SvgCanvas'
import { type Tool, useStore } from './store/store'
import { Sidebar } from './ui/Sidebar'
import { ViewControls } from './ui/ViewControls'
import { TouchBar } from './ui/TouchBar'
import { useDevice } from './ui/device'

const TOOL_KEYS: Record<string, Tool> = {
  '1': 'select',
  '2': 'point',
  '3': 'segment',
  '4': 'line',
  '5': 'polygon',
  '6': 'perpendicular',
  '7': 'parallel',
  '8': 'circleCP',
  '9': 'intersect',
}

export default function App() {
  const lang = useStore((s) => s.lang)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, select, textarea')) return
      const st = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        st.redo()
      } else if (e.key === 'Escape') {
        if (st.picks.length || st.planeChoice) st.cancelPicks()
        else if (st.tool !== 'select') st.setTool('select')
        else st.select(null)
      } else if (e.key === 'Enter') {
        st.finishPolygon()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = st.selection.filter((id) => st.doc.items.some((i) => i.id === id))
        if (ids.length) st.removeItems(ids)
      } else if (!mod && TOOL_KEYS[e.key]) {
        st.setTool(TOOL_KEYS[e.key])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { touch, compact } = useDevice()
  const drawerOpen = useStore((s) => s.drawerOpen)
  const collapsed = useStore((s) => s.sidebarCollapsed)
  const cls = ['app', touch && 'touch', compact && 'compact', compact && drawerOpen && 'drawer-open', touch && !compact && collapsed && 'collapsed']

  return (
    <div className={cls.filter(Boolean).join(' ')}>
      <Sidebar />
      {compact && drawerOpen && <div className="drawer-backdrop" onClick={() => useStore.getState().setUi({ drawerOpen: false })} />}
      <main className="stage">
        <SvgCanvas />
        <ViewControls />
        {touch && <TouchBar compact={compact} />}
      </main>
    </div>
  )
}
