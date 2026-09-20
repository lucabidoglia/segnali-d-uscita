(function () {
  'use strict';
  const VERSION = '1.3.0';
  const D = window.SDU_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur0 = n => Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' });
  const eur2 = n => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const ICON = {
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="10" height="18" rx="1"/><path d="M11 12h10M18 8l4 4-4 4"/></svg>',
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.7L21 16M21 21v-5h-5"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6"/></svg>',
    snooze: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0M3 3l18 18"/></svg>'
  };

  /* ---------- motore di rischio (stesso modello di "Segnali di uscita") ---------- */
  const PARAMS = { oneri: 1.38, ore: 1730, mult: 1.75 };
  const bandBy = Object.fromEntries(D.bands.map(b => [b.id, b]));
  const fnBand = Object.fromEntries(D.funzioni.map(f => [f.fn, f.band]));
  const SAT = { 1: 20, 2: 12, 3: 0, 4: -7, 5: -14 }, LOAD = { 1: -4, 2: -2, 3: 0, 4: 8, 5: 14 };
  const RAW_MIN = -26, RAW_MAX = 90; // estremi realistici: il massimo teorico (somma di tutti i driver) non si verifica mai
  const mktHour = band => Math.round(bandBy[band].media * PARAMS.oneri / PARAMS.ore * 100) / 100;
  const LABEL = { sat: 'Soddisfazione', promo: 'Crescita ferma', extra: 'Straordinari', recog: 'Riconoscimento', comp: 'Retribuzione', load: 'Carico', behav: 'Comportamento', market: 'Mercato esterno', mobil: 'Mobilità interna' };
  function compute(f, band, co) {
    const dr = [];
    dr.push(['sat', SAT[f.sat]], ['promo', f.promo], ['extra', f.extra], ['recog', f.recog]);
    let compPts = f.comp || 0, dev = null;
    if (band && co > 0) {
      dev = (co - mktHour(band)) / mktHour(band) * 100;
      compPts = dev < -15 ? 18 : dev < -7 ? 12 : dev < -2 ? 5 : dev > 7 ? -8 : 0;
    }
    dr.push(['comp', compPts], ['load', LOAD[f.load]], ['behav', f.behav], ['market', f.market], ['mobil', f.mobil]);
    const raw = dr.reduce((a, d) => a + d[1], 0);
    const score = Math.max(0, Math.min(100, Math.round((raw - RAW_MIN) / (RAW_MAX - RAW_MIN) * 100)));
    const level = score >= 70 ? 'Alto' : score >= 40 ? 'Medio' : 'Basso';
    const ps = (score >= 70 ? 3 : score >= 40 ? 2 : 1) + (f.perf || 0) + (f.crit || 0);
    const priority = ps >= 6 ? 'Critica' : ps >= 5 ? 'Alta' : ps >= 3 ? 'Media' : 'Bassa';
    const drivers = dr.filter(d => d[1] !== 0).map(d => ({ k: d[0], lab: LABEL[d[0]], pts: d[1] })).sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
    return { score, level, priority, drivers, dev };
  }
  D.people.forEach(p => {
    Object.assign(p, compute(p.f, p.band, p.co));
    p.cost = p.ral * PARAMS.mult; p.atRisk = p.cost * p.score / 100;
  });

  /* ---------- stato ---------- */
  const ST = {
    view: 'segnali', q: '', page: 0, PS: 40, sortK: 'score', sortD: -1,
    fSt: null, fArea: null, fLevel: null, fStato: null, sel: new Set(),
    pstate: store.get('sdu_pstate_v1', {}),   // id -> 'auto' | 'snooze'
    cases: store.get('sdu_cases_v1', null) || D.casi.slice(),
    dd: { funzioni: { area: null, fn: null }, equita: { area: null, fn: null } },
    doc: { key: 'scheda', pid: 0, scope: 'all' },
    set: Object.assign({ ragione: 'Orizzonte Industrie S.p.A.', piva: '01234567890', sede: 'Via dell\'Industria 10, 20100 Milano (MI)', fondo: 'Fondimpresa', avviso: 'Avviso 1/2026', ccnl: 'CCNL Metalmeccanica Industria', firma: 'Il Legale Rappresentante', ore: 1720, inps: 30, inailU: 0.8, inailP: 3.5, tfr: 7.41 }, store.get('sdu_settings_v1', {})),
    ev: { ident: '', pid: '', ral: 30000, interv: 2500, f: { sat: 3, load: 3, promo: 0, extra: 0, recog: 0, comp: 0, behav: 0, market: 0, mobil: 0, perf: 1, crit: 1 } }
  };
  const saveP = () => store.set('sdu_pstate_v1', ST.pstate);
  const saveC = () => store.set('sdu_cases_v1', ST.cases);
  const statoOf = p => ST.pstate[p.id] || 'new';
  function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2400); }

  /* ---------- shell ---------- */
  const VIEWS = [['quadro', 'Quadro'], ['segnali', 'Segnali'], ['valutazione', 'Valutazione'], ['funzioni', 'Funzioni & rischio'], ['equita', 'Equità'], ['documenti', 'Documenti'], ['registro', 'Registro']];
  function drawMenu() {
    $('#menu').innerHTML = VIEWS.map(([k, l]) => `<button data-v="${k}" ${ST.view === k ? 'aria-current="page"' : ''}>${l}</button>`).join('');
  }
  $('#menu').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.v); });
  function go(v) { ST.view = v; ST.page = 0; location.hash = v; render(); }
  function setTheme(t) { document.documentElement.dataset.theme = t; $('#themeBtn').innerHTML = t === 'dark' ? ICON.sun : ICON.moon; }
  $('#themeBtn').addEventListener('click', () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; setTheme(t); try { localStorage.setItem('sdu_theme', t); } catch (e) {} });
  $('#ver').textContent = VERSION;

  /* ---------- Segnali (lista in stile Odoo) ---------- */
  function filtered() {
    const q = ST.q.trim().toLowerCase();
    return D.people.filter(p =>
      (!ST.fSt || p.st === ST.fSt) && (!ST.fArea || p.area === ST.fArea) && (!ST.fLevel || p.level === ST.fLevel) &&
      (ST.fStato ? statoOf(p) === ST.fStato : statoOf(p) !== 'snooze') &&
      (!q || (p.nome + ' ' + p.mat + ' ' + p.fn + ' ' + p.mans).toLowerCase().includes(q))
    ).sort((a, b) => {
      const x = a[ST.sortK], y = b[ST.sortK];
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * ST.sortD;
    });
  }
  const cnt = fn => D.people.filter(fn).length;
  function sideBtn(label, n, on, attr, d = 0) { return `<li><button class="${on ? 'on' : ''}" style="--d:${d}" ${attr}><span>${esc(label)}</span><small>${n}</small></button></li>`; }
  function viewSegnali() {
    const rows = filtered(), pages = Math.max(1, Math.ceil(rows.length / ST.PS));
    if (ST.page >= pages) ST.page = 0;
    const vis = rows.slice(ST.page * ST.PS, ST.page * ST.PS + ST.PS);
    const areas = [...new Set(D.strutture.map(s => s.area))];
    const side = `
      <h4>${ICON.folder} Sedi</h4><ul>
      ${sideBtn('Tutte', D.people.length, !ST.fSt && !ST.fArea, 'data-f="all"')}
      ${areas.map(a => sideBtn(a, cnt(p => p.area === a), ST.fArea === a, `data-f="area" data-v="${esc(a)}"`, 1) +
        D.strutture.filter(s => s.area === a).map(s => sideBtn(s.nome, cnt(p => p.st === s.nome), ST.fSt === s.nome, `data-f="st" data-v="${esc(s.nome)}"`, 2)).join('')).join('')}
      </ul>
      <h4>${ICON.folder} Livello</h4><ul>
      ${sideBtn('Tutti', D.people.length, !ST.fLevel, 'data-f="level"')}
      ${['Alto', 'Medio', 'Basso'].map(l => sideBtn(l, cnt(p => p.level === l), ST.fLevel === l, `data-f="level" data-v="${l}"`, 1)).join('')}
      </ul>
      <h4>${ICON.folder} Stato</h4><ul>
      ${sideBtn('Attivi', cnt(p => statoOf(p) !== 'snooze'), !ST.fStato, 'data-f="stato"')}
      ${sideBtn('In monitoraggio', cnt(p => statoOf(p) === 'auto'), ST.fStato === 'auto', 'data-f="stato" data-v="auto"', 1)}
      ${sideBtn('Rinviati', cnt(p => statoOf(p) === 'snooze'), ST.fStato === 'snooze', 'data-f="stato" data-v="snooze"', 1)}
      </ul>`;
    const th = (k, l, n, c = '') => `<th class="${n ? 'n' : ''} ${c}" data-s="${k}">${l}${ST.sortK === k ? (ST.sortD > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    const allOn = vis.length && vis.every(p => ST.sel.has(p.id));
    const body = vis.map(p => {
      const s = statoOf(p);
      const tag = s === 'auto' ? ' <span class="tag auto">Monitorato</span>' : s === 'snooze' ? ' <span class="tag">Rinviato</span>' : '';
      return `<tr class="${ST.sel.has(p.id) ? 'sel' : ''}" data-id="${p.id}">
        <td><input type="checkbox" data-c="${p.id}" ${ST.sel.has(p.id) ? 'checked' : ''} aria-label="Seleziona ${esc(p.nome)}"></td>
        <td><b>[${p.mat}]</b> ${esc(p.nome)}${tag}</td><td class="wrap2">${esc(p.st)}</td><td class="mut wrap2">${esc(p.fn)}</td>
        <td class="n">${p.anz.toLocaleString('it-IT')} a</td>
        <td class="n"><span class="score s-${p.level}">${p.score}</span></td>
        <td class="drv c-drv" title="${esc(p.drivers.slice(0, 3).map(d => d.lab).join(', '))}">${esc(p.drivers.slice(0, 2).map(d => d.lab).join(' · '))}</td>
        <td class="pri pri-${p.priority}">${p.priority}</td><td class="n">€ ${eur0(p.atRisk)}</td>
        <td class="act">
          <button data-a="case" data-id="${p.id}" title="Apri caso" aria-label="Apri caso">${ICON.door}<span class="lbl">Apri caso</span></button>
          <button data-a="auto" data-id="${p.id}" title="${s === 'auto' ? 'Ferma monitoraggio' : 'Monitora'}" aria-label="Monitora">${ICON.auto}<span class="lbl">${s === 'auto' ? 'Ferma' : 'Monitora'}</span></button>
          <button data-a="snooze" data-id="${p.id}" title="${s === 'snooze' ? 'Riattiva' : 'Rinvia'}" aria-label="Rinvia">${ICON.snooze}<span class="lbl">${s === 'snooze' ? 'Riattiva' : 'Rinvia'}</span></button>
          <button data-a="doc" data-id="${p.id}" title="Scheda formazione finanziata" aria-label="Scheda formazione">${ICON.doc}<span class="lbl">Scheda</span></button></td></tr>`;
    }).join('');
    const from = rows.length ? ST.page * ST.PS + 1 : 0, to = Math.min(rows.length, (ST.page + 1) * ST.PS);
    return `
      <div class="cp">
        <button class="btn" id="bNew">Nuova</button>
        <button class="btn" id="bCase" ${ST.sel.size ? '' : 'disabled'}>Apri casi</button>
        <button class="btn" id="bSnz" ${ST.sel.size ? '' : 'disabled'}>Rinvia</button>
        <button class="btn" id="bTop">Priorità critiche</button>
        <h1>Segnali</h1>
        ${ST.sel.size ? `<span class="chip"><b>${ST.sel.size}</b> selezionati <button id="bClr" aria-label="Deseleziona">×</button></span>
          <div class="dd" id="dd"><button class="btn sec" id="ddB">⚙ Azioni</button><div class="dd-m">
            <button data-a="csv">Esporta CSV</button><button data-a="schede">Schede formazione (Word)</button><button data-a="autoSel">Monitora selezionati</button><button data-a="unsnz">Riattiva selezionati</button></div></div>` : ''}
        <span class="grow"></span>
        <input class="search" id="q" placeholder="Cerca persona, matricola, funzione…" value="${esc(ST.q)}" aria-label="Cerca">
        <span class="pager">${from}-${to} / ${rows.length}<button id="pp" aria-label="Precedente">‹</button><button id="pn" aria-label="Successiva">›</button></span>
      </div>
      <div class="wrap"><aside class="side" id="side">${side}</aside>
      <div class="content">${rows.length ? `<table><thead><tr><th><input type="checkbox" id="all" ${allOn ? 'checked' : ''} aria-label="Seleziona tutto"></th>
        ${th('nome', 'Persona')}${th('st', 'Struttura')}${th('fn', 'Funzione')}${th('anz', 'Anz.', 1)}${th('score', 'Rischio', 1)}<th class="c-drv">Driver principali</th>${th('priority', 'Priorità')}${th('atRisk', 'A rischio', 1)}<th></th></tr></thead>
        <tbody>${body}</tbody></table>` : '<div class="empty">Nessun segnale con questi filtri.</div>'}</div></div>`;
  }
  function bindSegnali() {
    const app = $('#app');
    $('#side').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const v = b.dataset.v || null;
      if (b.dataset.f === 'all') { ST.fSt = ST.fArea = null; }
      if (b.dataset.f === 'area') { ST.fArea = v; ST.fSt = null; }
      if (b.dataset.f === 'st') { ST.fSt = v; ST.fArea = null; }
      if (b.dataset.f === 'level') ST.fLevel = v;
      if (b.dataset.f === 'stato') ST.fStato = v;
      ST.page = 0; render();
    });
    $('#q').addEventListener('input', e => { ST.q = e.target.value; ST.page = 0; const p = e.target.selectionStart; render(); const q = $('#q'); q.focus(); q.setSelectionRange(p, p); });
    $('#pp').onclick = () => { if (ST.page > 0) { ST.page--; render(); } };
    $('#pn').onclick = () => { ST.page++; render(); };
    $('#bNew').onclick = () => go('valutazione');
    $('#bTop').onclick = () => { ST.fLevel = null; ST.fStato = null; ST.sortK = 'score'; ST.sortD = -1; ST.q = ''; ST.sel = new Set(filtered().filter(p => p.priority === 'Critica').map(p => p.id)); ST.page = 0; render(); toast(ST.sel.size + ' priorità critiche selezionate'); };
    $('#bCase').onclick = () => bulk('case'); $('#bSnz').onclick = () => bulk('snooze');
    if ($('#bClr')) $('#bClr').onclick = () => { ST.sel.clear(); render(); };
    if ($('#ddB')) $('#ddB').onclick = e => { e.stopPropagation(); $('#dd').classList.toggle('open'); };
    document.onclick = e => { if (!e.target.closest('.dd')) document.querySelectorAll('.dd.open').forEach(d => d.classList.remove('open')); };
    app.querySelectorAll('.dd-m button').forEach(b => b.onclick = () => bulk(b.dataset.a));
    app.querySelectorAll('th[data-s]').forEach(h => h.onclick = () => { const k = h.dataset.s; ST.sortD = ST.sortK === k ? -ST.sortD : (k === 'nome' || k === 'st' || k === 'fn' ? 1 : -1); ST.sortK = k; render(); });
    const all = $('#all'); if (all) all.onchange = e => { filtered().slice(ST.page * ST.PS, ST.page * ST.PS + ST.PS).forEach(p => e.target.checked ? ST.sel.add(p.id) : ST.sel.delete(p.id)); render(); };
    app.querySelectorAll('[data-c]').forEach(c => c.onchange = e => { const id = +c.dataset.c; e.target.checked ? ST.sel.add(id) : ST.sel.delete(id); render(); });
    app.querySelectorAll('td.act button').forEach(b => b.onclick = () => rowAct(b.dataset.a, +b.dataset.id));
  }
  function openCase(p) {
    const id = Math.max(0, ...ST.cases.map(c => c.id)) + 1;
    ST.cases.unshift({ id, ts: new Date().toISOString().slice(0, 19), ref: p.nome, score: p.score, band: p.level, priority: p.priority, status: 'Aperto', note: 'Driver: ' + p.drivers.slice(0, 3).map(d => d.lab).join(', ') + '.' });
    saveC();
  }
  function rowAct(a, id) {
    const p = D.people.find(x => x.id === id);
    if (a === 'case') { openCase(p); toast('Caso aperto per ' + p.nome); }
    if (a === 'auto') { statoOf(p) === 'auto' ? delete ST.pstate[id] : ST.pstate[id] = 'auto'; saveP(); }
    if (a === 'doc') { ST.doc.key = 'scheda'; ST.doc.pid = id; go('documenti'); return; }
    if (a === 'snooze') { statoOf(p) === 'snooze' ? delete ST.pstate[id] : ST.pstate[id] = 'snooze'; saveP(); }
    render();
  }
  function bulk(a) {
    const ps = D.people.filter(p => ST.sel.has(p.id));
    if (a === 'case') { ps.forEach(openCase); toast(ps.length + ' casi aperti'); }
    if (a === 'snooze') { ps.forEach(p => ST.pstate[p.id] = 'snooze'); saveP(); toast(ps.length + ' rinviati'); }
    if (a === 'autoSel') { ps.forEach(p => ST.pstate[p.id] = 'auto'); saveP(); toast(ps.length + ' in monitoraggio'); }
    if (a === 'unsnz') { ps.forEach(p => delete ST.pstate[p.id]); saveP(); toast(ps.length + ' riattivati'); }
    if (a === 'schede') { downloadDoc('Schede_formazione_finanziata', ps.map(p => schedaHtml(p)).join('<div style="page-break-after:always"></div>')); toast(ps.length + ' schede generate'); }
    if (a === 'csv') csv(['Matricola', 'Persona', 'Struttura', 'Funzione', 'Anzianità (anni)', 'Rischio', 'Livello', 'Priorità', 'Costo a rischio (€)'],
      ps.map(p => [p.mat, p.nome, p.st, p.fn, p.anz, p.score, p.level, p.priority, Math.round(p.atRisk)]), 'segnali');
    if (a !== 'csv' && a !== 'schede') ST.sel.clear();
    render();
  }
  function csv(head, rows, name) {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const blob = new Blob(['﻿' + [head, ...rows].map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  /* ---------- Quadro ---------- */
  const avg = (a, f) => a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0;
  function funcStats() {
    return D.funzioni.map(({ fn, band }) => {
      const ps = D.people.filter(p => p.fn === fn), F = ps.filter(p => p.g === 'F'), M = ps.filter(p => p.g === 'M');
      const coF = F.length >= 3 ? avg(F, p => p.co) : null, coM = M.length >= 3 ? avg(M, p => p.co) : null;
      return { fn, band, n: ps.length, nF: F.length, nM: M.length, co: avg(ps, p => p.co), mk: mktHour(band), coF, coM,
        gap: coF && coM ? (coM - coF) / coM * 100 : null, score: avg(ps, p => p.score), hi: ps.filter(p => p.level === 'Alto').length, atRisk: ps.reduce((s, p) => s + p.atRisk, 0) };
    });
  }
  function viewQuadro() {
    const P = D.people, n = P.length, hi = P.filter(p => p.level === 'Alto'), F = P.filter(p => p.g === 'F');
    const fs = funcStats(), gaps = fs.filter(f => f.gap !== null);
    const adj = gaps.length ? gaps.reduce((s, f) => s + f.gap * f.n, 0) / gaps.reduce((s, f) => s + f.n, 0) : 0;
    const mM = avg(P.filter(p => p.g === 'M'), p => p.co), raw = (mM - avg(F, p => p.co)) / mM * 100;
    const kp = (k, v, c = '') => `<div class="kpi ${c}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const buckets = Array.from({ length: 10 }, (_, i) => P.filter(p => p.score >= i * 10 && (i === 9 ? p.score <= 100 : p.score < i * 10 + 10)).length);
    const mx = Math.max(...buckets);
    const byS = D.strutture.map(s => ({ s: s.nome, a: avg(P.filter(p => p.st === s.nome), p => p.score) })).sort((a, b) => b.a - a.a);
    const cr = P.filter(p => p.priority === 'Critica').length;
    return `<div class="page"><div class="note">Periodo <b>${D.meta.periodo}</b> · ${esc(D.meta.azienda)} · tutti i dati sono <b>inventati</b> a scopo dimostrativo.</div>
      <div class="kpis">${kp('Organico', n)}${kp('Rischio alto', hi.length + ' <small>(' + Math.round(hi.length / n * 100) + '%)</small>', 'bad')}${kp('Priorità critiche', cr, 'bad')}
      ${kp('Costo a rischio', '€ ' + eur2(P.reduce((s, p) => s + p.atRisk, 0) / 1e6) + '<small> M</small>')}${kp('Punteggio medio', Math.round(avg(P, p => p.score)))}
      ${kp('Quota femminile', Math.round(F.length / n * 100) + '<small>%</small>')}${kp('Divario retr. grezzo', (raw > 0 ? '+' : '') + raw.toFixed(1) + '<small>%</small>', Math.abs(raw) > 5 ? 'bad' : 'ok')}
      ${kp('Divario a pari funzione', (adj > 0 ? '+' : '') + adj.toFixed(1) + '<small>%</small>', Math.abs(adj) > 5 ? 'bad' : 'ok')}</div>
      <div class="two"><div class="card"><h2>Distribuzione del rischio <span>persone per fascia di punteggio</span></h2><div class="b"><div class="hist">
        ${buckets.map((c, i) => `<div>${c}<i style="height:${c / mx * 100}%;background:var(--${i >= 7 ? 'hi' : i >= 4 ? 'mid' : 'lo'})"></i></div>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;color:var(--mut);font-size:11px;margin-top:4px"><span>0</span><span>50</span><span>100</span></div></div></div>
      <div class="card"><h2>Rischio medio per struttura</h2><div class="b bars">${byS.map(x => `<div class="bar"><span>${esc(x.s)}</span><i style="width:${x.a}%"></i><b>${Math.round(x.a)}</b></div>`).join('')}</div></div></div>
      <div class="card"><h2>Da guardare per prime <span>rischio più alto</span></h2><table><tbody>
        ${P.filter(p => p.priority === 'Critica').sort((a, b) => b.score - a.score).slice(0, 6).map(p => `<tr><td><b>[${p.mat}]</b> ${esc(p.nome)}</td><td>${esc(p.st)}</td><td class="mut">${esc(p.fn)}</td><td><span class="score s-${p.level}">${p.score}</span></td><td class="drv">${esc(p.drivers.slice(0, 3).map(d => d.lab).join(' · '))}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  /* ---------- Valutazione ---------- */
  const OPT = {
    sat: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], load: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']],
    promo: [[0, 'No'], [8, 'Ferma'], [16, 'Bloccata']], extra: [[0, 'Normali'], [6, 'Elevati'], [12, 'Molto elevati']],
    recog: [[0, 'Adeguato'], [8, 'Scarso'], [16, 'Assente']], behav: [[0, 'Nessuno'], [10, 'Disimpegno'], [20, 'Ritiro']],
    mobil: [[0, 'Non richiesta'], [6, 'Richiesta'], [12, 'Bloccata']], market: [[0, 'Debole'], [4, 'Normale'], [8, 'Molto attivo']],
    comp: [[0, 'In linea'], [5, 'Sotto'], [12, 'Molto sotto'], [18, 'Critico']], perf: [[0, 'Standard'], [1, 'Alta'], [2, 'Eccellente']], crit: [[0, 'Sostituibile'], [1, 'Importante'], [2, 'Critica']]
  };
  const FLAB = { sat: 'Soddisfazione (1–5)', load: 'Carico di lavoro (1–5)', promo: 'Crescita', extra: 'Straordinari', recog: 'Riconoscimento', behav: 'Comportamento', mobil: 'Mobilità interna', market: 'Mercato esterno', comp: 'Retribuzione (manuale)', perf: 'Prestazione', crit: 'Competenze critiche' };
  function evalRes() {
    const e = ST.ev, p = e.pid ? D.people.find(x => x.id === +e.pid) : null;
    const r = compute(e.f, p ? p.band : null, p ? p.co : 0);
    const cost = e.ral * PARAMS.mult;
    return { ...r, p, cost, atRisk: cost * r.score / 100 };
  }
  function viewValutazione() {
    const e = ST.ev, r = evalRes();
    const opts = ['<option value="">— nessuna (inserimento libero) —</option>'].concat(D.people.map(p => `<option value="${p.id}" ${+e.pid === p.id ? 'selected' : ''}>${esc(p.nome)} · ${esc(p.fn)}</option>`)).join('');
    const seg = k => `<div><label>${FLAB[k]}</label><div class="seg" data-k="${k}">${OPT[k].map(([v, l]) => `<button aria-pressed="${e.f[k] === v}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
    const mx = Math.max(1, ...r.drivers.map(d => Math.abs(d.pts)));
    const col = r.level === 'Alto' ? 'hi' : r.level === 'Medio' ? 'mid' : 'lo';
    return `<div class="cp"><h1>Valutazione individuale</h1><span class="grow"></span><button class="btn sec" id="evRst">Azzera</button><button class="btn" id="evSave">Salva nel Registro</button></div>
    <div class="page"><div class="two" style="align-items:start">
      <div class="card"><h2>Fattori</h2><div class="b form">
        <div><label>Persona (ancora la retribuzione al mercato)</label><select id="evP">${opts}</select></div>
        <div><label>Riferimento</label><input type="text" id="evId" value="${esc(e.ident)}" placeholder="Es. Matricola o iniziali"></div>
        ${['sat', 'load', 'promo', 'extra', 'recog', 'behav', 'mobil', 'market'].map(seg).join('')}
        ${r.p ? `<div class="note" style="margin:0">Retribuzione derivata: ${eur2(r.p.co)} €/h vs mercato ${eur2(mktHour(r.p.band))} €/h (${r.dev > 0 ? '+' : ''}${r.dev.toFixed(0)}%).</div>` : seg('comp')}
        ${seg('perf')}${seg('crit')}
      </div></div>
      <div><div class="card"><h2>Esito</h2><div class="b">
        <div style="display:flex;align-items:center;gap:18px"><div class="big" style="color:var(--${col})">${r.score}</div><div><span class="score s-${r.level}">${r.level}</span><div style="margin-top:6px">Priorità <span class="pri pri-${r.priority}">${r.priority}</span></div></div></div>
        <div class="gauge"><i style="width:${r.score}%;background:var(--${col})"></i></div>
        <h2 style="border:0;padding:12px 0 6px">Driver</h2>
        ${r.drivers.length ? r.drivers.map(d => `<div class="drow"><span>${d.lab}</span><div class="dtrack"><i style="background:var(--${d.pts > 0 ? 'hi' : 'lo'});${d.pts > 0 ? 'left:50%' : 'right:50%'};width:${Math.abs(d.pts) / mx * 50}%"></i></div><b>${d.pts > 0 ? '+' : ''}${d.pts}</b></div>`).join('') : '<div class="empty">Nessun fattore attivo.</div>'}
      </div></div>
      <div class="card"><h2>Economia della ritenzione</h2><div class="b form">
        <div class="two"><div><label>RAL (€)</label><input type="number" id="evRal" value="${e.ral}" min="0" step="500"></div><div><label>Costo intervento (€)</label><input type="number" id="evInt" value="${e.interv}" min="0" step="100"></div></div>
        <div class="kpis" style="margin:0"><div class="kpi"><div class="k">Costo sostituzione</div><div class="v" style="font-size:20px">€ ${eur0(r.cost)}</div></div>
        <div class="kpi ${r.score >= 70 ? 'bad' : ''}"><div class="k">Costo a rischio</div><div class="v" style="font-size:20px">€ ${eur0(r.atRisk)}</div></div>
        <div class="kpi"><div class="k">A rischio ÷ intervento</div><div class="v" style="font-size:20px">${e.interv > 0 ? (r.atRisk / e.interv).toFixed(1) + '×' : '—'}</div></div></div>
      </div></div></div></div></div>`;
  }
  function bindValutazione() {
    const e = ST.ev, app = $('#app');
    app.querySelectorAll('.seg').forEach(g => g.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; e.f[g.dataset.k] = +b.dataset.v; render(); });
    $('#evP').onchange = ev => { e.pid = ev.target.value; const p = e.pid ? D.people.find(x => x.id === +e.pid) : null; if (p) { Object.assign(e.f, p.f); e.ral = p.ral; e.ident = p.nome; } render(); };
    $('#evId').oninput = ev => e.ident = ev.target.value;
    $('#evRal').onchange = ev => { e.ral = +ev.target.value || 0; render(); };
    $('#evInt').onchange = ev => { e.interv = +ev.target.value || 0; render(); };
    $('#evRst').onclick = () => { e.pid = ''; e.ident = ''; e.f = { sat: 3, load: 3, promo: 0, extra: 0, recog: 0, comp: 0, behav: 0, market: 0, mobil: 0, perf: 1, crit: 1 }; render(); };
    $('#evSave').onclick = () => {
      const r = evalRes(), id = Math.max(0, ...ST.cases.map(c => c.id)) + 1;
      ST.cases.unshift({ id, ts: new Date().toISOString().slice(0, 19), ref: e.ident.trim() || '—', score: r.score, band: r.level, priority: r.priority, status: 'Aperto', note: r.drivers.slice(0, 3).map(d => d.lab).join(', ') });
      saveC(); toast('Caso salvato nel Registro');
    };
  }

  /* ---------- Drill-down: Funzioni & rischio ed Equità (area → funzione → persona) ---------- */
  function gstats(list) {
    const F = list.filter(p => p.g === 'F'), M = list.filter(p => p.g === 'M'), ok = F.length >= 3 && M.length >= 3;
    const coF = ok ? avg(F, p => p.co) : null, coM = ok ? avg(M, p => p.co) : null;
    return { n: list.length, nF: F.length, nM: M.length, coF, coM, gap: ok ? (coM - coF) / coM * 100 : null,
      co: avg(list, p => p.co), mk: avg(list, p => mktHour(p.band)), score: avg(list, p => p.score), hi: list.filter(p => p.level === 'Alto').length, atRisk: list.reduce((s, p) => s + p.atRisk, 0) };
  }
  function openEval(p) {
    Object.assign(ST.ev, { pid: String(p.id), ident: p.nome, ral: p.ral }); ST.ev.f = Object.assign({}, p.f); go('valutazione');
  }
  const colDev = d => `style="color:var(--${d < -7 ? 'hi' : d > 7 ? 'lo' : 'mut'})"`;
  function viewDrill(kind) {
    const dd = ST.dd[kind], eq = kind === 'equita';
    let list = D.people.filter(p => (!dd.area || p.area === dd.area) && (!dd.fn || p.fn === dd.fn));
    const level = dd.fn ? 3 : dd.area ? 2 : 1, key = level === 1 ? 'area' : 'fn';
    const crumb = `<nav class="crumb" aria-label="Percorso"><button data-l="0" ${level === 1 ? 'disabled' : ''}>Tutte le aree</button>${dd.area ? ` › <button data-l="1" ${level === 2 ? 'disabled' : ''}>${esc(dd.area)}</button>` : ''}${dd.fn ? ` › <b>${esc(dd.fn)}</b>` : ''}</nav>`;
    const title = eq ? 'Equità retributiva' : 'Funzioni & rischio';
    let body;
    if (level < 3) {
      const groups = [...new Set(list.map(p => p[key]))].map(g => ({ g, s: gstats(list.filter(p => p[key] === g)) })).sort((a, b) => eq ? a.g.localeCompare(b.g) : b.s.score - a.s.score);
      const rows = groups.map(({ g, s }) => {
        if (eq) { const has = s.gap !== null, over = has && Math.abs(s.gap) >= 5;
          return `<tr class="click" data-g="${esc(g)}"><td><b>${esc(g)}</b> <span class="chev">›</span></td><td class="n">${s.nF}</td><td class="n">${s.nM}</td><td class="n">${s.coF ? eur2(s.coF) : '—'}</td><td class="n">${s.coM ? eur2(s.coM) : '—'}</td><td class="n" style="color:var(--${over ? 'hi' : 'mut'})">${has ? pc(s.gap) : 'n.d.'}</td><td>${!has ? '<span class="tag">Campione ridotto</span>' : over ? '<span class="tag" style="border-color:var(--hi);color:var(--hi)">Da verificare</span>' : '<span class="tag" style="border-color:var(--lo);color:var(--lo)">In soglia</span>'}</td></tr>`; }
        const d = (s.co - s.mk) / s.mk * 100, lv = s.score >= 70 ? 'Alto' : s.score >= 40 ? 'Medio' : 'Basso';
        return `<tr class="click" data-g="${esc(g)}"><td><b>${esc(g)}</b> <span class="chev">›</span></td><td class="n">${s.n}</td><td class="n"><span class="score s-${lv}">${Math.round(s.score)}</span></td><td class="n">${s.hi}</td><td class="n">${eur2(s.co)}</td><td class="n">${eur2(s.mk)}</td><td class="n" ${colDev(d)}>${pc(d)}</td><td class="n">€ ${eur0(s.atRisk)}</td></tr>`; }).join('');
      const th = eq ? ['Gruppo', 'Donne', 'Uomini', '€/h donne', '€/h uomini', 'Divario', 'Esito'] : ['Gruppo', 'Persone', 'Rischio medio', 'Rischio alto', '€/h coorte', '€/h mercato', 'Scostamento', 'Costo a rischio'];
      body = `<table><thead><tr>${th.map((h, i) => `<th class="${i > 0 && !(eq && i === 6) ? 'n' : ''}">${level === 1 && i === 0 ? 'Area' : h === 'Gruppo' ? 'Funzione' : h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    } else {
      const g = gstats(list), sorted = list.slice().sort((a, b) => eq ? a.co - b.co : b.score - a.score);
      const rows = sorted.map(p => {
        const dm = (p.co - mktHour(p.band)) / mktHour(p.band) * 100, dg = (p.co - g.co) / g.co * 100;
        return eq
          ? `<tr class="click" data-p="${p.id}"><td><b>[${p.mat}]</b> ${esc(p.nome)}</td><td>${p.g === 'F' ? 'Donna' : 'Uomo'}</td><td class="wrap2">${esc(p.st)}</td><td class="wrap2 mut">${esc(p.mans)}</td><td>${esc(p.livello)}</td><td class="n">${p.anz.toLocaleString('it-IT')} a</td><td class="n">${p.fte.toFixed(2).replace('.', ',')}</td><td class="n"><b>${eur2(p.co)}</b></td><td class="n" ${colDev(dg)}>${pc(dg)}</td><td class="n" ${colDev(dm)}>${pc(dm)}</td></tr>`
          : `<tr class="click" data-p="${p.id}"><td><b>[${p.mat}]</b> ${esc(p.nome)}</td><td class="wrap2">${esc(p.st)}</td><td class="wrap2 mut">${esc(p.mans)}</td><td class="n">${p.anz.toLocaleString('it-IT')} a</td><td class="n"><span class="score s-${p.level}">${p.score}</span></td><td class="wrap2" style="min-width:200px;max-width:280px">${p.drivers.slice(0, 3).map(d => `<span class="tag">${esc(d.lab)} ${d.pts > 0 ? '+' : ''}${d.pts}</span>`).join(' ') || '<span class="mut">—</span>'}</td><td class="pri pri-${p.priority}">${p.priority}</td><td class="n">€ ${eur0(p.atRisk)}</td></tr>`;
      }).join('');
      const th = eq ? ['Persona', 'Genere', 'Struttura', 'Mansione', 'Livello', 'Anz.', 'FTE', '€/h', 'vs media gruppo', 'vs mercato'] : ['Persona', 'Struttura', 'Mansione', 'Anz.', 'Rischio', 'Fattori a rischio', 'Priorità', 'A rischio'];
      const numCols = eq ? [5, 6, 7, 8, 9] : [3, 4, 7];
      const sum = eq ? `Donne ${g.nF} · uomini ${g.nM} · divario ${g.gap !== null ? pc(g.gap) : 'n.d. (campione ridotto)'}` : `Rischio medio ${Math.round(g.score)} · ${g.hi} a rischio alto · € ${eur0(g.atRisk)} a rischio`;
      body = `<div class="note" style="margin:12px 16px 0">${esc(dd.fn)} — ${esc(dd.area)} · ${g.n} persone · ${sum}. Clicca una persona per aprire la valutazione individuale.</div>
        <table><thead><tr>${th.map((h, i) => `<th class="${numCols.includes(i) ? 'n' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    const intro = eq ? `<div class="note" style="margin:16px 16px 0">Divario del costo orario medio (uomini − donne) ÷ uomini: positivo = donne pagate meno. Soglia di attenzione <b>5%</b> (Direttiva UE 2023/970). Sotto 3 persone per genere il dato non viene pubblicato. Clicca una riga per scendere di livello fino alla singola persona.</div>` : '';
    return `<div class="cp"><h1>${title}</h1>${crumb}</div>${intro}<div class="page"><div class="card" style="overflow-x:auto">${body}</div></div>`;
  }
  function bindDrill(kind) {
    const dd = ST.dd[kind], app = $('#app');
    app.querySelectorAll('.crumb button').forEach(b => b.onclick = () => { if (b.dataset.l === '0') { dd.area = null; dd.fn = null; } else dd.fn = null; render(); });
    app.querySelectorAll('tr[data-g]').forEach(r => r.onclick = () => { if (!dd.area) dd.area = r.dataset.g; else dd.fn = r.dataset.g; render(); window.scrollTo(0, 0); });
    app.querySelectorAll('tr[data-p]').forEach(r => r.onclick = () => openEval(D.people.find(p => p.id === +r.dataset.p)));
  }

  /* ---------- Registro ---------- */
  function viewRegistro() {
    const st = ['Aperto', 'In corso', 'Chiuso'];
    return `<div class="cp"><h1>Registro casi</h1><span class="grow"></span><button class="btn sec" id="rCsv">Esporta CSV</button></div><div class="page"><div class="card">${ST.cases.length ? `<table><thead><tr><th>#</th><th>Data</th><th>Riferimento</th><th class="n">Rischio</th><th>Priorità</th><th>Stato</th><th>Note</th><th></th></tr></thead><tbody>
      ${ST.cases.map(c => `<tr><td class="mut">${c.id}</td><td class="mut">${new Date(c.ts).toLocaleDateString('it-IT')}</td><td><b>${esc(c.ref)}</b></td><td class="n"><span class="score s-${c.band}">${c.score}</span></td><td class="pri pri-${c.priority}">${c.priority}</td>
      <td><select data-st="${c.id}" style="width:auto">${st.map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td class="mut" style="white-space:normal;max-width:320px">${esc(c.note)}</td>
      <td class="act"><button data-del="${c.id}">Elimina</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nessun caso. Aprine uno da Segnali o da Valutazione.</div>'}</div></div>`;
  }
  function bindRegistro() {
    $('#rCsv').onclick = () => csv(['#', 'Data', 'Riferimento', 'Rischio', 'Livello', 'Priorità', 'Stato', 'Note'], ST.cases.map(c => [c.id, c.ts.slice(0, 10), c.ref, c.score, c.band, c.priority, c.status, c.note]), 'registro');
    document.querySelectorAll('[data-st]').forEach(s => s.onchange = () => { ST.cases.find(c => c.id === +s.dataset.st).status = s.value; saveC(); });
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { ST.cases = ST.cases.filter(c => c.id !== +b.dataset.del); saveC(); render(); });
  }

  /* ---------- Documenti (individuali e aziendali) ---------- */
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const median = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const n1 = v => v.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const pc = v => (v > 0 ? '+' : '') + n1(v) + '%';
  const E2 = v => '€ ' + eur2(v), E0 = v => '€ ' + eur0(v);
  const todayIt = () => new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const gapOf = (f, m) => m ? (m - f) / m * 100 : 0;   // convenzione Direttiva 2023/970: (M − F) ÷ M
  const tbl = (head, rows, right = []) => `<table><tr>${head.map((h, i) => `<th class="${right.includes(i) ? 'n' : ''}">${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${right.includes(i) ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</table>`;
  const kv = rows => `<table>${rows.map(r => `<tr><td style="width:42%">${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
  const docFoot = () => `<div class="foot">Documento generato con Segnali d'uscita · Powered by G1G10 v${VERSION}. I dati dell'organizzazione sono dimostrativi (inventati): prima dell'uso ufficiale sostituirli con i dati reali dell'azienda e verificare il testo normativo vigente.</div>`;
  const sign = extra => `<div class="sig"><div>Luogo e data: ${esc(ST.set.sede.split(',').pop().replace(/\d{5}/, '').trim())}, ${todayIt()}${extra ? '<br>' + extra : ''}</div><div>${esc(ST.set.firma)}</div></div>`;
  const head = (t, sub) => `<div class="sub">${esc(ST.set.ragione)} — P.IVA ${esc(ST.set.piva)} — ${esc(ST.set.sede)}</div><h1>${t}</h1><div class="sub">${sub}</div>`;

  function schedaHtml(p) {
    const S = ST.set, mesi = 6, oreRif = Math.round(S.ore * p.fte), annuo = p.costo * (12 / mesi);
    const coEff = p.costo / p.ore, coRend = annuo / oreRif, of = p.form ? p.form.ore : 0, imp = coRend * of;
    const inail = p.area === 'Uffici' ? S.inailU : S.inailP, k = 1 + (S.inps + inail + S.tfr) / 100;
    const lordo = p.costo / k, inps = lordo * S.inps / 100, ina = lordo * inail / 100, tfr = p.costo - lordo - inps - ina;
    return `<div class="doc">${head('Scheda di rendicontazione del costo orario', `Personale in formazione finanziata — ${esc(S.fondo)} · ${esc(S.avviso)} — periodo dati ${D.meta.periodo}`)}
      <h2>1. Anagrafica e rapporto di lavoro</h2>${kv([['Nominativo', `<b>${esc(p.nome)}</b>`], ['Matricola', p.mat], ['Funzione / mansione', `${esc(p.fn)} — ${esc(p.mans)}`], ['Struttura', esc(p.st)], ['Tipologia rapporto', esc(p.tip)], ['Livello di inquadramento', `${esc(S.ccnl)} — livello ${esc(p.livello)}`], ['Impegno contrattuale (FTE)', p.fte.toFixed(2).replace('.', ',') + ` (${Math.round(p.fte * 100)}%)`]])}
      <h2>2. Costo del lavoro nel periodo</h2>${kv([['Periodo di riferimento', `${D.meta.periodo} (${mesi} mesi)`], ['Ore retribuite nel periodo', eur2(p.ore).replace(/,00$/, '') + ' h'], ['di cui straordinario', p.ostr ? p.ostr + ' h' : 'nessuno'], ['Costo del lavoro nel periodo', E2(p.costo)], ['Costo orario effettivo (costo ÷ ore)', `<b>${E2(coEff)} / h</b>`]])}
      <h2>3. Composizione del costo (stima)</h2>${tbl(['Voce', 'Aliquota', 'Importo'], [['Retribuzione lorda (incl. ratei ferie, 13ª e 14ª)', '—', E2(lordo)], ['Contributi previdenziali INPS a carico azienda', n1(S.inps) + '%', E2(inps)], ['Premio INAIL', n1(inail) + '%', E2(ina)], ['Accantonamento TFR', S.tfr.toLocaleString('it-IT') + '%', E2(tfr)], ['<b>Costo del lavoro nel periodo</b>', '', `<b>${E2(p.costo)}</b>`]], [1, 2])}
      <h2>4. Costo orario per la rendicontazione</h2>${kv([['Costo del lavoro annuo lordo (periodo × 12/' + mesi + ')', E2(annuo)], ['Ore annue di riferimento (' + eur0(S.ore) + ' h × FTE ' + p.fte.toFixed(2).replace('.', ',') + ')', eur0(oreRif) + ' h'], ['Costo orario rendicontabile', `<b>${E2(coRend)} / h</b>`], ['Confronto: costo orario effettivo', E2(coEff) + ' / h']])}
      <p style="font-size:12px">Formula (opzione semplificata): costo orario = costo annuo lordo del lavoro ÷ ore annue di riferimento (${eur0(S.ore)} h per il tempo pieno, proporzionali al part-time). Il costo comprende retribuzione lorda, oneri contributivi e assistenziali a carico del datore e ratei.</p>
      <h2>5. Attività formativa e importo rendicontabile</h2>${p.form ? kv([['Attività formativa', esc(p.form.titolo)], ['Data di avvio', new Date(p.form.da).toLocaleDateString('it-IT')], ['Ore di formazione svolte', p.form.ore + ' h'], ['Costo orario rendicontabile', E2(coRend)], ['<b>Costo del personale in formazione</b>', `<b>${E2(imp)}</b>`]]) : '<p>Nessuna attività formativa finanziata registrata per questa persona nel periodo: nessun importo rendicontabile.</p>'}
      <h2>6. Documenti a supporto</h2><p style="font-size:12.5px">Cedolini e Libro Unico del Lavoro del periodo, contratto individuale, registro presenze della formazione firmato, attestato di frequenza. Metodo conforme all'opzione semplificata delle 1.720 ore; per i fondi interprofessionali prevale quanto previsto dall'avviso (${esc(S.avviso)}).</p>
      ${docFoot()}${sign('Matricola ' + p.mat)}</div>`;
  }

  function payStats(list) {
    const F = list.filter(p => p.g === 'F').map(p => p.co), M = list.filter(p => p.g === 'M').map(p => p.co);
    return { nF: F.length, nM: M.length, mF: mean(F), mM: mean(M), dF: median(F), dM: median(M), gMean: gapOf(mean(F), mean(M)), gMed: gapOf(median(F), median(M)) };
  }
  function deltaHtml() {
    const P = D.people, n = P.length, all = payStats(P);
    const sorted = P.slice().sort((a, b) => a.co - b.co), qs = Math.ceil(n / 4);
    const quart = [0, 1, 2, 3].map(i => { const g = sorted.slice(i * qs, (i + 1) * qs), f = g.filter(p => p.g === 'F').length; return [['Q1 — retribuzioni più basse', 'Q2', 'Q3', 'Q4 — retribuzioni più alte'][i], g.length, n1(f / g.length * 100) + '%', n1((g.length - f) / g.length * 100) + '%']; });
    const cats = D.funzioni.map(({ fn }) => { const ps = P.filter(p => p.fn === fn), s = payStats(ps), ok = s.nF >= 3 && s.nM >= 3; return { fn, s, ok, over: ok && Math.abs(s.gMean) >= 5, ps }; });
    const over = cats.filter(c => c.over);
    const cadence = n >= 250 ? 'annuale, con primo rapporto entro il 7 giugno 2027' : n >= 150 ? 'triennale, con primo rapporto entro il 7 giugno 2027' : n >= 100 ? 'triennale, con primo rapporto entro il 7 giugno 2031' : 'nessun obbligo di rapporto (sotto i 100 lavoratori); la pubblicazione è volontaria';
    const fmtc = c => c.ok ? [esc(c.fn), c.s.nF + ' / ' + c.s.nM, E2(c.s.mF), E2(c.s.mM), (Math.abs(c.s.gMean) >= 5 ? '<span class="flag">' + pc(c.s.gMean) + '</span>' : pc(c.s.gMean)), pc(c.s.gMed)] : [esc(c.fn), c.s.nF + ' / ' + c.s.nM, '—', '—', 'n.d.', 'n.d.'];
    const expl = over.map(c => { const F = c.ps.filter(p => p.g === 'F'), M = c.ps.filter(p => p.g === 'M'); return [esc(c.fn), n1(mean(F.map(p => p.anz))) + ' / ' + n1(mean(M.map(p => p.anz))), Math.round(F.filter(p => p.fte < 1).length / F.length * 100) + '% / ' + Math.round(M.filter(p => p.fte < 1).length / M.length * 100) + '%', pc(c.s.gMean) + (c.s.gMean > 0 ? ' (donne pagate meno)' : ' (uomini pagati meno)')]; });
    return `<div class="doc">${head('Relazione sul divario retributivo di genere', `Direttiva (UE) 2023/970 sulla trasparenza retributiva — periodo ${D.meta.periodo}`)}
      <h2>1. Oggetto, metodo e perimetro</h2><p>La relazione riporta il divario retributivo di genere, calcolato come differenza tra il livello retributivo medio (e mediano) degli uomini e delle donne, in percentuale di quello degli uomini: un valore positivo indica che le donne sono pagate meno. Il livello retributivo è approssimato con il <b>costo orario del lavoro</b> (costo del periodo ÷ ore retribuite). Popolazione: ${n} lavoratori (${all.nF} donne, ${all.nM} uomini).</p>
      <p>Frequenza di rendicontazione applicabile (${n} lavoratori): ${cadence}.</p>
      <h2>2. Divario complessivo</h2>${tbl(['Indicatore', 'Donne', 'Uomini', 'Divario'], [['Costo orario medio', E2(all.mF), E2(all.mM), `<b>${pc(all.gMean)}</b>`], ['Costo orario mediano', E2(all.dF), E2(all.dM), `<b>${pc(all.gMed)}</b>`]], [1, 2, 3])}
      <h2>3. Distribuzione per quartili retributivi</h2>${tbl(['Quartile', 'Persone', '% donne', '% uomini'], quart, [1, 2, 3])}
      <h2>4. Divario per categoria di lavoratori (stesso lavoro o lavoro di pari valore)</h2>${tbl(['Categoria', 'Donne / Uomini', '€/h donne', '€/h uomini', 'Divario medio', 'Divario mediano'], cats.map(fmtc), [1, 2, 3, 4, 5])}
      <p style="font-size:12px">In rosso i divari pari o superiori al 5%. Le categorie con meno di 3 persone per genere non sono valutate (n.d.) per tutela dell'anonimato e affidabilità statistica.</p>
      <h2>5. Categorie oltre la soglia del 5%</h2>${over.length ? `<p>${over.length} categoria/e con divario medio ≥ 5%. Fattori oggettivi disponibili nel database:</p>${tbl(['Categoria', 'Anzianità media D / U (anni)', 'Part-time D / U', 'Divario'], expl)}<p>Se il divario non è giustificato da criteri oggettivi e neutri rispetto al genere e non è corretto entro sei mesi dalla comunicazione, la Direttiva (art. 10) prevede una <b>valutazione congiunta delle retribuzioni</b> con le rappresentanze dei lavoratori.</p>` : '<p>Nessuna categoria valutabile supera la soglia del 5%: non è necessaria la valutazione congiunta.</p>'}
      <h2>6. Limiti e dati da integrare</h2><p style="font-size:12.5px">Non sono presenti nel database: componenti retributive complementari o variabili per genere (premi, indennità), retribuzione lorda contrattuale per livello, e criteri di progressione. Prima della trasmissione integrare questi dati e verificare il decreto di recepimento vigente.</p>
      ${docFoot()}${sign('')}</div>`;
  }

  const RESP = p => p.band === 'D' || /DIRETTORE|RESP\.|CAPO|MANAGER/.test(p.mans);
  function paritaHtml() {
    const P = D.people, n = P.length, F = P.filter(p => p.g === 'F'), M = P.filter(p => p.g === 'M'), s = payStats(P);
    const qf = F.length / n * 100, resp = P.filter(RESP), respF = resp.filter(p => p.g === 'F').length;
    const share = list => list.length ? n1(list.filter(p => p.g === 'F').length / list.length * 100) + '%' : '—';
    const byArea = [...new Set(D.strutture.map(x => x.area))].map(a => { const l = P.filter(p => p.area === a); return [a, l.length, share(l)]; });
    const byBand = D.bands.map(b => { const l = P.filter(p => p.band === b.id); return [esc(b.nome), l.length, share(l)]; });
    const fF = F.filter(p => p.form), fM = M.filter(p => p.form);
    const over = D.funzioni.map(({ fn }) => { const ps = P.filter(p => p.fn === fn), st = payStats(ps); return st.nF >= 3 && st.nM >= 3 && Math.abs(st.gMean) >= 5 ? fn : null; }).filter(Boolean);
    const area = (n_, t, w, body, ev) => `<h2>${n_}. ${t} <span style="font-weight:normal;color:#666">— peso ${w}%</span></h2>${body}<p style="font-size:12px"><b>Evidenze da allegare:</b> ${ev}</p>`;
    return `<div class="doc">${head('Dossier per la certificazione della parità di genere', `Prassi di riferimento UNI/PdR 125:2022 — dati di base, periodo ${D.meta.periodo}`)}
      <h2>Anagrafica e perimetro</h2>${kv([['Lavoratori in organico', n], ['Donne / uomini', `${F.length} / ${M.length}`], ['Quota femminile', n1(qf) + '%'], ['Strutture / funzioni / mansioni', `${D.strutture.length} / ${D.funzioni.length} / ${new Set(P.map(p => p.mans)).size}`], ['Fascia dimensionale', n >= 250 ? 'Grande impresa' : n >= 50 ? 'Media impresa' : 'Piccola impresa']])}
      ${area('1', 'Cultura e strategia', 15, '<p>Area qualitativa: non calcolabile dal database.</p>', 'politica per la parità approvata dalla direzione, obiettivi e indicatori nel piano strategico, piano di comunicazione interna ed esterna.')}
      ${area('2', 'Governance', 15, kv([['Ruoli di responsabilità (direzione, responsabili, capi)', resp.length], ['Donne nei ruoli di responsabilità', `${respF} (${n1(respF / Math.max(1, resp.length) * 100)}%)`], ['Confronto con la quota femminile totale', n1(qf) + '%']]), 'comitato guida per la parità, ruoli e responsabilità formalizzati, budget dedicato.')}
      ${area('3', 'Processi HR', 10, tbl(['Area', 'Persone', '% donne'], byArea, [1, 2]) + '<p style="font-size:12px">La distribuzione per area evidenzia la segregazione orizzontale.</p>', 'procedure di selezione e valutazione neutre rispetto al genere, criteri di progressione documentati.')}
      ${area('4', 'Opportunità di crescita e inclusione delle donne', 20, tbl(['Fascia di inquadramento', 'Persone', '% donne'], byBand, [1, 2]) + kv([['Anzianità media donne / uomini', `${n1(mean(F.map(p => p.anz)))} / ${n1(mean(M.map(p => p.anz)))} anni`], ['Persone coinvolte in formazione finanziata', `donne ${Math.round(fF.length / F.length * 100)}% · uomini ${Math.round(fM.length / M.length * 100)}%`], ['Ore medie di formazione per persona formata', `donne ${n1(mean(fF.map(p => p.form.ore)))} h · uomini ${n1(mean(fM.map(p => p.form.ore)))} h`]]), 'piani di sviluppo e formazione per genere, dati sulle promozioni per genere.')}
      ${area('5', 'Equità remunerativa per genere', 20, kv([['Divario retributivo medio (M−F)/M', pc(s.gMean)], ['Divario retributivo mediano', pc(s.gMed)], ['Categorie con divario ≥ 5%', over.length ? esc(over.join(', ')) : 'nessuna']]), 'politica retributiva e premi per genere, RAL contrattuale per livello.')}
      ${area('6', 'Tutela della genitorialità e conciliazione vita-lavoro', 20, '<p>Dati non presenti nel database (rientri dopo maternità/paternità, congedi per genere, flessibilità): da raccogliere.</p>', 'rientri post-maternità e paternità, congedi fruiti per genere, strumenti di flessibilità e welfare.')}
      <h2>Soglia di certificazione</h2><p style="font-size:12.5px">La certificazione UNI/PdR 125:2022, rilasciata da organismo accreditato, richiede almeno il 60% del punteggio complessivo e, ove ricorrano i requisiti, dà accesso allo sgravio contributivo (fino all'1%, massimo € 50.000 annui) e a premialità nei bandi pubblici. Le aree 1 e 6 e le evidenze documentali vanno integrate dall'azienda.</p>
      ${docFoot()}${sign('Referente parità: ______________')}</div>`;
  }

  const DOC_STYLE = `@page{size:A4;margin:2cm}body{font:11pt/1.5 Georgia,'Times New Roman',serif;color:#1a1a1a}h1{font:bold 18pt Arial,sans-serif;margin:.2em 0}h2{font:bold 11.5pt Arial,sans-serif;border-bottom:1px solid #999;padding-bottom:2px;margin:1.2em 0 .4em}.sub{color:#555;font-size:10pt}table{border-collapse:collapse;width:100%;margin:4px 0 8px;font-size:10pt}th,td{border:1px solid #999;padding:4px 7px;text-align:left;vertical-align:top}th{background:#eee}td.n,th.n{text-align:right}.flag{color:#b03a2e;font-weight:bold}.foot{font-size:9pt;color:#555;border-top:1px solid #999;margin-top:14px;padding-top:6px}.sig{width:100%;margin-top:30px;font-size:10pt}.sig div{display:inline-block;width:48%;vertical-align:top}.sig div:last-child{border-top:1px solid #333;text-align:center;padding-top:3px}.doc{page-break-after:always}.doc:last-child{page-break-after:auto}`;
  const wrapDoc = (name, inner) => `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(name)}</title><style>${DOC_STYLE}</style></head><body>${inner}</body></html>`;
  function downloadDoc(name, inner) {
    const blob = new Blob(['﻿', wrapDoc(name, inner)], { type: 'application/msword' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.doc'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function printDoc(name, inner) {
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    f.srcdoc = wrapDoc(name, inner); document.body.appendChild(f);
    f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); };
  }
  const slug = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  function scopeList() { const sc = ST.doc.scope; return sc === 'all' ? D.people : D.people.filter(p => p.area === sc.slice(2)); }
  function currentDoc() {
    const d = ST.doc;
    if (d.key === 'scheda') { const p = D.people.find(x => x.id === +d.pid) || D.people[0]; return { name: 'Scheda_formazione_' + slug(p.nome), html: schedaHtml(p) }; }
    if (d.key === 'delta') return { name: 'Relazione_divario_retributivo_' + new Date().toISOString().slice(0, 10), html: deltaHtml() };
    return { name: 'Dossier_parita_di_genere_' + new Date().toISOString().slice(0, 10), html: paritaHtml() };
  }
  const DOCS = [['Individuali', [['scheda', 'Scheda formazione finanziata']]], ['Aziendali', [['delta', 'Divario retributivo (Dir. 2023/970)'], ['parita', 'Parità di genere (UNI/PdR 125)']]], ['Impostazioni', [['dati', 'Dati azienda e fondo']]]];
  const SETF = [['ragione', 'Ragione sociale', 'text'], ['piva', 'Partita IVA', 'text'], ['sede', 'Sede legale', 'text'], ['firma', 'Firmatario', 'text'], ['fondo', 'Fondo / programma di finanziamento', 'text'], ['avviso', 'Avviso', 'text'], ['ccnl', 'CCNL applicato', 'text'], ['ore', 'Ore annue di riferimento (FSE)', 'number'], ['inps', 'INPS a carico azienda (%)', 'number'], ['inailU', 'INAIL uffici (%)', 'number'], ['inailP', 'INAIL produzione e logistica (%)', 'number'], ['tfr', 'TFR (%)', 'number']];
  function viewDocumenti() {
    const d = ST.doc, side = DOCS.map(([g, items]) => `<h4>${ICON.folder} ${g}</h4><ul>${items.map(([k, l]) => `<li><button class="${d.key === k ? 'on' : ''}" data-d="${k}"><span>${l}</span></button></li>`).join('')}</ul>`).join('');
    let main;
    if (d.key === 'dati') {
      main = `<div class="page"><div class="note">Questi dati compaiono nell'intestazione e nei calcoli di tutti i documenti. Sono fittizi: sostituiscili con quelli reali. Le aliquote servono a scomporre il costo del lavoro nella scheda.</div><div class="card"><h2>Dati azienda e fondo</h2><div class="b form" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${SETF.map(([k, l, t]) => `<div><label>${l}</label><input type="${t}" ${t === 'number' ? 'step="any"' : ''} data-set="${k}" value="${esc(ST.set[k])}"></div>`).join('')}</div></div></div>`;
    } else {
      const cd = currentDoc(), aree = [...new Set(D.strutture.map(x => x.area))];
      const ctrl = d.key === 'scheda' ? `<div class="docbar"><div class="f"><label>Persona</label><select id="dP">${D.people.map(p => `<option value="${p.id}" ${+d.pid === p.id ? 'selected' : ''}>${esc(p.nome)} · ${esc(p.fn)}${p.form ? '' : ' (senza formazione)'}</option>`).join('')}</select></div>
        <div class="f"><label>Fascicolo per</label><select id="dS"><option value="all" ${d.scope === 'all' ? 'selected' : ''}>Tutte le persone</option>${aree.map(a => `<option value="a:${a}" ${d.scope === 'a:' + a ? 'selected' : ''}>Area ${a}</option>`).join('')}</select></div>
        <button class="btn sec" id="dBulk">Genera fascicolo (${scopeList().length} schede)</button></div>` : '';
      main = `<div class="page">${ctrl}<div class="paper">${cd.html}</div></div>`;
    }
    const title = { scheda: 'Scheda formazione finanziata', delta: 'Relazione sul divario retributivo', parita: 'Dossier parità di genere', dati: 'Dati azienda e fondo' }[d.key];
    return `<div class="cp"><h1>${title}</h1><span class="grow"></span>${d.key !== 'dati' ? '<button class="btn sec" id="dPrint">Stampa / PDF</button><button class="btn" id="dWord">Scarica Word</button>' : ''}</div><div class="wrap"><aside class="side">${side}</aside><div class="content">${main}</div></div>`;
  }
  function bindDocumenti() {
    const app = $('#app');
    app.querySelectorAll('.side [data-d]').forEach(b => b.onclick = () => { ST.doc.key = b.dataset.d; render(); });
    app.querySelectorAll('[data-set]').forEach(i => i.onchange = () => { const k = i.dataset.set; ST.set[k] = i.type === 'number' ? (parseFloat(i.value) || 0) : i.value; store.set('sdu_settings_v1', ST.set); toast('Impostazioni salvate'); });
    if ($('#dP')) $('#dP').onchange = e => { ST.doc.pid = +e.target.value; render(); };
    if ($('#dS')) $('#dS').onchange = e => { ST.doc.scope = e.target.value; render(); };
    if ($('#dWord')) $('#dWord').onclick = () => { const c = currentDoc(); downloadDoc(c.name, c.html); };
    if ($('#dPrint')) $('#dPrint').onclick = () => { const c = currentDoc(); printDoc(c.name, c.html); };
    if ($('#dBulk')) $('#dBulk').onclick = () => { const l = scopeList(); downloadDoc('Fascicolo_schede_formazione_' + (ST.doc.scope === 'all' ? 'tutte' : slug(ST.doc.scope.slice(2))), l.map(schedaHtml).join('')); toast(l.length + ' schede generate'); };
  }

  /* ---------- render ---------- */
  function render() {
    drawMenu();
    const V = { quadro: viewQuadro, segnali: viewSegnali, valutazione: viewValutazione, funzioni: () => viewDrill('funzioni'), equita: () => viewDrill('equita'), documenti: viewDocumenti, registro: viewRegistro }[ST.view];
    $('#app').innerHTML = V();
    if (ST.view === 'segnali') bindSegnali();
    if (ST.view === 'valutazione') bindValutazione();
    if (ST.view === 'funzioni' || ST.view === 'equita') bindDrill(ST.view);
    if (ST.view === 'registro') bindRegistro();
    if (ST.view === 'documenti') bindDocumenti();
    document.title = (VIEWS.find(v => v[0] === ST.view)[1]) + " · Segnali d'uscita · G1G10";
  }
  const h = location.hash.slice(1); if (VIEWS.some(v => v[0] === h)) ST.view = h;
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.some(x => x[0] === v) && v !== ST.view) { ST.view = v; render(); } });
  setTheme(document.documentElement.dataset.theme);
  render();
})();
