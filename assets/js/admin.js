/* ============================================================
   Sistema CEC — Painel Administrativo do Manual
   ============================================================ */
(function () {
  const client = window.cecClient;
  const BUCKET = window.CEC_CONFIG.BUCKET;
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  const $ = id => document.getElementById(id);
  const el = {
    loginView: $('loginView'), appView: $('appView'), loginForm: $('loginForm'),
    loginAlert: $('loginAlert'), email: $('email'), password: $('password'), loginBtn: $('loginBtn'),
    logoutBtn: $('logoutBtn'), userEmail: $('userEmail'), adminBadge: $('adminBadge'), viewSiteBtn: $('viewSiteBtn'),
    usersBtn: $('usersBtn'), usersModal: $('usersModal'), usersClose: $('usersClose'), usersList: $('usersList'),
    usersAlert: $('usersAlert'), userAddForm: $('userAddForm'), newUserEmail: $('newUserEmail'), newUserPass: $('newUserPass'),
    tree: $('tree'), filterInput: $('filterInput'), newRootBtn: $('newRootBtn'),
    welcomePane: $('welcomePane'), editorForm: $('editorForm'), editorTitle: $('editorTitle'), editorAlert: $('editorAlert'),
    fTitle: $('fTitle'), fSlug: $('fSlug'), fParent: $('fParent'), fPage: $('fPage'),
    wyArea: $('wyArea'), htmlArea: $('htmlArea'), toolbar: $('toolbar'),
    btnHtml: $('btnHtml'), btnImage: $('btnImage'), btnScreen: $('btnScreen'), btnLink: $('btnLink'), imgInput: $('imgInput'),
    saveBtn: $('saveBtn'), deleteBtn: $('deleteBtn'), addChildBtn: $('addChildBtn'),
    moveUpBtn: $('moveUpBtn'), moveDownBtn: $('moveDownBtn'),
    modalBack: $('modalBack'), modalTitle: $('modalTitle'), modalText: $('modalText'), modalOk: $('modalOk'), modalCancel: $('modalCancel'),
    toast: $('toast'), menuToggle: $('menuToggle'), backdrop: $('backdrop'), adminList: $('adminList'),
  };

  let sections = [];
  let byId = {};
  let current = null;      // seção em edição
  let htmlMode = false;
  let savedRange = null;   // seleção salva no editor

  // ---------- helpers ----------
  function esc(s) { return (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function slugify(t) {
    return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'topico';
  }
  function uniqueSlug(base, exceptId) {
    let s = base, n = 2;
    const taken = new Set(sections.filter(x => x.id !== exceptId).map(x => x.slug));
    while (taken.has(s)) { s = base + '-' + n; n++; }
    return s;
  }
  function childrenOf(pid) { return sections.filter(s => s.parent_id === pid).sort((a, b) => a.position - b.position); }
  function descendants(id) { let r = []; childrenOf(id).forEach(c => { r.push(c); r = r.concat(descendants(c.id)); }); return r; }
  function toast(msg, type) {
    el.toast.textContent = msg; el.toast.className = 'toast show ' + (type || '');
    setTimeout(() => { el.toast.className = 'toast ' + (type || ''); }, 2600);
  }
  function alertBox(node, msg, type) {
    node.innerHTML = msg ? '<div class="alert ' + (type || 'err') + '">' + esc(msg) + '</div>' : '';
  }
  function confirmModal(title, text, okLabel) {
    return new Promise(resolve => {
      el.modalTitle.textContent = title; el.modalText.textContent = text;
      el.modalOk.textContent = okLabel || 'Confirmar';
      el.modalBack.classList.add('open');
      const done = v => { el.modalBack.classList.remove('open'); el.modalOk.onclick = null; el.modalCancel.onclick = null; resolve(v); };
      el.modalOk.onclick = () => done(true);
      el.modalCancel.onclick = () => done(false);
    });
  }

  // ---------- autenticação ----------
  async function initAuth() {
    const { data } = await client.auth.getSession();
    setSession(data.session);
    client.auth.onAuthStateChange((_e, session) => setSession(session));
  }
  function setSession(session) {
    if (session && session.user) {
      el.loginView.style.display = 'none';
      el.appView.style.display = 'flex';
      el.logoutBtn.style.display = ''; el.viewSiteBtn.style.display = ''; el.adminBadge.style.display = ''; el.usersBtn.style.display = '';
      el.userEmail.style.display = ''; el.userEmail.textContent = session.user.email;
      loadData();
    } else {
      el.appView.style.display = 'none';
      el.loginView.style.display = 'flex';
      el.logoutBtn.style.display = 'none'; el.viewSiteBtn.style.display = 'none'; el.adminBadge.style.display = 'none'; el.usersBtn.style.display = 'none';
      el.userEmail.style.display = 'none';
    }
  }
  el.loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    alertBox(el.loginAlert, '');
    el.loginBtn.disabled = true; el.loginBtn.textContent = 'Entrando...';
    const { error } = await client.auth.signInWithPassword({ email: el.email.value.trim(), password: el.password.value });
    el.loginBtn.disabled = false; el.loginBtn.textContent = 'Entrar';
    if (error) alertBox(el.loginAlert, traduzErro(error.message), 'err');
  });
  el.logoutBtn.addEventListener('click', async () => { await client.auth.signOut(); current = null; });

  function traduzErro(m) {
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'E-mail ainda não confirmado.';
    return m;
  }

  // ---------- dados ----------
  async function loadData(keepId) {
    const { data, error } = await client.from('sections').select('*').order('position', { ascending: true });
    if (error) { el.tree.innerHTML = '<div class="nav-empty">Erro: ' + esc(error.message) + '</div>'; return; }
    sections = data || [];
    byId = {}; sections.forEach(s => byId[s.id] = s);
    renderTree();
    if (keepId && byId[keepId]) selectSection(byId[keepId]);
  }

  // ---------- árvore ----------
  function renderTree() {
    const filter = el.filterInput.value.trim().toLowerCase();
    const roots = sections.filter(s => s.level === 0).sort(sortSib);
    if (!roots.length) { el.tree.innerHTML = '<div class="nav-empty">Nenhum tópico. Crie a primeira PARTE.</div>'; return; }
    let html = '';
    const walk = (node) => {
      const match = !filter || node.title.toLowerCase().includes(filter);
      const kids = childrenOf(node.id);
      const kidsHtml = kids.map(walk).join('');
      if (filter && !match && !kidsHtml) return '';
      const active = current && current.id === node.id ? ' active' : '';
      let row = '<div class="tree-row lvl-' + Math.min(node.level, 3) + active + '" data-id="' + node.id + '">';
      if (node.level === 0 && node.part_number) row += '<span class="tree-badge">' + (ROMAN[node.part_number] || node.part_number) + '</span>';
      row += '<span class="t-title">' + esc(node.title) + '</span>';
      row += '</div>';
      return row + kidsHtml;
    };
    roots.forEach(r => { html += walk(r); });
    el.tree.innerHTML = html || '<div class="nav-empty">Nenhum resultado.</div>';
    el.tree.querySelectorAll('.tree-row').forEach(r => {
      r.addEventListener('click', () => selectSection(byId[r.dataset.id]));
    });
  }
  function sortSib(a, b) {
    if (a.level === 0 && b.level === 0) return (a.part_number || 999) - (b.part_number || 999) || a.position - b.position;
    return a.position - b.position;
  }
  el.filterInput.addEventListener('input', renderTree);

  // ---------- popular select de pai ----------
  function fillParentSelect(exceptId) {
    const excluded = new Set([exceptId, ...(exceptId ? descendants(exceptId).map(d => d.id) : [])]);
    let html = '<option value="">— Nenhum (PARTE principal) —</option>';
    const roots = sections.filter(s => s.level === 0).sort(sortSib);
    const walk = (node, prefix) => {
      if (excluded.has(node.id)) return;
      if (node.level >= 3) return; // profundidade máxima de aninhamento para novos filhos
      html += '<option value="' + node.id + '">' + esc(prefix + node.title) + '</option>';
      childrenOf(node.id).forEach(c => walk(c, prefix + '— '));
    };
    roots.forEach(r => walk(r, ''));
    el.fParent.innerHTML = html;
  }

  // ---------- selecionar/editar ----------
  function selectSection(sec) {
    if (!sec) return;
    current = sec;
    el.welcomePane.style.display = 'none';
    el.editorForm.style.display = '';
    el.editorTitle.textContent = 'Editar: ' + sec.title;
    alertBox(el.editorAlert, '');
    el.fTitle.value = sec.title || '';
    el.fSlug.value = sec.slug || '';
    el.fPage.value = sec.page_ref || '';
    fillParentSelect(sec.id);
    el.fParent.value = sec.parent_id || '';
    setEditorContent(sec.content || '');
    renderTree();
    closeSidebar();
  }

  function setEditorContent(html) {
    htmlMode = false;
    el.wyArea.style.display = ''; el.htmlArea.style.display = 'none';
    el.btnHtml.classList.remove('active');
    el.wyArea.innerHTML = html;
    el.htmlArea.value = html;
  }
  function getEditorContent() {
    return htmlMode ? el.htmlArea.value : el.wyArea.innerHTML;
  }

  // ---------- salvar ----------
  el.saveBtn.addEventListener('click', async () => {
    if (!current) return;
    const title = el.fTitle.value.trim();
    if (!title) { alertBox(el.editorAlert, 'O título é obrigatório.', 'err'); return; }
    let slug = el.fSlug.value.trim() ? slugify(el.fSlug.value.trim()) : slugify(title);
    slug = uniqueSlug(slug, current.id);
    const parentId = el.fParent.value || null;
    const parent = parentId ? byId[parentId] : null;
    const level = parent ? parent.level + 1 : 0;
    let part_number = current.part_number;
    if (level === 0 && !part_number) part_number = nextPartNumber();
    if (level !== 0) part_number = null;

    el.saveBtn.disabled = true; el.saveBtn.textContent = 'Salvando...';
    const patch = {
      title, slug, parent_id: parentId, level, part_number,
      page_ref: el.fPage.value ? parseInt(el.fPage.value, 10) : null,
      content: getEditorContent(),
    };
    const { error } = await client.from('sections').update(patch).eq('id', current.id);
    el.saveBtn.disabled = false; el.saveBtn.textContent = 'Salvar';
    if (error) { alertBox(el.editorAlert, 'Erro ao salvar: ' + error.message, 'err'); return; }
    el.fSlug.value = slug;
    await renumber();
    await loadData(current.id);
    toast('Tópico salvo com sucesso.', 'ok');
  });

  function nextPartNumber() {
    const nums = sections.filter(s => s.level === 0 && s.part_number).map(s => s.part_number);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  // ---------- excluir ----------
  el.deleteBtn.addEventListener('click', async () => {
    if (!current) return;
    const kids = descendants(current.id);
    const extra = kids.length ? ' Isto também excluirá ' + kids.length + ' subtópico(s).' : '';
    const ok = await confirmModal('Excluir tópico', '“' + current.title + '” será removido permanentemente.' + extra, 'Excluir');
    if (!ok) return;
    const { error } = await client.from('sections').delete().eq('id', current.id);
    if (error) { toast('Erro ao excluir: ' + error.message, 'err'); return; }
    current = null;
    el.editorForm.style.display = 'none'; el.welcomePane.style.display = '';
    await renumber();
    await loadData();
    toast('Tópico excluído.', 'ok');
  });

  // ---------- novo ----------
  async function createSection(parentId) {
    const parent = parentId ? byId[parentId] : null;
    const level = parent ? parent.level + 1 : 0;
    const part_number = level === 0 ? nextPartNumber() : null;
    const maxPos = sections.length ? Math.max(...sections.map(s => s.position)) : 0;
    const base = slugify(level === 0 ? 'nova-parte' : 'novo-topico');
    const row = {
      parent_id: parentId, level, part_number,
      title: level === 0 ? 'Nova PARTE' : 'Novo tópico',
      slug: uniqueSlug(base, null),
      content: '', position: maxPos + 1, page_ref: null,
    };
    const { data, error } = await client.from('sections').insert(row).select().single();
    if (error) { toast('Erro ao criar: ' + error.message, 'err'); return; }
    await renumber();
    await loadData(data.id);
    el.fTitle.focus(); el.fTitle.select();
    toast('Criado. Edite e salve.', 'ok');
  }
  el.newRootBtn.addEventListener('click', () => createSection(null));
  el.addChildBtn.addEventListener('click', () => { if (current) createSection(current.id); });

  // ---------- reordenar ----------
  async function move(dir) {
    if (!current) return;
    const sibs = current.level === 0
      ? sections.filter(s => s.level === 0).sort(sortSib)
      : childrenOf(current.parent_id);
    const i = sibs.findIndex(s => s.id === current.id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= sibs.length) return;
    const a = sibs[i], b = sibs[j];
    // troca posições (e part_number quando forem PARTES)
    const ups = [
      client.from('sections').update({ position: b.position }).eq('id', a.id),
      client.from('sections').update({ position: a.position }).eq('id', b.id),
    ];
    if (current.level === 0) {
      ups.push(client.from('sections').update({ part_number: b.part_number }).eq('id', a.id));
      ups.push(client.from('sections').update({ part_number: a.part_number }).eq('id', b.id));
    }
    await Promise.all(ups);
    await renumber();
    await loadData(current.id);
  }
  el.moveUpBtn.addEventListener('click', () => move('up'));
  el.moveDownBtn.addEventListener('click', () => move('down'));

  // Renumera posições (DFS) e part_number das PARTES para manter ordem linear consistente
  async function renumber() {
    // recarrega estado mínimo
    const { data } = await client.from('sections').select('id,parent_id,level,position,part_number').order('position');
    const list = data || [];
    const byIdL = {}; list.forEach(s => byIdL[s.id] = s);
    const kids = {}; list.forEach(s => { (kids[s.parent_id] = kids[s.parent_id] || []).push(s); });
    Object.values(kids).forEach(arr => arr.sort((a, b) => {
      if (a.level === 0 && b.level === 0) return (a.part_number || 999) - (b.part_number || 999) || a.position - b.position;
      return a.position - b.position;
    }));
    let seq = 0, part = 0;
    const updates = [];
    const dfs = (node) => {
      const newPos = seq++;
      let newPart = node.part_number;
      if (node.level === 0) { part++; newPart = part; }
      if (node.position !== newPos || node.part_number !== newPart)
        updates.push(client.from('sections').update({ position: newPos, part_number: newPart }).eq('id', node.id));
      (kids[node.id] || []).forEach(dfs);
    };
    (kids['null'] || kids[null] || list.filter(s => !s.parent_id).sort((a, b) => (a.part_number || 999) - (b.part_number || 999) || a.position - b.position)).forEach(dfs);
    if (updates.length) await Promise.all(updates);
  }

  // ---------- editor WYSIWYG ----------
  function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount && el.wyArea.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0);
  }
  function restoreSelection() {
    el.wyArea.focus();
    if (savedRange) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  }
  el.wyArea.addEventListener('keyup', saveSelection);
  el.wyArea.addEventListener('mouseup', saveSelection);

  el.toolbar.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    if (btn.dataset.cmd) { el.wyArea.focus(); document.execCommand(btn.dataset.cmd, false, null); saveSelection(); }
    if (btn.dataset.block) { el.wyArea.focus(); document.execCommand('formatBlock', false, btn.dataset.block); saveSelection(); }
  });
  el.btnLink.addEventListener('click', () => {
    const url = prompt('Endereço do link (URL):', 'https://');
    if (url) { el.wyArea.focus(); restoreSelection(); document.execCommand('createLink', false, url); }
  });
  el.btnScreen.addEventListener('click', () => {
    el.wyArea.focus(); restoreSelection();
    const sel = window.getSelection();
    const text = sel && sel.toString() ? sel.toString() : 'Cole aqui a tela do sistema (modo texto).';
    document.execCommand('insertHTML', false, '<pre class="screen">' + esc(text) + '</pre><p><br></p>');
  });

  // upload de imagem
  el.btnImage.addEventListener('click', () => { saveSelection(); el.imgInput.click(); });
  el.imgInput.addEventListener('change', async () => {
    const file = el.imgInput.files[0]; if (!file) return;
    toast('Enviando imagem...');
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = 'uploads/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const { error } = await client.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false });
    el.imgInput.value = '';
    if (error) { toast('Erro no upload: ' + error.message, 'err'); return; }
    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    const url = data.publicUrl;
    restoreSelection();
    document.execCommand('insertHTML', false, '<figure><img src="' + url + '" alt="Imagem do manual"></figure><p><br></p>');
    saveSelection();
    toast('Imagem inserida.', 'ok');
  });

  // toggle HTML
  el.btnHtml.addEventListener('click', () => {
    if (htmlMode) {
      el.wyArea.innerHTML = el.htmlArea.value;
      el.wyArea.style.display = ''; el.htmlArea.style.display = 'none';
      el.btnHtml.classList.remove('active'); htmlMode = false;
    } else {
      el.htmlArea.value = el.wyArea.innerHTML;
      el.htmlArea.style.display = ''; el.wyArea.style.display = 'none';
      el.btnHtml.classList.add('active'); htmlMode = true;
    }
  });

  // slug automático ao digitar título (se slug estiver vazio)
  el.fTitle.addEventListener('input', () => {
    if (!el.fSlug.value.trim() || el.fSlug.dataset.auto === '1') {
      el.fSlug.value = slugify(el.fTitle.value); el.fSlug.dataset.auto = '1';
    }
  });
  el.fSlug.addEventListener('input', () => { el.fSlug.dataset.auto = ''; });

  // ---------- gerenciamento de usuários (Edge Function) ----------
  const USERS_FN = window.CEC_CONFIG.SUPABASE_URL + '/functions/v1/admin-users';
  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch (e) { return '—'; }
  }
  async function callUsers(action, payload = {}) {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { toast('Sessão expirada. Entre novamente.', 'err'); return null; }
    let res, body;
    try {
      res = await fetch(USERS_FN, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + session.access_token,
          'apikey': window.CEC_CONFIG.SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...payload }),
      });
      body = await res.json().catch(() => ({}));
    } catch (e) { toast('Falha de conexão com o servidor.', 'err'); return null; }
    if (!res.ok) { toast(body.error || 'Erro na operação.', 'err'); return null; }
    return body;
  }
  async function loadUsers() {
    el.usersList.innerHTML = '<div class="dim" style="padding:16px">Carregando usuários...</div>';
    const r = await callUsers('list');
    if (!r) { el.usersList.innerHTML = '<div class="dim" style="padding:16px">Não foi possível carregar.</div>'; return; }
    renderUsers(r.users || []);
  }
  function renderUsers(users) {
    if (!users.length) { el.usersList.innerHTML = '<div class="dim" style="padding:16px">Nenhum usuário.</div>'; return; }
    el.usersList.innerHTML = users.map(u =>
      '<div class="user-row">' +
        '<div style="flex:1;min-width:0">' +
          '<div class="u-email">' + esc(u.email) + (u.is_self ? '<span class="u-self">VOCÊ</span>' : '') + '</div>' +
          '<div class="u-meta">Criado em ' + fmtDate(u.created_at) + ' · Último acesso: ' + (u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : 'nunca') + '</div>' +
        '</div>' +
        '<div class="user-actions">' +
          '<button class="btn secondary sm" data-pw="' + u.id + '" data-email="' + esc(u.email) + '">Alterar senha</button>' +
          '<button class="btn danger sm" data-del="' + u.id + '" data-email="' + esc(u.email) + '"' + (u.is_self ? ' disabled title="Não é possível excluir a si mesmo"' : '') + '>Excluir</button>' +
        '</div>' +
      '</div>').join('');
    el.usersList.querySelectorAll('[data-pw]').forEach(b => b.addEventListener('click', () => changeUserPw(b.dataset.pw, b.dataset.email)));
    el.usersList.querySelectorAll('[data-del]').forEach(b => { if (!b.disabled) b.addEventListener('click', () => deleteUser(b.dataset.del, b.dataset.email)); });
  }
  async function changeUserPw(id, email) {
    const p = prompt('Nova senha para ' + email + ' (mínimo 6 caracteres):');
    if (p === null) return;
    if (p.length < 6) { toast('A senha deve ter ao menos 6 caracteres.', 'err'); return; }
    const r = await callUsers('update_password', { id, password: p });
    if (r) toast('Senha alterada com sucesso.', 'ok');
  }
  async function deleteUser(id, email) {
    const ok = await confirmModal('Excluir usuário', 'O usuário “' + email + '” perderá o acesso ao painel administrativo.', 'Excluir');
    if (!ok) return;
    const r = await callUsers('delete', { id });
    if (r) { toast('Usuário excluído.', 'ok'); loadUsers(); }
  }
  el.usersBtn.addEventListener('click', () => { alertBox(el.usersAlert, ''); el.usersModal.classList.add('open'); loadUsers(); });
  el.usersClose.addEventListener('click', () => el.usersModal.classList.remove('open'));
  el.usersModal.addEventListener('click', e => { if (e.target === el.usersModal) el.usersModal.classList.remove('open'); });
  el.userAddForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = el.newUserEmail.value.trim();
    const pass = el.newUserPass.value;
    if (pass.length < 6) { alertBox(el.usersAlert, 'A senha deve ter ao menos 6 caracteres.', 'err'); return; }
    const r = await callUsers('create', { email, password: pass });
    if (r) { toast('Usuário criado com sucesso.', 'ok'); el.newUserEmail.value = ''; el.newUserPass.value = ''; alertBox(el.usersAlert, ''); loadUsers(); }
  });

  // ---------- mobile ----------
  function closeSidebar() { el.adminList.classList.remove('open'); el.backdrop.classList.remove('open'); }
  el.menuToggle.addEventListener('click', () => {
    el.adminList.classList.toggle('open'); el.backdrop.classList.toggle('open');
  });
  el.backdrop.addEventListener('click', closeSidebar);

  initAuth();
})();
