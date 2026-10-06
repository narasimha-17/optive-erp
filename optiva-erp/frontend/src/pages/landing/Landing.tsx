import { useEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { initLanding } from './landingEffects'
import './landing.css'

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuth()

  useEffect(() => {
    if (!rootRef.current) return
    return initLanding(rootRef.current)
  }, [])

  return (
    <div className="landing" ref={rootRef}>


{/* shared icon symbols */}
<svg width="0" height="0" style={{position:'absolute'} as CSSProperties} aria-hidden="true">
  <defs>
    <symbol id="i-rupee" viewBox="0 0 24 24"><g fill="none" stroke="var(--ic)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4.5h12.5M6 9.5h12.5M6.5 4.5c6.5 0 8.5 2 8.5 5s-2.600 5-8.500 5l8 6.500"/></g></symbol>
    <symbol id="i-chart" viewBox="0 0 24 24"><g fill="var(--ic)"><rect x="3" y="12" width="4.800" height="8.500" rx="1.400"/><rect x="9.600" y="3.500" width="4.800" height="17" rx="1.400"/><rect x="16.200" y="8" width="4.800" height="12.500" rx="1.400"/></g></symbol>
    <symbol id="i-box" viewBox="0 0 24 24"><g stroke="var(--ic)" strokeWidth="2.100" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3.500 7.500 12 12l8.500-4.500z" fill="var(--ic)" fillOpacity=".38"/><path d="M3.500 7.500v9L12 21l8.500-4.500v-9M12 12v9" fill="none"/></g></symbol>
    <symbol id="i-cart" viewBox="0 0 24 24"><g stroke="var(--ic)" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round"><path d="M2.500 4h3.200l2.400 11.200c.1.600.7 1 1.300 1h8.300c.6 0 1.100-.4 1.300-1L20.900 8H6.400" fill="none"/><circle cx="9.800" cy="20" r="1.700" fill="var(--ic)"/><circle cx="17.200" cy="20" r="1.700" fill="var(--ic)"/></g></symbol>
    <symbol id="i-o" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#fff"/><image href="/mark.png" x="3.600" y="3.600" width="16.800" height="16.800"/></symbol>
  </defs>
</svg>

<header id="top">
  <div className="container nav">
    <a href="#" className="brand" aria-label="Optiva ERP home"><img src="/logo.png" alt="Optiva ERP" width="1000" height="220" /></a>
    <nav className="nav-links">
      <a href="#">Home</a>
      <a href="#platform">Platform</a>
      <a href="#solutions">Solutions</a>
      <a href="#industries">Industries</a>
      <a href="#ai">AI</a>
    </nav>
    <div className="nav-right">
      {user ? <Link to="/app">Dashboard</Link> : <Link to="/login">Log in</Link>}
      {user ? <button type="button" className="pill" onClick={logout}>Log out</button> : <Link to="/signup" className="pill">Sign up</Link>}
    </div>
  </div>
</header>

<main>

{/* ================= HERO ================= */}
<section className="hero" id="hero" style={{padding:'0'} as CSSProperties}>

  <svg className="ribbon" viewBox="0 0 1440 640" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="rb" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c9c3f5"/>
        <stop offset=".35" stopColor="#eeebfd"/>
        <stop offset=".55" stopColor="#a7a1de"/>
        <stop offset=".8" stopColor="#cfcaf6"/>
        <stop offset="1" stopColor="#9992d6"/>
      </linearGradient>
      <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1.2" cy="1.2" r=".9" fill="#7b74c0" opacity=".55"/>
      </pattern>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0"/>
        <stop offset="1" stopColor="#fff" stopOpacity=".55"/>
      </linearGradient>
    </defs>
    <g className="sheen">
      <path id="ribbonShape" d="M0,250 C260,190 470,460 760,500 C1040,540 1220,300 1440,70 L1440,200 C1230,420 1040,640 760,620 C460,596 250,330 0,360 Z" fill="url(#rb)"/>
      <path d="M0,250 C260,190 470,460 760,500 C1040,540 1220,300 1440,70 L1440,200 C1230,420 1040,640 760,620 C460,596 250,330 0,360 Z" fill="url(#dots)" opacity=".6"/>
      <path d="M0,250 C260,190 470,460 760,500 C1040,540 1220,300 1440,70 L1440,200 C1230,420 1040,640 760,620 C460,596 250,330 0,360 Z" fill="url(#fade)"/>
      <path d="M0,250 C260,190 470,460 760,500 C1040,540 1220,300 1440,70" fill="none" stroke="#6f69ad" strokeWidth="3"/>
      <path d="M0,360 C250,330 460,596 760,620 C1040,640 1230,420 1440,200" fill="none" stroke="#8f89c9" strokeWidth="2" opacity=".7"/>
    </g>
  </svg>

  <div className="scene" id="scene">
    <div className="coin-wrap c-disc"   data-depth="0.05" data-amp="10" data-tilt="62"><div className="coin t-glass"   data-t="20"></div></div>
    <div className="coin-wrap c-violet" data-phys="" data-depth="0.12" data-amp="14" data-tilt="-22"><div className="coin t-violet" data-t="22" data-icon="i-o"></div></div>
    <div className="coin-wrap c-gold" data-phys=""   data-depth="0.08" data-amp="12" data-tilt="18"><div className="coin t-gold"   data-t="20" data-icon="i-rupee"></div></div>
    <div className="coin-wrap c-blush" data-phys=""  data-depth="0.15" data-amp="12" data-tilt="-14"><div className="coin t-blush"  data-t="20" data-icon="i-box"></div></div>
    <div className="coin-wrap c-pink" data-phys=""   data-depth="0.10" data-amp="16" data-tilt="22"><div className="coin t-pink"   data-t="20" data-icon="i-chart"></div></div>
    <div className="coin-wrap c-small" data-phys=""  data-depth="0.04" data-amp="8"  data-tilt="30"><div className="coin t-gold"   data-t="16" data-icon="i-cart"></div></div>
  </div>

  <div className="hero-text">
    <h1 className="rise d1">A new era of<br />business management</h1>
    <p className="rise d2">The world's most connected ERP to help you run finance, sales, inventory and people — in one platform.</p>
    <a href="#contact" className="btn rise d3">Request a demo</a>
  </div>
</section>

{/* ================= MODULES ================= */}
<section className="modules" id="solutions">
  <div className="container mod-layout">
    <div className="mod-head reveal">
      <span className="label">The Optiva platform</span>
      <h2>Connected business functions. One source of truth.</h2>
      <p className="intro">Replace disconnected systems and spreadsheets with a common platform for managing your core business processes.</p>
      <div className="rule"><i style={{background:'#17c3b8'} as CSSProperties}></i><i style={{background:'#ffd23f'} as CSSProperties}></i><i style={{background:'#b57be0'} as CSSProperties}></i><i style={{background:'#ff9a2f'} as CSSProperties}></i><i style={{background:'#ff5a5f'} as CSSProperties}></i><i style={{background:'#1f7fd1'} as CSSProperties}></i></div>
    </div>

    <div className="mod-grid">
        <article className="mcard reveal" style={{'--g1':'#2fd0c0','--g2':'#ffd23f'} as CSSProperties}>
          <span className="hex"><b>01</b></span>
          <h3>Finance &amp; Accounting</h3>
          <p>General ledger, invoicing, expenses, payments, receivables, tax and financial reporting.</p>
        </article>
        <article className="mcard reveal" style={{'--g1':'#ff5a5f','--g2':'#ffc93c'} as CSSProperties}>
          <span className="hex"><b>02</b></span>
          <h3>Sales &amp; CRM</h3>
          <p>Manage customers, leads, opportunities, quotations, orders and sales activities.</p>
        </article>
        <article className="mcard reveal" style={{'--g1':'#8a3fd1','--g2':'#1fc8c0'} as CSSProperties}>
          <span className="hex"><b>03</b></span>
          <h3>Procurement</h3>
          <p>Manage suppliers, purchase requests, purchase orders, approvals and purchasing cycles.</p>
        </article>
        <article className="mcard reveal" style={{'--g1':'#1f7fd1','--g2':'#c07be0'} as CSSProperties}>
          <span className="hex"><b>04</b></span>
          <h3>Inventory</h3>
          <p>Track products, warehouses, stock movements, batches, serial numbers and replenishment.</p>
        </article>
        <article className="mcard reveal" style={{'--g1':'#ffd01f','--g2':'#ff9a2f'} as CSSProperties}>
          <span className="hex"><b>05</b></span>
          <h3>Human Resources</h3>
          <p>Employee records, attendance, leave, payroll, performance and workforce administration.</p>
        </article>
        <article className="mcard reveal" style={{'--g1':'#2fd0c0','--g2':'#ff5a5f'} as CSSProperties}>
          <span className="hex"><b>06</b></span>
          <h3>Operations</h3>
          <p>Coordinate projects, tasks, approvals and operational processes across teams.</p>
        </article>
        <article className="mcard reveal" style={{'--g1':'#ff6b9a','--g2':'#8f7bea'} as CSSProperties}>
          <span className="hex"><b>07</b></span>
          <h3>Customer Service</h3>
          <p>Manage service requests, support tickets, SLAs, conversations and customer history.</p>
        </article>
        <article className="mcard reveal" style={{'--g1':'#3fbf8f','--g2':'#4fb0e8'} as CSSProperties}>
          <span className="hex"><b>08</b></span>
          <h3>Analytics</h3>
          <p>Monitor KPIs, performance, trends, financial results and operational activity.</p>
        </article>
    </div>
  </div>
</section>
{/* ================= PLATFORM ================= */}
<section className="platform sky" id="platform">
  
  <div className="arc" aria-hidden="true"></div>

  <div className="container sky-inner">
    <span className="sky-badge reveal"><i></i>Built as one system <b>›</b></span>
    <h2 className="reveal"><em>Business processes</em><br />that work <em>together.</em></h2>
    <p className="sky-intro reveal">Every Optiva module works from a shared business model, so information moves naturally from one process to the next.</p>
    <div className="rule" style={{justifyContent:'center',marginTop:'30px'} as CSSProperties}><i style={{background:'#17c3b8'} as CSSProperties}></i><i style={{background:'#ffd23f'} as CSSProperties}></i><i style={{background:'#b57be0'} as CSSProperties}></i><i style={{background:'#ff9a2f'} as CSSProperties}></i><i style={{background:'#ff5a5f'} as CSSProperties}></i><i style={{background:'#1f7fd1'} as CSSProperties}></i></div>
    <div className="sky-cta reveal">
      <a href="#contact" className="pbtn solid">Request a demo</a>
      <a href="#solutions" className="pbtn line"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#fff" strokeWidth="1.4"><circle cx="9" cy="9" r="7.5"/><path d="M7.5 6l4 3-4 3z" fill="#fff"/></svg>Explore the modules</a>
    </div>

    <div className="dash reveal">
      <div className="gcard g-main">
        <div className="g-top"><span>▣ This month</span><svg viewBox="0 0 16 16"><path d="M3 13V8M8 13V3M13 13v-7"/></svg></div>
        <div className="g-body">
          <div>
            <div className="g-big">₹24.8M</div>
            <div className="g-sub">Total revenue <em>+18.4%</em></div>
            <div className="g-track"><i></i>On track</div>
          </div>
          <div className="g-chart">
            <svg viewBox="0 0 200 80">
              <path className="base" d="M0,40 C20,36 35,18 62,22 S98,48 118,42 S152,16 172,22 S192,30 200,26"/>
              <path className="live" pathLength="1" d="M0,54 C20,48 30,64 55,58 S90,36 110,44 S142,64 166,54 S190,42 200,40"/>
              <g transform="translate(78,6)"><rect width="34" height="14" rx="4" fill="#0e1330"/><text x="17" y="10" textAnchor="middle" fill="#fff" fontSize="7" fontFamily="Inter">₹3.2M</text></g>
              <circle cx="98" cy="40" r="3" fill="#fff" stroke="#1a62ff" strokeWidth="1.6"/>
            </svg>
            <div className="g-months"><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span></div>
          </div>
        </div>
      </div>

      <div className="g-row">
        <div className="gcard g-small">
          <h4>Receivables status</h4>
          <div className="g-money">₹3.2M <em>-7.8%</em></div>
          <div className="g-date">Updated today, 19:59</div>
          <svg className="g-spark" viewBox="0 0 200 50" preserveAspectRatio="none">
            <defs><linearGradient id="sp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8f7bea" stopOpacity=".45"/><stop offset="1" stopColor="#8f7bea" stopOpacity=".04"/></linearGradient></defs>
            <polygon points="0,50 0.0,38 6.9,30 13.8,36 20.7,22 27.6,34 34.5,28 41.4,40 48.3,24 55.2,32 62.1,18 69.0,30 75.9,26 82.8,36 89.7,20 96.6,28 103.4,34 110.3,16 117.2,30 124.1,24 131.0,38 137.9,28 144.8,34 151.7,26 158.6,32 165.5,22 172.4,30 179.3,26 186.2,34 193.1,28 200.0,30 200,50" fill="url(#sp)"/>
            <polyline points="0.0,38 6.9,30 13.8,36 20.7,22 27.6,34 34.5,28 41.4,40 48.3,24 55.2,32 62.1,18 69.0,30 75.9,26 82.8,36 89.7,20 96.6,28 103.4,34 110.3,16 117.2,30 124.1,24 131.0,38 137.9,28 144.8,34 151.7,26 158.6,32 165.5,22 172.4,30 179.3,26 186.2,34 193.1,28 200.0,30" fill="none" stroke="#8f7bea" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="gcard g-small">
          <h4>Order fulfilment</h4>
          <div className="g-donut">
            <div className="g-legend"><span style={{color:'#ffab1f'} as CSSProperties}>Pending</span><span style={{color:'#2fd0c0'} as CSSProperties}>In transit</span><span style={{color:'#8a6fe8'} as CSSProperties}>Delivered</span></div>
            <svg className="dn" viewBox="0 0 100 100">
              <circle className="a" cx="50" cy="50" r="38" stroke="#ffab1f" pathLength="100" style={{strokeDashoffset:'0'} as CSSProperties}/>
              <circle className="b" cx="50" cy="50" r="38" stroke="#2fd0c0" pathLength="100" style={{strokeDashoffset:'-30'} as CSSProperties}/>
              <circle className="c" cx="50" cy="50" r="38" stroke="#8a6fe8" pathLength="100" style={{strokeDashoffset:'-62'} as CSSProperties}/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div className="sky-steps">
      <div className="sstep reveal"><span className="hexb" style={{'--g1':'#2fd0c0','--g2':'#ffd23f'} as CSSProperties}><b>01</b></span><div><h4>Shared business data</h4><p>Customers, products, suppliers and financial records remain connected.</p></div></div>
      <div className="sstep reveal"><span className="hexb" style={{'--g1':'#ff5a5f','--g2':'#ffc93c'} as CSSProperties}><b>02</b></span><div><h4>Process continuity</h4><p>Sales, purchasing, inventory and finance follow one operational flow.</p></div></div>
      <div className="sstep reveal"><span className="hexb" style={{'--g1':'#8a3fd1','--g2':'#1fc8c0'} as CSSProperties}><b>03</b></span><div><h4>Governed access</h4><p>Roles, approvals and permissions keep important actions controlled.</p></div></div>
    </div>
  </div>
</section>

{/* ================= AI ================= */}
<section className="ai" id="ai">
  <div className="ai-bg" aria-hidden="true"></div>
  <div className="ai-glow" aria-hidden="true"></div>
  <div className="cube-wrap cube-a" aria-hidden="true"><div className="cube"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
  <div className="cube-wrap cube-b" aria-hidden="true"><div className="cube"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
  <div className="container ai-grid">
    <div className="reveal">
      <div className="ai-kicker">AI &amp; automation</div>
      <h2>Intelligence where your teams already work.</h2>
      <div className="rule"><i style={{background:'#17c3b8'} as CSSProperties}></i><i style={{background:'#ffd23f'} as CSSProperties}></i><i style={{background:'#b57be0'} as CSSProperties}></i><i style={{background:'#ff9a2f'} as CSSProperties}></i><i style={{background:'#ff5a5f'} as CSSProperties}></i><i style={{background:'#1f7fd1'} as CSSProperties}></i></div>
      <p className="ai-copy">Optiva adds an intelligent layer to everyday processes, helping teams find information, understand performance and automate approved actions.</p>
    </div>
    <div className="feats">
      <div className="feat reveal">
        <span className="orb" style={{'--g1':'#2fd0c0','--g2':'#ffd23f'} as CSSProperties}><svg viewBox="0 0 48 48"><path d="M7 9h26a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H21l-8 7v-7H7a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3z"/><path d="M12 24l5-6 5 4 7-8"/></svg></span>
        <div><h4>Natural-language analytics</h4><p>Ask questions about business performance in everyday language and get answers from live data.</p></div>
      </div>
      <div className="feat reveal">
        <span className="orb" style={{'--g1':'#ff5a5f','--g2':'#ffc93c'} as CSSProperties}><svg viewBox="0 0 48 48"><circle cx="10" cy="12" r="5"/><circle cx="38" cy="24" r="5"/><circle cx="10" cy="38" r="5"/><path d="M15 13c10 0 10 11 18 11M15 37c10 0 10-11 18-11"/></svg></span>
        <div><h4>Workflow automation</h4><p>Connect triggers, conditions, approvals and actions across departments without manual hand-offs.</p></div>
      </div>
      <div className="feat reveal">
        <span className="orb" style={{'--g1':'#8a3fd1','--g2':'#1fc8c0'} as CSSProperties}><svg viewBox="0 0 48 48"><rect x="9" y="15" width="30" height="24" rx="7"/><path d="M24 15V8"/><circle cx="24" cy="6" r="2.5"/><circle cx="18" cy="26" r="2.5"/><circle cx="30" cy="26" r="2.5"/><path d="M18 33h12M4 25v6M44 25v6"/></svg></span>
        <div><h4>Business agents</h4><p>Deploy controlled AI assistants for finance, sales, support and operations, always within permissions.</p></div>
      </div>
    </div>
  </div>
</section>

{/* ================= INDUSTRIES ================= */}
<section id="industries">
  <div className="container">
    <div className="center reveal">
      <span className="label">Industry solutions</span>
      <h2>Designed for different ways of doing business.</h2>
      <p className="intro">Configure the platform around your processes, teams and operating model.</p>
      <div className="rule" style={{justifyContent:'center'} as CSSProperties}><i style={{background:'#17c3b8'} as CSSProperties}></i><i style={{background:'#ffd23f'} as CSSProperties}></i><i style={{background:'#b57be0'} as CSSProperties}></i><i style={{background:'#ff9a2f'} as CSSProperties}></i><i style={{background:'#ff5a5f'} as CSSProperties}></i><i style={{background:'#1f7fd1'} as CSSProperties}></i></div>
    </div>
    <div className="pillars">
      <article className="pillar reveal active" style={{'--g1':'#2fd0c0','--g2':'#ffd23f'} as CSSProperties} tabIndex={0}>
        <div className="tab"><b>Manufacturing</b><i><svg viewBox="0 0 24 24"><path d="M3 21V10l6 3V10l6 3V6h3l3 2v13z"/><path d="M7 17h2M12 17h2M17 17h1"/></svg></i></div>
        <h3>Produce</h3>
        <p>Production, inventory, procurement and operational control, from raw materials to finished goods.</p>
      </article>
      <article className="pillar revealNone" style={{'--g1':'#ff5a5f','--g2':'#ffc93c'} as CSSProperties} tabIndex={0}>
        <div className="tab"><b>Retail</b><i><svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg></i></div>
        <h3>Sell</h3>
        <p>Sales, inventory, purchasing, customers and finance connected across every store and channel.</p>
      </article>
      <article className="pillar revealNone" style={{'--g1':'#8a3fd1','--g2':'#1fc8c0'} as CSSProperties} tabIndex={0}>
        <div className="tab"><b>Distribution</b><i><svg viewBox="0 0 24 24"><path d="M2 6h11v10H2zM13 9h4l4 3v4h-8z"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg></i></div>
        <h3>Deliver</h3>
        <p>Orders, warehouses, suppliers and fulfilment moving together from stock to doorstep.</p>
      </article>
      <article className="pillar revealNone" style={{'--g1':'#1f7fd1','--g2':'#c07be0'} as CSSProperties} tabIndex={0}>
        <div className="tab"><b>Professional Services</b><i><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 13h18"/></svg></i></div>
        <h3>Bill</h3>
        <p>Projects, people, billing, customers and operations kept in a single working flow.</p>
      </article>
      <article className="pillar revealNone" style={{'--g1':'#ffd01f','--g2':'#ff9a2f'} as CSSProperties} tabIndex={0}>
        <div className="tab"><b>Growing Enterprises</b><i><svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg></i></div>
        <h3>Scale</h3>
        <p>A connected foundation for scaling business operations as your teams and markets grow.</p>
      </article>
    </div>
  </div>
</section>

{/* ================= CTA ================= */}
<section className="cta" id="contact">
  <div className="container">
    <div className="cta-box reveal">
      <div className="coin-wrap cta-coin-l" data-amp="10" data-tilt="20"><div className="coin t-gold" data-t="16" data-icon="i-rupee"></div></div>
      <div className="coin-wrap cta-coin-r" data-amp="12" data-tilt="-20"><div className="coin t-pink" data-t="18" data-icon="i-chart"></div></div>
      <span className="label" style={{background:'rgba(255,255,255,.14)',color:'#e5defe'} as CSSProperties}>Optiva ERP · by Agentosys</span>
      <h2>Bring your business together.</h2>
      <div className="rule" style={{justifyContent:'center',margin:'26px 0 0'} as CSSProperties}><i style={{background:'#17c3b8'} as CSSProperties}></i><i style={{background:'#ffd23f'} as CSSProperties}></i><i style={{background:'#b57be0'} as CSSProperties}></i><i style={{background:'#ff9a2f'} as CSSProperties}></i><i style={{background:'#ff5a5f'} as CSSProperties}></i><i style={{background:'#1f7fd1'} as CSSProperties}></i></div>
      <p className="intro">Talk to our team about building an ERP environment around your organization's needs.</p>
      <div className="cta-actions">
        <a className="btn" href="mailto:hello@agentosys.in">Talk to an Optiva expert</a>
        <a className="btn ghost" href="#platform">Explore the platform</a>
      </div>
    </div>
  </div>
</section>

</main>

<footer>
  <div className="container">
    <div className="f-grid">
      <div>
        <a href="#" className="brand" aria-label="Optiva ERP home"><img src="/logo.png" alt="Optiva ERP" width="1000" height="220" /></a>
        <p>Enterprise resource planning designed to connect the way modern businesses operate.</p>
      </div>
      <div><h4>PLATFORM</h4><a href="#solutions">Finance</a><a href="#solutions">Sales &amp; CRM</a><a href="#solutions">Inventory</a><a href="#solutions">Procurement</a></div>
      <div><h4>SOLUTIONS</h4><a href="#industries">Manufacturing</a><a href="#industries">Retail</a><a href="#industries">Distribution</a><a href="#industries">Services</a></div>
      <div><h4>COMPANY</h4><a href="#">About Agentosys</a><a href="#">Security</a><a href="#">Documentation</a><a href="#contact">Contact</a></div>
    </div>
    <div className="copy"><span>© 2026 Agentosys. Optiva ERP.</span><span>Privacy · Terms · Security</span></div>
  </div>
</footer>


    </div>
  )
}
