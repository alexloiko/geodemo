// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import App from './App'
import { SOLID_KINDS, defaultSpec } from './geometry/solids'
import { exampleDoc } from './scene/example'
import { useStore } from './store/store'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// jsdom has no layout: report a fixed canvas size.
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe() {
    this.cb([{ contentRect: { width: 1000, height: 800 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
  disconnect() {}
  unobserve() {}
}

describe('app smoke test', () => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const canvas = () => el.querySelector('svg.canvas')!.outerHTML

  it('mounts', async () => {
    await act(async () => root.render(<App />))
    expect(el.querySelector('svg.canvas')).not.toBeNull()
  })

  it.each([null, ...SOLID_KINDS])('renders %s without NaN', async (kind) => {
    await act(async () => useStore.setState({ doc: { solid: kind ? defaultSpec(kind) : null, items: [] } }))
    expect(canvas()).not.toMatch(/NaN|Infinity/)
  })

  it('renders the textbook example', async () => {
    await act(async () => useStore.setState({ doc: exampleDoc() }))
    expect(canvas()).not.toMatch(/NaN|Infinity/)
    expect(el.querySelectorAll('svg.canvas polygon').length).toBeGreaterThan(0)
  })
})
