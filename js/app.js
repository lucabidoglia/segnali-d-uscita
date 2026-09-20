(function () {
  'use strict';
  const VERSION = '1.1.0';
  const D = window.SDU_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur0 = n => Math.round(n).toLocaleString('it-IT');
  const eur2 = n => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    ev: { ident: '', pid: '', ral: 30000, interv: 2500, f: { sat: 3, load: 3, promo: 0, extra: 0, recog: 0, comp: 0, behav: 0, market: 0, mobil: 0, perf: 1, crit: 1 } }
  };
  const saveP = () => store.set('sdu_pstate_v1', ST.pstate);
  const saveC = () => store.set('sdu_cases_v1', ST.cases);
  const statoOf = p => ST.pstate[p.id] || 'new';
  function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2400); }

  /* ---------- shell ---------- */
  const VIEWS = [['quadro', 'Quadro'], ['segnali', 'Segnali'], ['valutazione', 'Valutazione'], ['funzioni', 'Funzioni & rischio'], ['equita', 'Equità'], ['registro', 'Registro']];
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
    const th = (k, l, n) => `<th class="${n ? 'n' : ''}" data-s="${k}">${l}${ST.sortK === k ? (ST.sortD > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    const allOn = vis.length && vis.every(p => ST.sel.has(p.id));
    const body = vis.map(p => {
      const s = statoOf(p);
      return `<tr class="${ST.sel.has(p.id) ? 'sel' : ''}" data-id="${p.id}">
        <td><input type="checkbox" data-c="${p.id}" ${ST.sel.has(p.id) ? 'checked' : ''} aria-label="Seleziona ${esc(p.nome)}"></td>
        <td><b>[${p.mat}]</b> ${esc(p.nome)}</td><td>${esc(p.st)}</td><td class="mut">${esc(p.fn)}</td>
        <td class="n">${p.anz.toLocaleString('it-IT')} a</td>
        <td class="n"><span class="score s-${p.level}">${p.score}</span></td>
        <td class="drv" title="${esc(p.drivers.slice(0, 3).map(d => d.lab).join(', '))}">${esc(p.drivers.slice(0, 2).map(d => d.lab).join(' · '))}</td>
        <td class="pri pri-${p.priority}">${p.priority}</td><td class="n">€ ${eur0(p.atRisk)}</td>
        <td>${s === 'auto' ? '<span class="tag auto">Monitorato</span>' : s === 'snooze' ? '<span class="tag">Rinviato</span>' : ''}</td>
        <td class="act">
          <button data-a="case" data-id="${p.id}">${ICON.door} Apri caso</button>
          <button data-a="auto" data-id="${p.id}">${ICON.auto} ${s === 'auto' ? 'Ferma' : 'Monitora'}</button>
          <button data-a="snooze" data-id="${p.id}">${ICON.snooze} ${s === 'snooze' ? 'Riattiva' : 'Rinvia'}</button></td></tr>`;
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
            <button data-a="csv">Esporta CSV</button><button data-a="autoSel">Monitora selezionati</button><button data-a="unsnz">Riattiva selezionati</button></div></div>` : ''}
        <span class="grow"></span>
        <input class="search" id="q" placeholder="Cerca persona, matricola, funzione…" value="${esc(ST.q)}" aria-label="Cerca">
        <span class="pager">${from}-${to} / ${rows.length}<button id="pp" aria-label="Precedente">‹</button><button id="pn" aria-label="Successiva">›</button></span>
      </div>
      <div class="wrap"><aside class="side" id="side">${side}</aside>
      <div class="content">${rows.length ? `<table><thead><tr><th><input type="checkbox" id="all" ${allOn ? 'checked' : ''} aria-label="Seleziona tutto"></th>
        ${th('nome', 'Persona')}${th('st', 'Struttura')}${th('fn', 'Funzione')}${th('anz', 'Anzianità', 1)}${th('score', 'Rischio', 1)}<th>Driver principali</th>${th('priority', 'Priorità')}${th('atRisk', 'A rischio', 1)}<th>Stato</th><th></th></tr></thead>
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
    if (a === 'snooze') { statoOf(p) === 'snooze' ? delete ST.pstate[id] : ST.pstate[id] = 'snooze'; saveP(); }
    render();
  }
  function bulk(a) {
    const ps = D.people.filter(p => ST.sel.has(p.id));
    if (a === 'case') { ps.forEach(openCase); toast(ps.length + ' casi aperti'); }
    if (a === 'snooze') { ps.forEach(p => ST.pstate[p.id] = 'snooze'); saveP(); toast(ps.length + ' rinviati'); }
    if (a === 'autoSel') { ps.forEach(p => ST.pstate[p.id] = 'auto'); saveP(); toast(ps.length + ' in monitoraggio'); }
    if (a === 'unsnz') { ps.forEach(p => delete ST.pstate[p.id]); saveP(); toast(ps.length + ' riattivati'); }
    if (a === 'csv') csv(['Matricola', 'Persona', 'Struttura', 'Funzione', 'Anzianità (anni)', 'Rischio', 'Livello', 'Priorità', 'Costo a rischio (€)'],
      ps.map(p => [p.mat, p.nome, p.st, p.fn, p.anz, p.score, p.level, p.priority, Math.round(p.atRisk)]), 'segnali');
    if (a !== 'csv') ST.sel.clear();
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
        gap: coF && coM ? (coF - coM) / coM * 100 : null, score: avg(ps, p => p.score), hi: ps.filter(p => p.level === 'Alto').length, atRisk: ps.reduce((s, p) => s + p.atRisk, 0) };
    });
  }
  function viewQuadro() {
    const P = D.people, n = P.length, hi = P.filter(p => p.level === 'Alto'), F = P.filter(p => p.g === 'F');
    const fs = funcStats(), gaps = fs.filter(f => f.gap !== null);
    const adj = gaps.length ? gaps.reduce((s, f) => s + f.gap * f.n, 0) / gaps.reduce((s, f) => s + f.n, 0) : 0;
    const raw = (avg(F, p => p.co) - avg(P.filter(p => p.g === 'M'), p => p.co)) / avg(P.filter(p => p.g === 'M'), p => p.co) * 100;
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

  /* ---------- Funzioni & rischio ---------- */
  function viewFunzioni() {
    const fs = funcStats().sort((a, b) => b.score - a.score);
    return `<div class="cp"><h1>Funzioni &amp; rischio</h1></div><div class="page"><div class="card"><table><thead><tr><th>Funzione</th><th>Banda</th><th class="n">Persone</th><th class="n">Rischio medio</th><th class="n">Rischio alto</th><th class="n">€/h coorte</th><th class="n">€/h mercato</th><th class="n">Scostamento</th><th class="n">Costo a rischio</th></tr></thead><tbody>
      ${fs.map(f => { const d = (f.co - f.mk) / f.mk * 100; const lv = f.score >= 70 ? 'Alto' : f.score >= 40 ? 'Medio' : 'Basso'; return `<tr><td><b>${f.fn}</b></td><td>${f.band} · ${esc(bandBy[f.band].nome)}</td><td class="n">${f.n}</td><td class="n"><span class="score s-${lv}">${Math.round(f.score)}</span></td><td class="n">${f.hi}</td><td class="n">${eur2(f.co)}</td><td class="n">${eur2(f.mk)}</td><td class="n" style="color:var(--${d < -7 ? 'hi' : d > 7 ? 'lo' : 'mut'})">${d > 0 ? '+' : ''}${d.toFixed(1)}%</td><td class="n">€ ${eur0(f.atRisk)}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  }

  /* ---------- Equità ---------- */
  function viewEquita() {
    const fs = funcStats(), flagged = fs.filter(f => f.gap !== null && Math.abs(f.gap) >= 5).length;
    return `<div class="cp"><h1>Equità retributiva</h1></div><div class="page">
      <div class="note">Divario del costo orario medio donne/uomini a parità di funzione. Soglia di attenzione <b>5%</b> (Direttiva UE 2023/970). Sotto 3 persone per genere il dato non viene pubblicato. Funzioni sopra soglia: <b>${flagged}</b>.</div>
      <div class="card"><table><thead><tr><th>Funzione</th><th class="n">Donne</th><th class="n">Uomini</th><th class="n">€/h donne</th><th class="n">€/h uomini</th><th class="n">Divario</th><th>Esito</th></tr></thead><tbody>
      ${fs.map(f => { const has = f.gap !== null, over = has && Math.abs(f.gap) >= 5; return `<tr><td><b>${f.fn}</b></td><td class="n">${f.nF}</td><td class="n">${f.nM}</td><td class="n">${f.coF ? eur2(f.coF) : '—'}</td><td class="n">${f.coM ? eur2(f.coM) : '—'}</td><td class="n" style="color:var(--${over ? 'hi' : 'mut'})">${has ? (f.gap > 0 ? '+' : '') + f.gap.toFixed(1) + '%' : 'n.d.'}</td><td>${!has ? '<span class="tag">Campione ridotto</span>' : over ? '<span class="tag" style="border-color:var(--hi);color:var(--hi)">Da verificare</span>' : '<span class="tag" style="border-color:var(--lo);color:var(--lo)">In soglia</span>'}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
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

  /* ---------- render ---------- */
  function render() {
    drawMenu();
    const V = { quadro: viewQuadro, segnali: viewSegnali, valutazione: viewValutazione, funzioni: viewFunzioni, equita: viewEquita, registro: viewRegistro }[ST.view];
    $('#app').innerHTML = V();
    if (ST.view === 'segnali') bindSegnali();
    if (ST.view === 'valutazione') bindValutazione();
    if (ST.view === 'registro') bindRegistro();
    document.title = (VIEWS.find(v => v[0] === ST.view)[1]) + " · Segnali d'uscita · G1G10";
  }
  const h = location.hash.slice(1); if (VIEWS.some(v => v[0] === h)) ST.view = h;
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.some(x => x[0] === v) && v !== ST.view) { ST.view = v; render(); } });
  setTheme(document.documentElement.dataset.theme);
  render();
})();
