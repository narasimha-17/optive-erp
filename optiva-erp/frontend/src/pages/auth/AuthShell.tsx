import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './auth.css'

const RULE_COLORS = ['#17c3b8', '#ffd23f', '#b57be0', '#ff9a2f', '#ff5a5f', '#1f7fd1']
const HEX_GRADIENTS: Array<[string, string]> = [
  ['#2fd0c0', '#ffd23f'],
  ['#ff5a5f', '#ffc93c'],
  ['#8a3fd1', '#1fc8c0'],
]

interface Point {
  title: string
  text: string
}

interface ShellProps {
  kicker: string
  headline: string
  points: Point[]
  children: ReactNode
}

/** Floating 3D coins: stacked slices give the edge its thickness. */
function useCoins(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const wraps = [...el.querySelectorAll<HTMLElement>('.coin-wrap')]

    wraps.forEach(w => {
      const coin = w.querySelector<HTMLElement>('.coin')!
      const t = Number(coin.dataset.t) || 18
      const n = 14
      const icon = coin.dataset.icon
      let html = ''
      for (let i = 0; i < n; i++) {
        html += `<div class="slice" style="transform:translateZ(${(-t / 2 + (t * i) / (n - 1)).toFixed(2)}px)"></div>`
      }
      html += `<div class="face" style="transform:translateZ(${t / 2 + 0.5}px)">${icon ? `<svg><use href="#${icon}"/></svg>` : ''}</div>`
      html += `<div class="face" style="transform:rotateY(180deg) translateZ(${t / 2 + 0.5}px)"></div>`
      coin.innerHTML = html
    })

    const items = wraps.map((w, i) => ({ w, coin: w.querySelector<HTMLElement>('.coin')!, ph: i * 1.9, sp: 0.5 + i * 0.12, amp: 10 + i * 3 }))
    let mx = 0
    let my = 0
    let tx = 0
    let ty = 0
    let alive = true
    let raf = 0
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 2
      ty = (e.clientY / innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove)

    const loop = (ms: number) => {
      if (!alive) return
      raf = requestAnimationFrame(loop)
      const t = ms / 1000
      mx += (tx - mx) * 0.06
      my += (ty - my) * 0.06
      items.forEach((c, i) => {
        const bob = reduce ? 0 : Math.sin(t * c.sp + c.ph) * c.amp
        c.w.style.transform = `translate3d(${(mx * (14 + i * 6)).toFixed(1)}px,${(bob + my * (10 + i * 5)).toFixed(1)}px,0)`
        const ry = reduce ? -22 : -22 + Math.sin(t * c.sp * 0.8 + c.ph) * 26 + mx * 14
        const rx = reduce ? 12 : 12 + Math.cos(t * c.sp * 0.7 + c.ph) * 12 - my * 8
        c.coin.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`
      })
    }
    raf = requestAnimationFrame(loop)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [root])
}

export function AuthShell({ kicker, headline, points, children }: ShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  useCoins(rootRef)

  return (
    <div className="auth-page" ref={rootRef}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="i-rupee" viewBox="0 0 24 24">
            <g fill="none" stroke="var(--ic)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4.5h12.5M6 9.5h12.5M6.5 4.5c6.5 0 8.5 2 8.5 5s-2.6 5-8.5 5l8 6.5" />
            </g>
          </symbol>
          <symbol id="i-chart" viewBox="0 0 24 24">
            <g fill="var(--ic)">
              <rect x="3" y="12" width="4.8" height="8.5" rx="1.4" />
              <rect x="9.6" y="3.5" width="4.8" height="17" rx="1.4" />
              <rect x="16.2" y="8" width="4.8" height="12.5" rx="1.4" />
            </g>
          </symbol>
          <symbol id="i-o" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" fill="#fff" />
            <image href="/mark.png" x="3.6" y="3.6" width="16.8" height="16.8" />
          </symbol>
        </defs>
      </svg>
      <div className="strip" />

      <main className="auth-wrap">
        <aside className="auth-side">
          <Link to="/" className="logo-chip" aria-label="Optiva ERP home">
            <img src="/logo.png" alt="Optiva ERP" width="1000" height="220" />
          </Link>

          <div className="side-body">
            <div className="side-kicker">{kicker}</div>
            <h1>{headline}</h1>
            <div className="rule">
              {RULE_COLORS.map(c => (
                <i key={c} style={{ background: c }} />
              ))}
            </div>
            <div className="points">
              {points.map((p, i) => (
                <div className="pt" key={p.title}>
                  <span className="hexb" style={{ '--g1': HEX_GRADIENTS[i][0], '--g2': HEX_GRADIENTS[i][1] } as CSSProperties}>
                    <b>0{i + 1}</b>
                  </span>
                  <div>
                    <h4>{p.title}</h4>
                    <p>{p.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="side-foot">© 2026 Agentosys. Optiva ERP.</div>

          <div className="coin-wrap coin-a"><div className="coin t-gold" data-t="18" data-icon="i-rupee" /></div>
          <div className="coin-wrap coin-b"><div className="coin t-violet" data-t="22" data-icon="i-o" /></div>
          <div className="coin-wrap coin-c"><div className="coin t-pink" data-t="14" data-icon="i-chart" /></div>
        </aside>

        <section className="auth-main">
          <Link className="back" to="/">← Back to home</Link>
          {children}
        </section>
      </main>
    </div>
  )
}
