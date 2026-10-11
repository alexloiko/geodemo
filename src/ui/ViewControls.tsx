import { useT } from '../i18n'
import { ORTHO_CAMERA, TEXTBOOK_CAMERA } from '../render/camera'
import { useStore } from '../store/store'

export function ViewControls() {
  const t = useT()
  const camera = useStore((s) => s.camera)
  const setCamera = useStore((s) => s.setCamera)
  const sheet = useStore((s) => !s.doc.solid)
  if (sheet)
    return (
      <div className="view-controls">
        <button className="btn" onClick={() => setCamera({ zoom: 1, pan: [0, 0] })}>
          {t('resetView')}
        </button>
        <div className="zoom">
          <button className="btn" onClick={() => setCamera({ zoom: Math.min(5, camera.zoom * 1.2) })}>+</button>
          <button className="btn" onClick={() => setCamera({ zoom: Math.max(0.3, camera.zoom / 1.2) })}>−</button>
        </div>
      </div>
    )
  return (
    <div className="view-controls">
      <div className="seg">
        <button className={camera.projection === 'oblique' ? 'on' : ''} onClick={() => setCamera({ ...TEXTBOOK_CAMERA, zoom: camera.zoom })}>
          {t('proj.oblique')}
        </button>
        <button className={camera.projection === 'orthographic' ? 'on' : ''} onClick={() => setCamera({ ...ORTHO_CAMERA, zoom: camera.zoom })}>
          {t('proj.orthographic')}
        </button>
      </div>
      <button
        className="btn"
        onClick={() => setCamera({ ...(camera.projection === 'oblique' ? TEXTBOOK_CAMERA : ORTHO_CAMERA), pan: [0, 0] })}
      >
        {t('resetView')}
      </button>
      <div className="zoom">
        <button className="btn" onClick={() => setCamera({ zoom: Math.min(4, camera.zoom * 1.2) })}>+</button>
        <button className="btn" onClick={() => setCamera({ zoom: Math.max(0.3, camera.zoom / 1.2) })}>−</button>
      </div>
    </div>
  )
}
