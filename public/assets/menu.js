(() => {
  'use strict';

  const main = document.getElementById('menu');
  const nav = document.getElementById('catnav');
  const search = document.getElementById('q');
  const updated = document.getElementById('updated');
  const toTop = document.getElementById('totop');
  let menu = null;

  const ORNAMENT = '<svg viewBox="0 0 120 96" aria-hidden="true"><path fill="currentColor" d="M60 76C38 77 18 66 6 46c19-3 41 6 54 30Zm0 0c22 1 42-10 54-30-19-3-41 6-54 30Zm0 0C42 68 30 48 32 22c16 9 27 30 28 54Zm0 0c18-8 30-28 28-54-16 9-27 30-28 54Zm0 0C43 52 47 22 60 6c13 16 17 46 0 70Z"/></svg>';

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // Turkish-aware, accent-insensitive normalisation for search.
  const fold = (s) => String(s || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function formatPrice(price) {
    if (!price) return '';
    return price.replace(/\s*([/-])\s*/g, ' $1 ') + ' ₺';
  }

  // Wraps matches of `query` in <mark> without using innerHTML on user data.
  function highlight(node, text, query) {
    if (!query) { node.textContent = text; return; }
    const folded = fold(text);
    let i = 0;
    let at = folded.indexOf(query);
    if (folded.length !== text.length || at < 0) { node.textContent = text; return; }
    while (at >= 0) {
      node.append(text.slice(i, at));
      node.append(el('mark', null, text.slice(at, at + query.length)));
      i = at + query.length;
      at = folded.indexOf(query, i);
    }
    node.append(text.slice(i));
  }

  function render() {
    const query = fold(search.value.trim());
    main.replaceChildren();
    nav.replaceChildren();
    let shown = 0;

    for (const cat of menu.categories) {
      const catHit = query && fold(cat.name).includes(query);
      const items = query
        ? cat.items.filter((it) => catHit || fold(it.name).includes(query) || fold(it.desc).includes(query))
        : cat.items;
      if (!items.length) continue;
      shown += items.length;
      const id = `k-${slug(cat.name) || cat.id}`;

      const section = el('section', 'cat');
      section.id = id;
      section.setAttribute('aria-labelledby', `${id}-t`);
      const head = el('div', 'cat__head');
      const h2 = el('h2', 'cat__title', cat.name);
      h2.id = `${id}-t`;
      const orn = el('div', 'cat__orn');
      orn.innerHTML = ORNAMENT;
      head.append(h2, orn);
      if (cat.note) head.append(el('p', 'cat__note', cat.note));

      const list = el('ul', 'items');
      list.setAttribute('role', 'list');
      for (const it of items) {
        const li = el('li', it.image ? 'item item--photo' : 'item');
        const body = it.image ? el('div', 'item__body') : li;
        if (it.image) {
          const btn = el('button', 'item__thumb');
          btn.type = 'button';
          btn.setAttribute('aria-label', `${it.name} fotoğrafını büyüt`);
          const img = el('img');
          img.src = it.image;
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.width = 72;
          img.height = 72;
          btn.append(img);
          btn.addEventListener('click', () => openPhoto(it));
          li.append(btn, body);
        }
        const row = el('div', 'item__row');
        const name = el('span', 'item__name');
        highlight(name, it.name, query);
        const price = el('span', 'item__price', formatPrice(it.price));
        if (it.unit && it.price) price.append(' ', el('span', 'item__unit', `/ ${it.unit}`));
        row.append(name, el('span', 'item__dots'), price);
        body.append(row);
        if (it.desc) {
          const d = el('p', 'item__desc');
          highlight(d, it.desc, query);
          body.append(d);
        }
        if (it.unit && !it.price) body.append(el('p', 'item__desc', it.unit));
        list.append(li);
      }
      section.append(head, list);
      main.append(section);

      const a = el('a', null, cat.name);
      a.href = `#${id}`;
      const navLi = el('li');
      navLi.append(a);
      nav.append(navLi);
    }

    if (!shown) {
      const s = el('div', 'state');
      s.append(el('p', null, `“${search.value.trim()}” için sonuç bulunamadı.`));
      main.append(s);
    }
    observeSections();
  }

  const dialog = document.getElementById('photo');
  function openPhoto(it) {
    const img = dialog.querySelector('img');
    img.src = it.image;
    img.alt = it.name;
    dialog.querySelector('.photo__name').textContent = it.name;
    const price = dialog.querySelector('.photo__price');
    price.textContent = formatPrice(it.price) + (it.unit && it.price ? ` / ${it.unit}` : '');
    dialog.querySelector('.photo__desc').textContent = it.desc || '';
    dialog.showModal();
  }
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('.photo__close')) dialog.close();
  });

  let observer;
  function observeSections() {
    if (observer) observer.disconnect();
    const links = new Map([...nav.querySelectorAll('a')].map((a) => [a.hash.slice(1), a]));
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute('aria-current'));
        const a = links.get(e.target.id);
        if (a) {
          a.setAttribute('aria-current', 'true');
          a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        }
      }
    }, { rootMargin: '-130px 0px -60% 0px' });
    main.querySelectorAll('.cat').forEach((s) => observer.observe(s));
  }

  function showError() {
    const s = el('div', 'state');
    s.append(el('p', null, 'Menü şu anda yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.'));
    const b = el('button', null, 'Tekrar dene');
    b.type = 'button';
    b.addEventListener('click', load);
    s.append(b);
    main.replaceChildren(s);
  }

  async function load() {
    try {
      const res = await fetch('/api/menu', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      menu = await res.json();
      if (menu.updatedAt) {
        const d = new Date(menu.updatedAt);
        updated.textContent = `Son güncelleme: ${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      }
      render();
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } catch {
      showError();
    }
  }

  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => menu && render(), 120);
  });

  window.addEventListener('scroll', () => { toTop.hidden = window.scrollY < 600; }, { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0 }));

  load();
})();
