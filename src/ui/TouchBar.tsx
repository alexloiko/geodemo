import { type DictKey, useT } from '../i18n'
import { TOOLS, toolsOf } from '../scene/tools'
import { useStore } from '../store/store'
import { ToolIcon } from './ToolIcon'

/**
 * Bottom bar for touch devices: actions that are keyboard-only on a desktop
 * (cancel, delete, undo) and, in the compact layout, the basic tools and a
 * button that opens the tools drawer.
 */
export function TouchBar({ compact }: { compact: boolean }) {
  const t = useT()
  const st = useStore()
  const deletable = st.selection.filter((id) => st.doc.items.some((i) => i.id === id))
  const busy = st.picks.length > 0 || !!st.planeChoice
  return (
    <div className={`touch-bar${compact ? ' compact' : ''}`}>
      {compact && (
        <>
          <button className="tb-btn wide" onClick={() => st.setUi({ drawerOpen: true })}>
            ☰ {t('tools')}
          </button>
          {toolsOf('basic').map((d) => (
            <button key={d.id} className={`tb-btn tool-btn ${st.tool === d.id ? 'on' : ''}`} onClick={() => st.setTool(d.id)} aria-label={t(`tool.${d.id}` as DictKey)}>
              <ToolIcon tool={d.id} />
            </button>
          ))}
          {st.tool !== 'select' && TOOLS.find((d) => d.id === st.tool)?.group !== 'basic' && (
            <button className="tb-btn tool-btn on" onClick={() => st.setUi({ drawerOpen: true })} aria-label={t(`tool.${st.tool}` as DictKey)}>
              <ToolIcon tool={st.tool} />
            </button>
          )}
          <span className="tb-sep" />
        </>
      )}
      <button className="tb-btn" onClick={st.undo} disabled={!st.past.length} aria-label={t('undo')}>
        ↶
      </button>
      <button className="tb-btn" onClick={st.redo} disabled={!st.future.length} aria-label={t('redo')}>
        ↷
      </button>
      {busy && (
        <button className="tb-btn text" onClick={st.cancelPicks}>
          {t('cancelPicks')}
        </button>
      )}
      {st.tool === 'polygon' && st.picks.length >= 3 && (
        <button className="tb-btn text primary" onClick={st.finishPolygon}>
          {t('finishPolygon')}
        </button>
      )}
      {deletable.length > 0 && (
        <button className="tb-btn text danger" onClick={() => st.removeItems(deletable)}>
          {t('deleteSelected')}
        </button>
      )}
      {compact && (st.message || st.picks.length > 0) && (
        <div className="tb-hint">{st.message ? t(st.message) : t(`hint.${st.tool}` as DictKey)}</div>
      )}
    </div>
  )
}
