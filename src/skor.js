// Çevrimiçi skor tablosu: oyun bitince ad sorar, skoru skor-api'ye gönderir, ilk 10'u gösterir.
// Aynı dosya Bug Avcısı'nda da var; yalnız en üstteki AYAR bölümü farklıdır.
// SKOR_API boşsa hiçbir şey yapmaz: oyun eskisi gibi çalışır, yerel rekor yine kaydedilir.
(function () {
  'use strict';

  // ================= AYAR =================
  // Skor sunucusunun HTTPS adresi (sonda / olmadan), ör. 'https://skor.celikdovme.net'.
  // Boş bırakılırsa çevrimiçi skor tablosu kapalıdır. Kurulum: skor-api/DEPLOY.md
  const SKOR_API = '';
  const OYUN = 'bogaz-yolu';
  const MODLAR = { bogaz: 'BOĞAZ YOLU', tur: 'İSTANBUL TURU' };   // sunucudaki mod adı → başlık (rekorlar mod başına ayrı)
  const RENK = { vurgu: '#f4c531', ikinci: '#9af4e4', panel: 'rgba(18,16,42,0.94)' };
  // ========================================

  const API = String(typeof window.SKOR_API === 'string' ? window.SKOR_API : SKOR_API).replace(/\/+$/, '');
  const enabled = API !== '' && typeof fetch === 'function';
  const BEKLE = 5000;   // ağ isteği zaman aşımı (ms)

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* yok */ } },
  };
  const MESAJ = {
    name_short: 'Ad en az 2 harf olmalı.',
    name_long: 'Ad en çok 16 karakter olabilir.',
    name_chars: 'Adda yalnız harf, rakam, boşluk ve . _ - olabilir.',
    name_blocked: 'Bu adı kullanamazsın, başka bir ad seç.',
    token_used: 'Bu oyunun skoru zaten gönderildi.',
    token_expired: 'Oyun çok uzun sürdü, bu skor artık gönderilemez.',
    token_invalid: 'Skor doğrulanamadı.',
    too_fast: 'Skor sunucuda doğrulanamadı.',
    score_implausible: 'Skor sunucuda doğrulanamadı.',
    meta_invalid: 'Skor sunucuda doğrulanamadı.',
    rate_limited: 'Çok sık gönderdin, biraz sonra yeniden dene.',
    db_unavailable: 'Skor sunucusu şu an yanıt vermiyor.',
    ag: 'Skor sunucusuna ulaşılamadı. Skorun bu cihazda kayıtlı kalır.',
    yok: 'Bu oyun başlarken sunucuya ulaşılamadı; skor gönderilemiyor.',
  };
  const fmt = (n) => Number(n).toLocaleString('tr-TR');

  // ---------- ağ ----------
  function istek(yol, govde) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), BEKLE);
    const opt = { method: govde ? 'POST' : 'GET', signal: ctl ? ctl.signal : undefined, cache: 'no-store' };
    if (govde) { opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(govde); }
    return fetch(API + yol, opt)
      .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, status: r.status, j })))
      .catch(() => ({ ok: false, status: 0, j: {} }))
      .finally(() => clearTimeout(t));
  }
  const kod = (res) => (res.j && res.j.detail && res.j.detail.code) || (res.status === 0 ? 'ag' : 'db_unavailable');

  // ---------- koşu ----------
  let run = null;   // { mode, token, bitti }
  function runStart(mode) {
    if (!enabled) return;
    const r = { mode: MODLAR[mode] ? mode : Object.keys(MODLAR)[0], token: null, bitti: false };
    run = r;
    const al = (deneme) => istek(`/v1/games/${OYUN}/runs`, { mode: r.mode }).then((res) => {
      if (res.ok && res.j.token) r.token = res.j.token;
      else if (deneme < 1 && run === r) setTimeout(() => al(deneme + 1), 8000);   // bir kez daha dene
    });
    al(0);
  }
  // opts: { score, meta, mode, name (öneri), delay (ms) }
  function runEnd(opts) {
    if (!enabled || !run || run.bitti) return false;
    const r = run;
    r.bitti = true;
    if (!(opts.score > 0)) return false;
    const go = () => ac({ bekleyen: { run: r, score: opts.score, meta: opts.meta || {} }, mode: r.mode, oneri: opts.name });
    if (opts.delay) setTimeout(go, opts.delay); else go();
    return true;
  }

  // ---------- görünüm ----------
  let kok = null, durum = null, stilVar = false, ayar = { onOpen: null, onClose: null };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  function stil() {
    const s = el('style');
    s.textContent = `
.skor-perde{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(10,8,28,.62);padding:16px;
  font-family:Fredoka,"Trebuchet MS",system-ui,sans-serif;color:#fff8ec;-webkit-user-select:text;user-select:text}
.skor-kutu{width:min(100%,420px);max-height:calc(100dvh - 32px);overflow:auto;background:${RENK.panel};border:1px solid rgba(255,255,255,.16);
  border-radius:14px;padding:16px 18px 14px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.skor-kutu h2{margin:0;text-align:center;color:${RENK.vurgu};font-weight:600;font-size:22px;letter-spacing:.04em;text-shadow:0 2px 0 #1a1430}
.skor-alt{margin:2px 0 10px;text-align:center;color:${RENK.ikinci};font-size:13px;font-weight:600}
.skor-gonder{background:rgba(255,255,255,.05);border-radius:10px;padding:10px 12px;margin-bottom:10px}
.skor-puan{text-align:center;font-size:15px;margin-bottom:8px}.skor-puan b{color:${RENK.vurgu};font-size:20px}
.skor-satir{display:flex;gap:8px}
.skor-satir input{flex:1;min-width:0;font:inherit;font-size:16px;color:#fff8ec;background:#1c1f33;border:1px solid #454c6c;border-radius:8px;padding:8px 10px}
.skor-satir input:focus{outline:2px solid ${RENK.vurgu};outline-offset:1px}
.skor-kutu button{font:inherit;font-weight:600;font-size:14px;color:#fff8ec;background:#262b40;border:1px solid #454c6c;border-radius:8px;padding:8px 12px;cursor:pointer;touch-action:manipulation}
.skor-kutu button:hover{background:#2f3550}.skor-kutu button:focus-visible{outline:2px solid ${RENK.vurgu};outline-offset:2px}
.skor-kutu button.ana{background:#1f7a6c;border-color:#2fb39e}.skor-kutu button:disabled{opacity:.5;cursor:default}
.skor-not{min-height:1.3em;margin:6px 0 0;font-size:13px;color:#d8dcec;text-align:center}.skor-not.hata{color:#ff9a8a}.skor-not.iyi{color:${RENK.ikinci}}
.skor-sekme{display:flex;gap:6px;justify-content:center;margin:4px 0 8px;flex-wrap:wrap}
.skor-sekme button{font-size:12px;padding:5px 10px;border-radius:999px}.skor-sekme button[aria-pressed="true"]{border-color:${RENK.vurgu};color:${RENK.vurgu}}
.skor-tablo{width:100%;border-collapse:collapse;font-size:15px}
.skor-tablo td{padding:5px 4px;border-bottom:1px solid rgba(255,255,255,.07)}
.skor-tablo td.s{text-align:right;color:${RENK.vurgu};font-variant-numeric:tabular-nums;font-weight:600}
.skor-tablo td.r{width:34px}.skor-tablo td.n{width:100%;text-align:left;overflow-wrap:anywhere}
.skor-tablo tr.ben td{background:rgba(244,197,49,.14)}
.skor-rozet{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#2e3460;font-size:12px;font-weight:600}
.skor-rozet.r1{background:#f4c531;color:#2a1a10}.skor-rozet.r2{background:#c8ccd8;color:#2a1a10}.skor-rozet.r3{background:#d08a4a;color:#2a1a10}
.skor-bos{text-align:center;color:#d8dcec;padding:14px 0;font-size:14px}
.skor-alt-satir{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;color:#9aa0b4}`;
    document.head.appendChild(s);
  }

  function ac(o) {
    if (!enabled) return;
    if (!stilVar) { stil(); stilVar = true; }
    if (kok) kapat(true);
    durum = { mode: o.mode || (run && run.mode) || Object.keys(MODLAR)[0], period: 'all', bekleyen: o.bekleyen || null, ben: store.get('skor-ad', '') };
    if (ayar.onOpen) try { ayar.onOpen(); } catch (e) { /* yok */ }
    kok = el('div', 'skor-perde');
    kok.setAttribute('role', 'dialog'); kok.setAttribute('aria-modal', 'true'); kok.setAttribute('aria-label', 'Skor tablosu');
    const kutu = el('div', 'skor-kutu');
    kok.appendChild(kutu);
    kutu.appendChild(el('h2', '', 'SKOR TABLOSU'));
    const alt = el('div', 'skor-alt');
    kutu.appendChild(alt);

    if (durum.bekleyen) {
      const g = el('form', 'skor-gonder');
      const p = el('div', 'skor-puan'); p.append('SKORUN ', el('b', '', fmt(durum.bekleyen.score)));
      const satir = el('div', 'skor-satir');
      const inp = el('input');
      Object.assign(inp, { type: 'text', maxLength: 16, placeholder: 'Adın', autocomplete: 'nickname', spellcheck: false, enterKeyHint: 'send' });
      inp.setAttribute('aria-label', 'Adın');
      inp.value = store.get('skor-ad', '') || o.oneri || '';
      const gonder = el('button', 'ana', 'GÖNDER'); gonder.type = 'submit';
      const gec = el('button', '', 'GEÇ'); gec.type = 'button';
      satir.append(inp, gonder, gec);
      const not = el('p', 'skor-not');
      g.append(p, satir, not);
      kutu.appendChild(g);
      if (!durum.bekleyen.run.token) { not.textContent = MESAJ.yok; not.className = 'skor-not hata'; }
      gec.addEventListener('click', () => { durum.bekleyen = null; g.remove(); });
      g.addEventListener('submit', (e) => { e.preventDefault(); gonderSkor(inp, gonder, gec, not, g); });
      durum.inp = inp;
    }

    // sekmeler: (birden çok mod varsa) mod satırı, sonra dönem satırı
    const modlar = Object.keys(MODLAR);
    const dugmeler = [];
    const satirlar = modlar.length > 1 ? [modlar.map((m) => [MODLAR[m], 'mode', m])] : [];
    satirlar.push([['TÜM ZAMANLAR', 'period', 'all'], ['BU HAFTA', 'period', 'week']]);
    for (const satir of satirlar) {
      const sekme = el('div', 'skor-sekme');
      for (const [ad, k, v] of satir) {
        const b = el('button', '', ad);
        b.type = 'button';
        b.addEventListener('click', () => { durum[k] = v; yenile(); });
        sekme.appendChild(b);
        dugmeler.push([b, k, v]);
      }
      kutu.appendChild(sekme);
    }
    const liste = el('div');
    kutu.appendChild(liste);
    const ayak = el('div', 'skor-alt-satir');
    const kapa = el('button', '', 'KAPAT'); kapa.type = 'button';
    kapa.addEventListener('click', () => kapat());
    ayak.append(el('span', '', 'Esc: kapat'), kapa);
    kutu.appendChild(ayak);
    kok.addEventListener('pointerdown', (e) => { if (e.target === kok) kapat(); });
    document.body.appendChild(kok);
    durum.alt = alt; durum.liste = liste; durum.sekmeler = dugmeler;
    yenile();
    setTimeout(() => { (durum && durum.inp ? durum.inp : kapa).focus(); }, 30);
  }

  function gonderSkor(inp, gonder, gec, not, form) {
    const b = durum.bekleyen;
    const ad = inp.value.replace(/\s+/g, ' ').trim();
    if (ad.length < 2) { not.textContent = MESAJ.name_short; not.className = 'skor-not hata'; inp.focus(); return; }
    if (!b.run.token) { not.textContent = MESAJ.yok; not.className = 'skor-not hata'; return; }
    gonder.disabled = true; gec.disabled = true; not.className = 'skor-not'; not.textContent = 'Gönderiliyor…';
    istek(`/v1/games/${OYUN}/scores`, { token: b.run.token, name: ad, score: b.score, meta: b.meta }).then((res) => {
      if (!kok || !durum || durum.bekleyen !== b) return;
      if (res.ok) {
        store.set('skor-ad', res.j.name || ad);
        durum.ben = res.j.name || ad;
        durum.bekleyen = null;
        const r = res.j;
        form.replaceChildren(el('div', 'skor-puan', r.personal_best ? `Yeni kişisel rekor! ${r.rank}. sıradasın.` : `Kaydedildi. En iyi skorunla ${r.rank}. sıradasın.`));
        form.firstChild.style.color = RENK.ikinci;
        yenile();
        return;
      }
      const c = kod(res);
      not.textContent = MESAJ[c] || MESAJ.db_unavailable; not.className = 'skor-not hata';
      const tekrar = c === 'ag' || c === 'db_unavailable' || c === 'rate_limited' || c.startsWith('name_');
      gonder.disabled = !tekrar; gec.disabled = false;
      if (c.startsWith('name_')) inp.focus();
    });
  }

  function yenile() {
    if (!durum) return;
    const d = durum, m = d.mode, p = d.period;
    d.alt.textContent = (Object.keys(MODLAR).length > 1 ? MODLAR[m] + ' · ' : '') + (p === 'week' ? 'BU HAFTA' : 'TÜM ZAMANLAR');
    for (const [b, k, v] of d.sekmeler) b.setAttribute('aria-pressed', String(d[k] === v));
    d.liste.replaceChildren(el('div', 'skor-bos', 'Yükleniyor…'));
    istek(`/v1/games/${OYUN}/scores?mode=${encodeURIComponent(m)}&period=${p}&limit=10`).then((res) => {
      if (durum !== d || d.mode !== m || d.period !== p) return;
      if (!res.ok) { d.liste.replaceChildren(el('div', 'skor-bos', MESAJ[kod(res)] || MESAJ.ag)); return; }
      const rows = res.j.entries || [];
      if (!rows.length) { d.liste.replaceChildren(el('div', 'skor-bos', p === 'week' ? 'Bu hafta henüz skor yok.' : 'Henüz skor yok. İlk sen ol!')); return; }
      const t = el('table', 'skor-tablo');
      const ben = (d.ben || '').toLocaleLowerCase('tr-TR');
      for (const e of rows) {
        const tr = el('tr', ben && e.name.toLocaleLowerCase('tr-TR') === ben ? 'ben' : '');
        const r = el('td', 'r'); r.appendChild(el('span', 'skor-rozet' + (e.rank <= 3 ? ' r' + e.rank : ''), String(e.rank)));
        tr.append(r, el('td', 'n', e.name), el('td', 's', fmt(e.score)));
        t.appendChild(tr);
      }
      d.liste.replaceChildren(t);
    });
  }

  function kapat(sessiz) {
    if (!kok) return;
    kok.remove(); kok = null; durum = null;
    if (!sessiz && ayar.onClose) try { ayar.onClose(); } catch (e) { /* yok */ }
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (e) { /* yok */ }
  }

  // Açıkken klavye oyuna gitmez (yazarken Z, boşluk, oklar oyunu oynatmasın). keyup geçer: basılı kalan tuş takılmasın.
  addEventListener('keydown', (e) => {
    if (!kok) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); kapat(); }
  }, true);

  function init(o) {
    Object.assign(ayar, o || {});
    const b = document.getElementById('skorTablosu');
    if (b && enabled) {
      b.hidden = false;
      b.addEventListener('click', () => (kok ? kapat() : ac({})));
    }
  }

  window.OYUN_SKOR = { enabled, init, runStart, runEnd, show: (mode) => ac({ mode }), close: () => kapat(), isOpen: () => !!kok };
})();
