/* ============================================================
   Sistema CEC — Manual do Cliente (site público)
   Estilo central de ajuda: acordeões + página de artigo única
   ============================================================ */
(function () {
  const client = window.cecClient;
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  const ICON = {
    caret: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg>',
    doc: '<svg class="doc-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    arrow: '<svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    clock: '<svg class="clock" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
  };

  const el = {
    nav: document.getElementById('nav'),
    main: document.getElementById('main'),
    search: document.getElementById('searchInput'),
    sidebar: document.getElementById('sidebar'),
    backdrop: document.getElementById('backdrop'),
    menuToggle: document.getElementById('menuToggle'),
    lightbox: document.getElementById('lightbox'),
    lightboxImg: document.getElementById('lightboxImg'),
  };

  let sections = [];
  let bySlug = {};
  let byId = {};

  function esc(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function stripHtml(html) { const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent || ''; }
  function partLabel(n) { return 'PARTE ' + (ROMAN[n] || n); }
  function cleanPartTitle(t) { const m = (t || '').match(/^PARTE\s+[IVXLC]+\s*[–-]\s*(.+)$/i); return m ? m[1] : t; }
  function fmtDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function ancestorsOf(sec) { const c = []; let cur = sec; while (cur && cur.parent_id) { cur = byId[cur.parent_id]; if (cur) c.unshift(cur); } return c; }
  function childrenOf(id) { return sections.filter(s => s.parent_id === id); }
  function descendantsCount(id) { let n = 0; childrenOf(id).forEach(c => { n += 1 + descendantsCount(c.id); }); return n; }

  async function load() {
    const { data, error } = await client.from('sections').select('*').order('position', { ascending: true });
    if (error) {
      el.main.innerHTML = '<div class="empty-state">Erro ao carregar o manual.<br><small>' + esc(error.message) + '</small></div>';
      el.nav.innerHTML = ''; return;
    }
    sections = data || [];
    bySlug = {}; byId = {};
    sections.forEach(s => { bySlug[s.slug] = s; byId[s.id] = s; });
    renderNav();
    route();
  }

  /* ---------- Barra lateral (acordeão claro) ---------- */
  function renderNav() {
    const parts = sections.filter(s => s.level === 0);
    if (!parts.length) { el.nav.innerHTML = '<div class="nav-empty">Nenhum conteúdo publicado ainda.</div>'; return; }
    let html = '';
    parts.forEach(part => {
      const kids = childrenOf(part.id);
      html += '<div class="nav-part collapsed" data-part="' + part.id + '">';
      html += '<button class="nav-part-head">';
      html += part.part_number ? '<span class="pnum">' + (ROMAN[part.part_number] || part.part_number) + '</span>' : '';
      html += '<span class="ptitle">' + esc(cleanPartTitle(part.title)) + '</span>';
      html += '<span class="caret">' + ICON.caret + '</span>';
      html += '</button><div class="nav-children">';
      html += '<a class="nav-link" data-slug="' + esc(part.slug) + '">Visão geral</a>';
      html += renderNavChildren(part.id);
      html += '</div></div>';
    });
    el.nav.innerHTML = html;
    el.nav.querySelectorAll('.nav-part-head').forEach(btn =>
      btn.addEventListener('click', () => btn.closest('.nav-part').classList.toggle('collapsed')));
    el.nav.querySelectorAll('.nav-link').forEach(a =>
      a.addEventListener('click', e => { e.preventDefault(); location.hash = a.dataset.slug; closeSidebar(); }));
  }
  function renderNavChildren(parentId) {
    let html = '';
    childrenOf(parentId).forEach(ch => {
      html += '<a class="nav-link lvl-' + Math.min(ch.level, 3) + '" data-slug="' + esc(ch.slug) + '">' + esc(ch.title) + '</a>';
      html += renderNavChildren(ch.id);
    });
    return html;
  }
  function highlightNav(slug) {
    el.nav.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.slug === slug));
    const active = el.nav.querySelector('.nav-link.active');
    if (active) { const p = active.closest('.nav-part'); if (p) p.classList.remove('collapsed'); active.scrollIntoView({ block: 'nearest' }); }
  }

  /* ---------- Roteamento ---------- */
  function route() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, '')).trim();
    if (!hash || hash === 'home') return renderHome();
    if (hash.startsWith('busca:')) return renderSearch(hash.slice(6));
    const sec = bySlug[hash];
    if (!sec) return renderHome();
    renderSection(sec);
  }

  /* ---------- Home (acordeão de PARTES) ---------- */
  function renderHome() {
    highlightNav(null);
    const parts = sections.filter(s => s.level === 0);
    let acc = '<div class="accordion">';
    parts.forEach(p => {
      const kids = childrenOf(p.id);
      const count = descendantsCount(p.id);
      const label = p.part_number ? (ROMAN[p.part_number] || p.part_number) : '•';
      if (kids.length) {
        acc += '<div class="acc-item" data-id="' + p.id + '">';
        acc += '<button class="acc-head js-toggle"><span class="acc-ico">' + label + '</span>' +
          '<span class="acc-t">' + esc(cleanPartTitle(p.title)) + '</span>' +
          '<span class="acc-count">' + count + ' artigo' + (count === 1 ? '' : 's') + '</span>' +
          '<span class="acc-caret">' + ICON.caret + '</span></button>';
        acc += '<div class="acc-body">' + accArticles(p.id, 0) + '</div></div>';
      } else {
        // PARTE sem filhos = artigo direto
        acc += '<div class="acc-item"><button class="acc-head js-open" data-slug="' + esc(p.slug) + '">' +
          '<span class="acc-ico">' + label + '</span><span class="acc-t">' + esc(cleanPartTitle(p.title)) + '</span>' +
          ICON.arrow + '</button></div>';
      }
    });
    acc += '</div>';

    el.main.innerHTML =
      '<div class="hero"><h1>Central de Ajuda — Sistema CEC</h1>' +
      '<p>Encontre respostas sobre configuração, cadastros, compras, vendas, sistema financeiro, autorizações e relatórios do sistema CEC.</p></div>' +
      '<h2 style="font-size:1.35rem;margin:0 0 16px">Navegue por tema</h2>' + acc;

    bindAccordion();
    scrollTop();
  }
  function accArticles(parentId, depth) {
    let html = '';
    childrenOf(parentId).forEach(ch => {
      html += '<a class="acc-article' + (depth ? ' acc-sub' : '') + '" data-slug="' + esc(ch.slug) + '">' +
        ICON.doc + '<span>' + esc(ch.title) + '</span>' + ICON.arrow + '</a>';
      html += accArticles(ch.id, depth + 1);
    });
    return html;
  }
  function bindAccordion() {
    el.main.querySelectorAll('.acc-head.js-toggle').forEach(h =>
      h.addEventListener('click', () => h.closest('.acc-item').classList.toggle('open')));
    el.main.querySelectorAll('[data-slug]').forEach(a =>
      a.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); location.hash = a.dataset.slug; }));
  }

  /* ---------- Página de artigo ---------- */
  function renderSection(sec) {
    highlightNav(sec.slug);
    const chain = ancestorsOf(sec);
    let crumb = '<a href="#home">Início</a>';
    chain.forEach(a => { crumb += ' <span class="sep">›</span> <a href="#' + esc(a.slug) + '">' + esc(cleanPartTitle(a.title)) + '</a>'; });
    crumb += ' <span class="sep">›</span> <span>' + esc(sec.title) + '</span>';

    const hasContent = sec.content && sec.content.trim();
    let body = hasContent ? sec.content : '';
    const kids = childrenOf(sec.id);

    // ToC "Neste artigo" a partir de h2/h3 do conteúdo
    const tmp = document.createElement('div'); tmp.innerHTML = body;
    const heads = Array.from(tmp.querySelectorAll('h2, h3'));
    let toc = '';
    if (heads.length >= 2) {
      heads.forEach((h, i) => { const id = 'sec-' + i; h.id = id; });
      body = tmp.innerHTML;
      toc = '<aside class="toc"><h4>Neste artigo</h4>' +
        heads.map((h, i) => '<a href="#sec-' + i + '" class="toc-link">' + esc(h.textContent) + '</a>').join('') + '</aside>';
    }

    if (!hasContent && !kids.length) body = '<p class="dim">Este tópico ainda não possui conteúdo.</p>';

    // "Tópicos desta seção" (filhos) ou "Artigos desta seção" (irmãos)
    let listTitle = '', listItems = [];
    if (kids.length) { listTitle = 'Tópicos desta seção'; listItems = kids; }
    else if (sec.parent_id) { listTitle = 'Artigos desta seção'; listItems = childrenOf(sec.parent_id); }
    let sectionList = '';
    if (listItems.length) {
      sectionList = '<div class="section-articles"><h3>' + listTitle + '</h3><div class="sa-list">' +
        listItems.map(k => {
          const cur = k.id === sec.id;
          return '<a class="sa-item' + (cur ? ' current' : '') + '"' + (cur ? '' : ' data-slug="' + esc(k.slug) + '"') + '>' +
            ICON.doc + '<span>' + esc(k.title) + '</span>' + (cur ? '' : ICON.arrow) + '</a>';
        }).join('') + '</div></div>';
    }

    const helpful =
      '<div class="article-footer"><div class="helpful" data-slug="' + esc(sec.slug) + '">' +
      '<strong>Este artigo foi útil?</strong>' +
      '<div class="vote-btns"><button class="vote" data-v="1">👍 Sim</button><button class="vote" data-v="0">👎 Não</button></div>' +
      '</div></div>';

    const idx = sections.indexOf(sec);
    const prev = sections[idx - 1], next = sections[idx + 1];
    const pager = '<div class="pager">' +
      (prev ? '<a href="#' + esc(prev.slug) + '"><div class="dir">‹ Anterior</div><div class="ttl">' + esc(prev.title) + '</div></a>' : '<span class="disabled"></span>') +
      (next ? '<a class="next" href="#' + esc(next.slug) + '"><div class="dir">Próximo ›</div><div class="ttl">' + esc(next.title) + '</div></a>' : '<span class="disabled"></span>') +
      '</div>';

    const meta = ICON.clock + ' Atualizado em ' + (fmtDate(sec.updated_at) || '—') + (sec.page_ref ? ' &nbsp;·&nbsp; Página ' + sec.page_ref + ' do manual' : '');

    el.main.innerHTML =
      '<div class="breadcrumb">' + crumb + '</div>' +
      '<h1 class="doc-title">' + esc(sec.title) + '</h1>' +
      '<div class="doc-meta">' + meta + '</div>' +
      '<div class="article-wrap' + (toc ? ' with-toc' : '') + '">' +
      '<div><div class="article">' + body + '</div></div>' + toc + '</div>' +
      sectionList + helpful + pager;

    // eventos
    el.main.querySelectorAll('[data-slug]').forEach(a => {
      if (a.classList.contains('vote') || a.classList.contains('helpful')) return;
      a.addEventListener('click', e => { if (a.tagName === 'A' && a.getAttribute('href')) return; e.preventDefault(); location.hash = a.dataset.slug; });
    });
    bindHelpful(sec.slug);
    bindImages();
    scrollTop();
  }

  function bindHelpful(slug) {
    const box = el.main.querySelector('.helpful');
    if (!box) return;
    const voted = localStorage.getItem('cec-vote-' + slug);
    if (voted) return showThanks(box);
    box.querySelectorAll('.vote').forEach(b => b.addEventListener('click', () => {
      localStorage.setItem('cec-vote-' + slug, b.dataset.v);
      showThanks(box);
    }));
  }
  function showThanks(box) {
    box.querySelector('.vote-btns').outerHTML = '<div class="thanks">✓ Obrigado pelo seu feedback!</div>';
  }

  /* ---------- Busca ---------- */
  function renderSearch(term) {
    highlightNav(null);
    term = term.trim();
    const q = term.toLowerCase();
    if (q.length < 2) { el.main.innerHTML = '<div class="empty-state">Digite ao menos 2 caracteres para buscar.</div>'; return; }
    const results = [];
    sections.forEach(s => {
      const title = s.title.toLowerCase();
      const text = stripHtml(s.content).toLowerCase();
      let score = 0, pos = -1;
      if (title.includes(q)) score += 10;
      pos = text.indexOf(q);
      if (pos >= 0) score += 3;
      if (score > 0) results.push({ s, pos, text, score });
    });
    results.sort((a, b) => b.score - a.score);
    let html = '<h1 class="doc-title">Busca</h1><div class="doc-meta">' + results.length + ' resultado(s) para “' + esc(term) + '”</div><div class="search-results">';
    if (!results.length) html += '<div class="empty-state">Nenhum resultado encontrado.</div>';
    results.forEach(({ s, pos, text }) => {
      const chain = ancestorsOf(s).map(a => cleanPartTitle(a.title)).join(' › ');
      let snippet = '';
      if (pos >= 0) {
        const start = Math.max(0, pos - 40);
        snippet = (start > 0 ? '…' : '') + text.slice(start, pos + q.length + 60) + '…';
        snippet = esc(snippet).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
      }
      html += '<a class="search-result" data-slug="' + esc(s.slug) + '"><div class="crumb">' + esc(chain || 'Manual') + '</div>' +
        '<div class="rt">' + esc(s.title) + '</div>' + (snippet ? '<div class="dim" style="margin-top:4px">' + snippet + '</div>' : '') + '</a>';
    });
    html += '</div>';
    el.main.innerHTML = html;
    el.main.querySelectorAll('.search-result').forEach(a => a.addEventListener('click', () => { location.hash = a.dataset.slug; }));
    scrollTop();
  }

  /* ---------- Lightbox ---------- */
  function bindImages() {
    el.main.querySelectorAll('.article figure img').forEach(img =>
      img.addEventListener('click', () => { el.lightboxImg.src = img.src; el.lightbox.classList.add('open'); }));
  }
  el.lightbox.addEventListener('click', () => el.lightbox.classList.remove('open'));

  function scrollTop() { const c = document.querySelector('.content'); if (c) c.scrollTo(0, 0); window.scrollTo(0, 0); }

  /* ---------- Busca no topo ---------- */
  let searchTimer;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const v = el.search.value.trim();
    searchTimer = setTimeout(() => {
      if (v.length >= 2) location.hash = 'busca:' + v;
      else if (location.hash.startsWith('#busca:')) location.hash = 'home';
    }, 250);
  });
  el.search.addEventListener('keydown', e => { if (e.key === 'Enter' && el.search.value.trim().length >= 2) location.hash = 'busca:' + el.search.value.trim(); });

  /* ---------- Mobile ---------- */
  function openSidebar() { el.sidebar.classList.add('open'); el.backdrop.classList.add('open'); }
  function closeSidebar() { el.sidebar.classList.remove('open'); el.backdrop.classList.remove('open'); }
  el.menuToggle.addEventListener('click', () => el.sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  el.backdrop.addEventListener('click', closeSidebar);

  window.addEventListener('hashchange', route);
  load();
})();
