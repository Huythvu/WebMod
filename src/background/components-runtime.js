// WebMod reusable component library. This whole function is injected into the
// page's MAIN world via chrome.scripting.executeScript (before the user's code),
// so — like user-runtime.js — it must be fully self-contained: only page globals
// and its own nested helpers, no imports.
//
// It defines window.__webmodComponents (a map of factory functions) exactly once
// per page. user-runtime.js merges it into `webmod.ui`.

export function componentsRuntime() {
  const w = window
  if (w.__webmodComponents) return // already installed on this page
  const doc = document

  // --- small element factory (mirrors user-runtime's create()) ---------------
  function el(tag, props, children) {
    const node = doc.createElement(tag)
    if (props)
      for (const k in props) {
        const v = props[k]
        if (k === 'class' || k === 'className') node.className = v
        else if (k === 'text' || k === 'textContent') node.textContent = v
        else if (k === 'html' || k === 'innerHTML') node.innerHTML = v
        else if (k === 'style' && v && typeof v === 'object') Object.assign(node.style, v)
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v)
        else if (v === true) node.setAttribute(k, '')
        else if (v != null && v !== false) node.setAttribute(k, v)
      }
    if (children != null) {
      const arr = Array.isArray(children) ? children : [children]
      for (const c of arr) node.append(c && c.nodeType ? c : doc.createTextNode(String(c)))
    }
    return node
  }
  // Accept a string (HTML) or a Node for content slots.
  function setContent(node, content) {
    if (content == null) return
    if (content.nodeType) node.appendChild(content)
    else node.innerHTML = String(content)
  }

  // --- one-time stylesheet ----------------------------------------------------
  function ensureStyles() {
    if (doc.querySelector('style[data-webmod-components]')) return
    const style = doc.createElement('style')
    style.setAttribute('data-webmod-components', '')
    style.textContent = [
      ".wm-c{--wm-bg:#1e2128;--wm-panel:#262a33;--wm-btn:#333844;--wm-accent:#4f7cff;--wm-text:#e6e8ee;--wm-muted:#9aa1ad;--wm-border:#3a4150;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.4;color:var(--wm-text)}",
      ".wm-c *{box-sizing:border-box}",
      ".wm-btn{background:var(--wm-accent);color:#fff;border:none;border-radius:7px;padding:8px 14px;font-size:13px;cursor:pointer}",
      ".wm-btn.ghost{background:var(--wm-btn);color:var(--wm-text)}.wm-btn.danger{background:#e5534b;color:#fff}.wm-btn:hover{filter:brightness(1.08)}",
      ".wm-card{background:var(--wm-panel);border:1px solid var(--wm-border);border-radius:10px;overflow:hidden;max-width:100%}",
      ".wm-card-title{padding:12px 14px;font-weight:600;border-bottom:1px solid var(--wm-border)}.wm-card-body{padding:14px}.wm-card-footer{padding:10px 14px;border-top:1px solid var(--wm-border);background:var(--wm-bg)}",
      ".wm-toolbar{position:fixed;z-index:2147483646;display:flex;gap:6px;align-items:center;background:var(--wm-panel);border:1px solid var(--wm-border);border-radius:10px;padding:6px;box-shadow:0 6px 24px rgba(0,0,0,.35)}",
      ".wm-sidebar{position:fixed;top:0;height:100vh;z-index:2147483646;background:var(--wm-panel);border-left:1px solid var(--wm-border);box-shadow:0 0 40px rgba(0,0,0,.4);display:flex;flex-direction:column;transition:transform .22s ease;max-width:100vw}",
      ".wm-sidebar-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--wm-border);font-weight:600}.wm-sidebar-x{background:none;border:none;color:var(--wm-muted);font-size:18px;cursor:pointer}.wm-sidebar-body{padding:14px;overflow:auto;flex:1}",
      ".wm-search{display:flex}.wm-search input{width:100%;background:var(--wm-bg);border:1px solid var(--wm-border);border-radius:8px;color:var(--wm-text);padding:8px 12px;font-size:13px}",
      ".wm-select{background:var(--wm-bg);border:1px solid var(--wm-border);border-radius:8px;color:var(--wm-text);padding:8px 12px;font-size:13px}",
      ".wm-check{display:inline-flex;align-items:center;gap:8px;cursor:pointer}.wm-check input{width:15px;height:15px}",
      ".wm-tabs-nav{display:flex;gap:4px;border-bottom:1px solid var(--wm-border)}.wm-tabs-tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--wm-muted);padding:8px 14px;cursor:pointer;font-size:13px}.wm-tabs-tab.active{color:var(--wm-text);border-bottom-color:var(--wm-accent)}.wm-tabs-panel{padding:12px 2px}",
      ".wm-acc-item{border:1px solid var(--wm-border);border-radius:8px;margin-bottom:6px;overflow:hidden}.wm-acc-head{width:100%;text-align:left;background:var(--wm-panel);border:none;color:var(--wm-text);padding:10px 14px;cursor:pointer;font-size:13px}.wm-acc-body{padding:12px 14px;background:var(--wm-bg)}",
      ".wm-table{border-collapse:collapse;width:100%}.wm-table th,.wm-table td{border:1px solid var(--wm-border);padding:7px 10px;text-align:left}.wm-table th{background:var(--wm-panel);font-weight:600}",
      ".wm-progress{background:var(--wm-btn);border-radius:999px;height:10px;position:relative;overflow:hidden;min-width:120px}.wm-progress-bar{background:var(--wm-accent);height:100%;width:0;transition:width .2s ease}.wm-progress-label{position:absolute;inset:0;display:none}",
    ].join('')
    ;(doc.head || doc.documentElement).appendChild(style)
  }
  ensureStyles()

  // --- static components ------------------------------------------------------
  function button(o) {
    o = o || {}
    const b = el('button', { class: 'wm-c wm-btn ' + (o.variant || 'primary'), text: o.text || 'Button' })
    if (o.onClick) b.addEventListener('click', o.onClick)
    return b
  }

  function card(o) {
    o = o || {}
    const c = el('div', { class: 'wm-c wm-card' })
    if (o.title) c.appendChild(el('div', { class: 'wm-card-title', text: o.title }))
    const body = el('div', { class: 'wm-card-body' })
    setContent(body, o.body)
    c.appendChild(body)
    if (o.footer != null) {
      const f = el('div', { class: 'wm-card-footer' })
      setContent(f, o.footer)
      c.appendChild(f)
    }
    return c
  }

  function searchBox(o) {
    o = o || {}
    const wrap = el('div', { class: 'wm-c wm-search' })
    const input = el('input', { type: 'search', placeholder: o.placeholder || 'Search…', value: o.value || '' })
    if (o.onInput) input.addEventListener('input', (e) => o.onInput(e.target.value, e))
    if (o.onSubmit) input.addEventListener('keydown', (e) => e.key === 'Enter' && o.onSubmit(e.target.value, e))
    wrap.appendChild(input)
    wrap.input = input
    return wrap
  }

  function dropdown(o) {
    o = o || {}
    const sel = el('select', { class: 'wm-c wm-select' })
    ;(o.options || []).forEach((opt) => {
      const val = opt && typeof opt === 'object' ? opt.value : opt
      const label = opt && typeof opt === 'object' ? opt.label : opt
      const oe = el('option', { value: val, text: label })
      if (o.value != null && String(o.value) === String(val)) oe.selected = true
      sel.appendChild(oe)
    })
    if (o.onChange) sel.addEventListener('change', (e) => o.onChange(e.target.value, e))
    return sel
  }

  function checkbox(o) {
    o = o || {}
    const lab = el('label', { class: 'wm-c wm-check' })
    const input = el('input', { type: 'checkbox' })
    input.checked = !!o.checked
    if (o.onChange) input.addEventListener('change', (e) => o.onChange(e.target.checked, e))
    lab.appendChild(input)
    lab.appendChild(el('span', { text: o.label || '' }))
    lab.input = input
    return lab
  }

  // --- floating / interactive components --------------------------------------
  function toolbar(o) {
    o = o || {}
    const bar = el('div', { class: 'wm-c wm-toolbar' })
    bar.style.left = '50%'
    bar.style.transform = 'translateX(-50%)'
    if ((o.position || 'top') === 'bottom') bar.style.bottom = '16px'
    else bar.style.top = '16px'
    ;(o.items || []).forEach((it) => {
      if (it && it.nodeType) bar.appendChild(it)
      else bar.appendChild(button({ text: it.text, onClick: it.onClick, variant: it.variant || 'ghost' }))
    })
    ;(doc.body || doc.documentElement).appendChild(bar)
    return { element: bar, remove: () => bar.remove() }
  }

  function sidebar(o) {
    o = o || {}
    const side = o.side === 'left' ? 'left' : 'right'
    const panel = el('div', { class: 'wm-c wm-sidebar' })
    panel.style.width = (o.width || 320) + 'px'
    panel.style[side] = '0'
    const hidden = side === 'right' ? 'translateX(100%)' : 'translateX(-100%)'
    panel.style.transform = hidden
    if (side === 'left') panel.style.borderLeft = 'none'
    const head = el('div', { class: 'wm-sidebar-head' })
    head.appendChild(el('span', { text: o.title || '' }))
    const x = el('button', { class: 'wm-sidebar-x', text: '×' })
    head.appendChild(x)
    const body = el('div', { class: 'wm-sidebar-body' })
    setContent(body, o.content)
    panel.appendChild(head)
    panel.appendChild(body)
    ;(doc.body || doc.documentElement).appendChild(panel)
    const open = () => (panel.style.transform = 'translateX(0)')
    const close = () => (panel.style.transform = hidden)
    let isOpen = false
    x.addEventListener('click', () => {
      isOpen = false
      close()
    })
    requestAnimationFrame(() => {
      isOpen = true
      open()
    })
    return {
      element: panel,
      open: () => ((isOpen = true), open()),
      close: () => ((isOpen = false), close()),
      toggle: () => ((isOpen = !isOpen), isOpen ? open() : close()),
      remove: () => panel.remove(),
    }
  }

  function tabs(o) {
    o = o || {}
    const root = el('div', { class: 'wm-c wm-tabs' })
    const nav = el('div', { class: 'wm-tabs-nav' })
    const panelsWrap = el('div', { class: 'wm-tabs-panels' })
    const navBtns = []
    const panels = []
    ;(o.tabs || []).forEach((t, i) => {
      const b = el('button', { class: 'wm-tabs-tab', text: t.label || 'Tab ' + (i + 1) })
      const p = el('div', { class: 'wm-tabs-panel' })
      setContent(p, t.content)
      b.addEventListener('click', () => select(i))
      nav.appendChild(b)
      panelsWrap.appendChild(p)
      navBtns.push(b)
      panels.push(p)
    })
    function select(i) {
      navBtns.forEach((b, j) => b.classList.toggle('active', j === i))
      panels.forEach((p, j) => (p.style.display = j === i ? 'block' : 'none'))
    }
    root.appendChild(nav)
    root.appendChild(panelsWrap)
    if (navBtns.length) select(0)
    return { element: root, select }
  }

  function accordion(o) {
    o = o || {}
    const root = el('div', { class: 'wm-c wm-acc' })
    ;(o.items || []).forEach((it) => {
      const item = el('div', { class: 'wm-acc-item' })
      const head = el('button', { class: 'wm-acc-head', text: it.title || '' })
      const body = el('div', { class: 'wm-acc-body' })
      setContent(body, it.content)
      body.style.display = 'none'
      head.addEventListener('click', () => {
        const isOpen = body.style.display !== 'none'
        if (!o.multi) root.querySelectorAll('.wm-acc-body').forEach((b) => (b.style.display = 'none'))
        body.style.display = isOpen ? 'none' : 'block'
      })
      item.appendChild(head)
      item.appendChild(body)
      root.appendChild(item)
    })
    return { element: root }
  }

  function table(o) {
    o = o || {}
    const cols = (o.columns || []).map((c) => (c && typeof c === 'object' ? c : { label: c, key: c }))
    const root = el('table', { class: 'wm-c wm-table' })
    const thead = el('thead')
    const htr = el('tr')
    cols.forEach((c) => htr.appendChild(el('th', { text: c.label })))
    thead.appendChild(htr)
    const tbody = el('tbody')
    root.appendChild(thead)
    root.appendChild(tbody)
    function setRows(rows) {
      tbody.innerHTML = ''
      ;(rows || []).forEach((r) => {
        const tr = el('tr')
        cols.forEach((c, i) => {
          const val = Array.isArray(r) ? r[i] : r[c.key]
          const td = el('td')
          if (val && val.nodeType) td.appendChild(val)
          else td.textContent = val == null ? '' : String(val)
          tr.appendChild(td)
        })
        tbody.appendChild(tr)
      })
    }
    setRows(o.rows || [])
    return { element: root, setRows }
  }

  function progress(o) {
    o = o || {}
    const max = o.max || 100
    const root = el('div', { class: 'wm-c wm-progress' })
    const bar = el('div', { class: 'wm-progress-bar' })
    root.appendChild(bar)
    root.setAttribute('role', 'progressbar')
    root.setAttribute('aria-valuemin', '0')
    root.setAttribute('aria-valuemax', String(max))
    function set(v) {
      v = Math.max(0, Math.min(max, Number(v) || 0))
      bar.style.width = (v / max) * 100 + '%'
      root.setAttribute('aria-valuenow', String(v))
    }
    set(o.value || 0)
    return { element: root, set }
  }

  w.__webmodComponents = {
    button,
    card,
    searchBox,
    dropdown,
    checkbox,
    toolbar,
    sidebar,
    tabs,
    accordion,
    table,
    progress,
  }
}
