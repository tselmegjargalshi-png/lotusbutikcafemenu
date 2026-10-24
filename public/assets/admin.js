(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const loginView = $('login');
  const appView = $('app');
  const catsEl = $('cats');
  const statusEl = $('status');
  const saveBtn = $('saveBtn');
  const filterEl = $('filter');
  const checkFilter = $('checkFilter');

  const PRICE_RE = /^\d{1,6}([.,]\d{1,2})?(\s*[/-]\s*\d{1,6}([.,]\d{1,2})?)?$/;

  const state = {
    menu: null,
    baseUpdatedAt: null,
    dirty: false,
    saving: false,
    collapsed: new Set(),
  };

  const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k in n && typeof v !== 'string') n[k] = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...children.filter((c) => c != null));
    return n;
  };

  const fold = (s) => String(s || '').toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');

  const newId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast ${kind ? `is-${kind}` : ''}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'error' ? 6000 : 3500);
  }

  function setStatus() {
    statusEl.classList.remove('is-dirty', 'is-error');
    if (state.saving) statusEl.textContent = 'Kaydediliyor…';
    else if (state.dirty) { statusEl.textContent = 'Kaydedilmemiş değişiklikler var'; statusEl.classList.add('is-dirty'); }
    else statusEl.textContent = 'Tüm değişiklikler kaydedildi';
    saveBtn.disabled = !state.dirty || state.saving;
  }

  function markDirty() {
    state.dirty = true;
    setStatus();
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...opts,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw Object.assign(new Error(data.error || `Hata (${res.status})`), { status: res.status });
    return data;
  }

  /* ---------- Auth ---------- */

  function showLogin(message = '') {
    // Unsaved edits stay in memory behind the login card and survive a re-login.
    appView.hidden = true;
    loginView.hidden = false;
    $('loginError').textContent = message;
    setTimeout(() => ($('username').value ? $('password') : $('username')).focus(), 0);
  }

  $('pwToggle').addEventListener('click', (e) => {
    const pw = $('password');
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Gizle' : 'Göster';
    e.currentTarget.setAttribute('aria-pressed', String(show));
    e.currentTarget.setAttribute('aria-label', show ? 'Şifreyi gizle' : 'Şifreyi göster');
  });

  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('username').value.trim();
    const password = $('password').value;
    if (!username || !password) { $('loginError').textContent = 'Kullanıcı adı ve şifre gerekli.'; return; }
    const btn = $('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Giriş yapılıyor…';
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      $('password').value = '';
      loginView.hidden = true;
      if (state.menu) {
        appView.hidden = false;
        toast('Tekrar giriş yapıldı. Şimdi kaydedebilirsiniz.', 'ok');
      } else {
        await loadMenu();
      }
    } catch (err) {
      $('loginError').textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Giriş yap';
    }
  });

  $('logoutBtn').addEventListener('click', async () => {
    if (state.dirty && !confirm('Kaydedilmemiş değişiklikler kaybolacak. Çıkmak istiyor musunuz?')) return;
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    state.menu = null;
    state.dirty = false;
    appView.hidden = true;
    showLogin();
  });

  /* ---------- Load & save ---------- */

  async function loadMenu() {
    try {
      const data = await api('/api/admin/menu');
      state.menu = { categories: data.menu.categories };
      state.baseUpdatedAt = data.menu.updatedAt || null;
      state.dirty = false;
      // Start with categories folded so the owner sees the whole menu structure at once.
      state.menu.categories.forEach((c) => state.collapsed.add(c.id));
      $('storageWarn').hidden = data.storage;
      loginView.hidden = true;
      appView.hidden = false;
      render();
      setStatus();
    } catch (err) {
      if (err.status === 401) showLogin();
      else { showLogin(); $('loginError').textContent = err.message; }
    }
  }

  function validate() {
    let firstBad = null;
    catsEl.querySelectorAll('.is-invalid').forEach((n) => n.classList.remove('is-invalid'));
    for (const c of state.menu.categories) {
      if (!c.name.trim()) return { msg: 'Kategori adı boş olamaz.', sel: `[data-cat="${c.id}"] .cat__name` };
      for (const it of c.items) {
        if (!it.name.trim()) return { msg: `"${c.name}" kategorisinde adı boş bir ürün var.`, sel: `[data-item="${it.id}"] .js-name`, cat: c.id };
        if (it.price.trim() && !PRICE_RE.test(it.price.trim())) {
          firstBad = firstBad || { msg: `"${it.name}" fiyatı geçersiz. Örnek: 150 veya 500 / 750`, sel: `[data-item="${it.id}"] .js-price`, cat: c.id };
        }
      }
    }
    return firstBad;
  }

  async function save() {
    if (!state.dirty || state.saving) return;
    const bad = validate();
    if (bad) {
      if (bad.cat && state.collapsed.has(bad.cat)) { state.collapsed.delete(bad.cat); render(); }
      const n = catsEl.querySelector(bad.sel);
      if (n) { n.classList.add('is-invalid'); n.focus(); n.scrollIntoView({ block: 'center' }); }
      toast(bad.msg, 'error');
      return;
    }
    state.saving = true;
    setStatus();
    try {
      const data = await api('/api/admin/menu', {
        method: 'PUT',
        body: JSON.stringify({ baseUpdatedAt: state.baseUpdatedAt, menu: state.menu }),
      });
      state.baseUpdatedAt = data.menu.updatedAt;
      state.menu = { categories: data.menu.categories };
      state.dirty = false;
      render();
      toast('Kaydedildi ✓ Menü birkaç saniye içinde güncellenir.', 'ok');
    } catch (err) {
      if (err.status === 401) {
        showLogin('Oturum süresi doldu. Değişiklikleriniz duruyor; giriş yapıp tekrar Kaydet\'e basın.');
      } else {
        toast(err.message, 'error');
        statusEl.textContent = 'Kaydedilemedi';
        statusEl.classList.add('is-error');
      }
    } finally {
      state.saving = false;
      if (statusEl.textContent !== 'Kaydedilemedi') setStatus();
      else saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener('click', save);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !appView.hidden) { e.preventDefault(); save(); }
  });
  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Editing helpers ---------- */

  function move(arr, i, d) {
    const j = i + d;
    if (j < 0 || j >= arr.length) return false;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return true;
  }

  function refocus(selector) {
    requestAnimationFrame(() => catsEl.querySelector(selector)?.focus());
  }

  function textField(obj, key, { cls = '', placeholder = '', label, onChange, inputmode, maxlength = 120 } = {}) {
    return el('input', {
      class: `field ${cls}`,
      value: obj[key] || '',
      placeholder,
      'aria-label': label,
      inputmode,
      maxlength: String(maxlength),
      oninput: (e) => {
        obj[key] = e.target.value;
        e.target.classList.remove('is-invalid');
        markDirty();
        onChange?.(e);
      },
    });
  }

  /* ---------- Render ---------- */

  function updateCheckCount() {
    const n = state.menu.categories.reduce((s, c) => s + c.items.filter((i) => i.check).length, 0);
    $('checkCount').textContent = String(n);
    $('checkFilterWrap').hidden = n === 0 && !checkFilter.checked;
    $('checkInfo').hidden = n === 0;
  }

  function render() {
    const q = fold(filterEl.value.trim());
    const onlyCheck = checkFilter.checked;
    const filtering = Boolean(q) || onlyCheck;
    const cats = state.menu.categories;
    catsEl.replaceChildren();
    updateCheckCount();

    cats.forEach((cat, ci) => {
      const catHit = q && fold(cat.name).includes(q);
      const items = cat.items.filter((it) =>
        (!onlyCheck || it.check) && (!q || catHit || fold(it.name).includes(q) || fold(it.desc).includes(q)));
      if (filtering && !items.length) return;
      const collapsed = !filtering && state.collapsed.has(cat.id);

      const nameInput = textField(cat, 'name', { cls: 'cat__name', label: 'Kategori adı', maxlength: 80 });
      nameInput.classList.remove('field');

      const head = el('div', { class: 'cat__head' },
        el('button', {
          class: 'cat__toggle', type: 'button', text: collapsed ? '▸' : '▾',
          'aria-expanded': String(!collapsed), 'aria-label': `${cat.name} kategorisini ${collapsed ? 'aç' : 'kapat'}`,
          onclick: () => { state.collapsed.has(cat.id) ? state.collapsed.delete(cat.id) : state.collapsed.add(cat.id); render(); },
        }),
        nameInput,
        el('span', { class: 'cat__count', text: `${cat.items.length} ürün${cat.hidden ? ' · gizli' : ''}` }),
        el('div', { class: 'cat__tools' },
          el('button', {
            class: 'icon-btn', type: 'button', text: '↑', disabled: ci === 0 || filtering, 'aria-label': 'Kategoriyi yukarı taşı',
            onclick: () => { move(cats, ci, -1) && (markDirty(), render(), refocus(`[data-cat="${cat.id}"] .js-cup`)); },
          }),
          el('button', {
            class: 'icon-btn', type: 'button', text: '↓', disabled: ci === cats.length - 1 || filtering, 'aria-label': 'Kategoriyi aşağı taşı',
            onclick: () => { move(cats, ci, 1) && (markDirty(), render(), refocus(`[data-cat="${cat.id}"] .js-cdown`)); },
          }),
          el('button', {
            class: 'pill', type: 'button', 'aria-pressed': String(cat.hidden),
            text: cat.hidden ? 'Gizli · Göster' : 'Gizle',
            title: 'Kategoriyi menüde gizle/göster',
            onclick: () => { cat.hidden = !cat.hidden; markDirty(); render(); },
          }),
          el('button', {
            class: 'icon-btn icon-btn--danger', type: 'button', text: '✕', 'aria-label': `${cat.name} kategorisini sil`,
            onclick: () => {
              if (!confirm(`"${cat.name}" kategorisi ve içindeki ${cat.items.length} ürün silinsin mi?`)) return;
              cats.splice(ci, 1); markDirty(); render();
            },
          }),
        ),
      );
      head.querySelectorAll('.icon-btn')[0].classList.add('js-cup');
      head.querySelectorAll('.icon-btn')[1].classList.add('js-cdown');

      const card = el('section', { class: `cat${cat.hidden ? ' is-hidden' : ''}`, 'data-cat': cat.id }, head);

      if (!collapsed) {
        const body = el('div', { class: 'cat__body' });
        body.append(el('label', { class: 'cat__note' }, 'Kategori notu (isteğe bağlı)',
          textField(cat, 'note', { placeholder: 'ör. Günlük hazırlanan taze meze çeşitleri', label: 'Kategori notu', maxlength: 160 })));

        const list = el('ul', { class: 'items', role: 'list' });
        items.forEach((it) => {
          const ii = cat.items.indexOf(it);
          list.append(renderItem(cat, it, ii, filtering));
        });
        if (!items.length) list.append(el('li', { class: 'empty', text: 'Bu kategoride ürün yok.' }));
        body.append(list);
        if (!filtering) {
          body.append(el('button', {
            class: 'btn btn--soft add-item', type: 'button', text: '+ Ürün ekle',
            onclick: () => {
              const it = { id: newId('i'), name: '', desc: '', price: '', unit: '', image: '', hidden: false, check: false };
              cat.items.push(it);
              markDirty(); render();
              refocus(`[data-item="${it.id}"] .js-name`);
            },
          }));
        }
        card.append(body);
      }
      catsEl.append(card);
    });

    if (!catsEl.children.length) {
      catsEl.append(el('p', { class: 'empty', text: filtering ? 'Aramanızla eşleşen ürün yok.' : 'Henüz kategori yok. “+ Kategori ekle” ile başlayın.' }));
    }
  }

  function renderItem(cat, it, ii, filtering) {
    const row = el('li', {
      class: `item${it.hidden ? ' is-hidden' : ''}${it.check ? ' is-flagged' : ''}`,
      'data-item': it.id,
    });

    const up = el('button', {
      class: 'icon-btn js-up', type: 'button', text: '↑', disabled: ii === 0 || filtering, 'aria-label': `${it.name || 'Ürün'} yukarı taşı`,
      onclick: () => { move(cat.items, ii, -1) && (markDirty(), render(), refocus(`[data-item="${it.id}"] .js-up`)); },
    });
    const down = el('button', {
      class: 'icon-btn js-down', type: 'button', text: '↓', disabled: ii === cat.items.length - 1 || filtering, 'aria-label': `${it.name || 'Ürün'} aşağı taşı`,
      onclick: () => { move(cat.items, ii, 1) && (markDirty(), render(), refocus(`[data-item="${it.id}"] .js-down`)); },
    });

    const price = textField(it, 'price', { cls: 'js-price', placeholder: 'Fiyat', label: `${it.name || 'Ürün'} fiyatı (₺)`, inputmode: 'decimal', maxlength: 30 });
    const tools = el('div', { class: 'item__tools' });
    if (it.check) {
      tools.append(el('button', {
        class: 'flag', type: 'button', text: 'Kontrol et ✓', title: 'Fiyat doğruysa tıklayarak onaylayın',
        'aria-label': `${it.name} fiyatını doğru olarak onayla`,
        onclick: () => { it.check = false; markDirty(); render(); },
      }));
    }
    tools.append(
      el('button', {
        class: 'pill', type: 'button', 'aria-pressed': String(it.hidden),
        text: it.hidden ? 'Gizli · Göster' : 'Gizle', title: 'Menüde gizle/göster (ör. tükendiğinde)',
        onclick: () => { it.hidden = !it.hidden; markDirty(); render(); },
      }),
      el('button', {
        class: 'icon-btn icon-btn--danger', type: 'button', text: '✕', 'aria-label': `${it.name || 'Ürünü'} sil`,
        onclick: () => {
          if (!confirm(`"${it.name || 'Bu ürün'}" silinsin mi?`)) return;
          cat.items.splice(ii, 1); markDirty(); render();
        },
      }),
    );

    row.append(
      el('div', { class: 'item__move' }, up, down),
      el('div', { class: 'item__name' }, textField(it, 'name', { cls: 'js-name', placeholder: 'Ürün adı', label: 'Ürün adı', maxlength: 80 })),
      el('div', { class: 'item__priceRow' },
        el('div', { class: 'price-wrap' }, price),
        textField(it, 'unit', { placeholder: 'Birim (kg…)', label: `${it.name || 'Ürün'} birimi`, maxlength: 20 })),
      el('div', { class: 'item__desc' }, textField(it, 'desc', { placeholder: 'Açıklama (isteğe bağlı)', label: `${it.name || 'Ürün'} açıklaması`, maxlength: 200 })),
      renderPhoto(it),
      tools,
    );
    return row;
  }

  /* ---------- Photos ---------- */

  const MAX_SIDE = 1200;

  // Downscales in the browser so phone photos (often 5–10 MB) upload quickly and stay small.
  async function preparePhoto(file) {
    if (!file.type.startsWith('image/')) throw new Error('Lütfen bir fotoğraf dosyası seçin.');
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new Error('Bu fotoğraf biçimi okunamadı. JPG veya PNG deneyin.');
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const toBlob = (type, q) => new Promise((r) => canvas.toBlob(r, type, q));
    let blob = await toBlob('image/webp', 0.82);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85); // older Safari
    if (!blob) throw new Error('Fotoğraf hazırlanamadı.');
    return blob;
  }

  const uploading = new Set();

  async function uploadPhoto(it, file) {
    uploading.add(it.id);
    render();
    try {
      const blob = await preparePhoto(file);
      const res = await fetch('/api/admin/upload', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type }, body: blob });
      let data = {};
      try { data = await res.json(); } catch { /* empty body */ }
      if (res.status === 401) { showLogin('Oturum süresi doldu. Giriş yapıp fotoğrafı tekrar yükleyin.'); return; }
      if (!res.ok) throw new Error(data.error || `Hata (${res.status})`);
      it.image = data.image;
      markDirty();
      toast('Fotoğraf yüklendi. Yayınlamak için Kaydet\'e basın.', 'ok');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      uploading.delete(it.id);
      render();
    }
  }

  function renderPhoto(it) {
    const box = el('div', { class: 'item__photo' });
    const label = it.name || 'Ürün';
    const input = el('input', {
      type: 'file', accept: 'image/*', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true',
      onchange: (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) uploadPhoto(it, f); },
    });
    const pick = (text) => el('button', {
      class: 'pill', type: 'button', text, 'aria-label': `${label} için fotoğraf ${it.image ? 'değiştir' : 'ekle'}`,
      onclick: () => input.click(),
    });
    if (uploading.has(it.id)) {
      box.append(el('span', { class: 'photo-busy', text: 'Fotoğraf yükleniyor…' }));
      return box;
    }
    if (it.image) {
      box.append(
        el('img', { class: 'photo-thumb', src: `/img/${it.image}`, alt: `${label} fotoğrafı`, width: '56', height: '56', loading: 'lazy' }),
        pick('Değiştir'),
        el('button', {
          class: 'pill', type: 'button', text: 'Kaldır', 'aria-label': `${label} fotoğrafını kaldır`,
          onclick: () => { it.image = ''; markDirty(); render(); },
        }),
      );
    } else {
      box.append(pick('📷 Fotoğraf ekle'));
    }
    box.append(input);
    return box;
  }

  /* ---------- Toolbar ---------- */

  let ft;
  filterEl.addEventListener('input', () => { clearTimeout(ft); ft = setTimeout(render, 150); });
  checkFilter.addEventListener('change', render);
  $('expandAll').addEventListener('click', () => { state.collapsed.clear(); render(); });
  $('collapseAll').addEventListener('click', () => { state.menu.categories.forEach((c) => state.collapsed.add(c.id)); render(); });
  $('addCat').addEventListener('click', () => {
    const c = { id: newId('c'), name: 'Yeni Kategori', note: '', hidden: false, items: [] };
    state.menu.categories.push(c);
    filterEl.value = '';
    checkFilter.checked = false;
    markDirty(); render();
    const input = catsEl.querySelector(`[data-cat="${c.id}"] .cat__name`);
    input?.scrollIntoView({ block: 'center' });
    input?.select();
  });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ updatedAt: state.baseUpdatedAt, ...state.menu }, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `lotus-menu-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.categories)) throw new Error();
      if (!confirm('Mevcut menü bu yedekle değiştirilecek (Kaydet\'e basana kadar yayınlanmaz). Devam edilsin mi?')) return;
      state.menu = {
        categories: data.categories.map((c) => ({
          id: String(c.id || newId('c')), name: String(c.name || ''), note: String(c.note || ''), hidden: Boolean(c.hidden),
          items: (c.items || []).map((i) => ({
            id: String(i.id || newId('i')), name: String(i.name || ''), desc: String(i.desc || ''), price: String(i.price ?? ''),
            unit: String(i.unit || ''), image: String(i.image || ''), hidden: Boolean(i.hidden), check: Boolean(i.check),
          })),
        })),
      };
      markDirty(); render();
      toast('Yedek yüklendi. Yayınlamak için Kaydet\'e basın.');
    } catch {
      toast('Dosya okunamadı. Lütfen bu panelden indirilen bir JSON yedeği seçin.', 'error');
    }
  });

  loadMenu();
})();
