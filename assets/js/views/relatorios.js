/* ==========================================================================
   KombiTech — View: Relatórios
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, icon, esc } = K;
  let rootEl = null;

  function barChart(days) {
    const W = 620, H = 230, pad = { l: 34, r: 10, t: 14, b: 34 };
    const max = Math.max.apply(null, days.map((d) => d.students).concat([8]));
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const slot = innerW / days.length;
    const bw = Math.min(38, slot * 0.5);
    const y = (v) => pad.t + innerH - (v / max) * innerH;
    const grid = [];
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((max / 4) * i);
      const yy = y(val);
      grid.push(`<line class="gridline" x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}"/>`);
      grid.push(`<text class="axis-text" x="${pad.l - 9}" y="${yy + 3}" text-anchor="end">${val}</text>`);
    }
    const bars = days.map((d, i) => {
      const x = pad.l + slot * i + (slot - bw) / 2;
      const h = Math.max(2, (d.students / max) * innerH);
      const isToday = i === days.length - 1;
      return `
        <g>
          <rect x="${x}" y="${pad.t}" width="${bw}" height="${innerH}" rx="7" fill="#F3F7FC"/>
          <rect x="${x}" y="${pad.t + innerH - h}" width="${bw}" height="${h}" rx="7" fill="${isToday ? 'url(#barGrad)' : '#BBD4FA'}"/>
          ${d.students ? `<text class="axis-text" x="${x + bw / 2}" y="${pad.t + innerH - h - 7}" text-anchor="middle" style="fill:#0C1A2B;font-weight:800">${d.students}</text>` : ''}
          <text class="axis-text" x="${x + bw / 2}" y="${H - 12}" text-anchor="middle" style="fill:${isToday ? '#1265E8' : '#93A0B3'}">${esc(d.label)}</text>
        </g>`;
    }).join('');
    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Alunos transportados por dia">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3E8BFF"/><stop offset="1" stop-color="#1265E8"/>
          </linearGradient>
        </defs>
        ${grid.join('')}
        ${bars}
      </svg>`;
  }

  function donutChart(counts) {
    const entries = [
      { key: 'picked', label: 'Já buscados', color: '#159B5B', value: counts.picked },
      { key: 'next', label: 'Próximo destino', color: '#1265E8', value: counts.next },
      { key: 'waiting', label: 'Aguardando', color: '#C3CDDB', value: counts.waiting },
      { key: 'issue', label: 'Com problema', color: '#E5484D', value: counts.issue }
    ];
    const total = entries.reduce((a, b) => a + b.value, 0);
    const r = 54;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const segments = entries.map((e) => {
      const len = total ? (e.value / total) * c : 0;
      const seg = e.value > 0
        ? `<circle cx="66" cy="66" r="${r}" fill="none" stroke="${e.color}" stroke-width="14" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-offset}" stroke-linecap="butt"/>`
        : '';
      offset += len;
      return seg;
    }).join('');
    return `
      <div class="donut-wrap">
        <div class="donut">
          <svg viewBox="0 0 132 132" width="132" height="132" role="img" aria-label="Distribuição de status dos alunos">
            <circle cx="66" cy="66" r="${r}" fill="none" stroke="#EFF3F9" stroke-width="14"/>
            <g transform="rotate(-90 66 66)">${segments}</g>
          </svg>
          <div class="donut-center"><b>${total}</b><span>alunos</span></div>
        </div>
        <div class="donut-legend">
          ${entries.map((e) => `
            <div class="item"><span class="sw" style="background:${e.color}"></span>${e.label}<span class="val">${e.value}</span></div>`).join('')}
        </div>
      </div>`;
  }

  function lineChart(history) {
    const data = history.slice(0, 7).reverse();
    const W = 620, H = 200, pad = { l: 34, r: 12, t: 16, b: 30 };
    if (!data.length) return `<div class="empty" style="padding:26px"><p class="small muted">Sem rotas registradas ainda.</p></div>`;
    const values = data.map((h) => h.durationMin || 0);
    const max = Math.max.apply(null, values.concat([60]));
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const x = (i) => pad.l + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v) => pad.t + innerH - (v / max) * innerH;
    const pts = data.map((d, i) => ({ x: x(i), y: y(d.durationMin || 0), d }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${pad.t + innerH} L${pts[0].x.toFixed(1)} ${pad.t + innerH} Z`;
    const grid = [];
    for (let i = 0; i <= 3; i++) {
      const val = Math.round((max / 3) * i);
      const yy = y(val);
      grid.push(`<line class="gridline" x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}"/>`);
      grid.push(`<text class="axis-text" x="${pad.l - 9}" y="${yy + 3}" text-anchor="end">${val}m</text>`);
    }
    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Duração das rotas">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1265E8" stop-opacity=".22"/><stop offset="1" stop-color="#1265E8" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid.join('')}
        <path class="area-path" d="${area}"/>
        <path class="line-path" d="${line}"/>
        ${pts.map((p) => `
          <circle class="dot" cx="${p.x}" cy="${p.y}" r="3.6"/>
          <text class="axis-text" x="${p.x}" y="${H - 10}" text-anchor="middle">${esc(K.fmt.dateShort(p.d.startedAt))}</text>`).join('')}
      </svg>`;
  }

  function historyRows(history) {
    if (!history.length) {
      return `<div class="empty"><div class="empty-ico">${icon('file')}</div><h4>Sem histórico ainda</h4><p>Finalize uma rota para gerar o primeiro registro.</p></div>`;
    }
    return history.slice(0, 10).map((h) => `
      <tr>
        <td>
          <div class="small strong" style="font-weight:700">${K.fmt.date(h.startedAt)}</div>
          <div class="tiny muted">${esc(K.fmt.weekday(h.startedAt))}${h.simulated ? ' · simulado' : ''}</div>
        </td>
        <td><span class="small">${esc(h.routeName)}</span></td>
        <td><span class="small">${K.fmt.time(h.startedAt)} — ${K.fmt.time(h.finishedAt)}</span></td>
        <td><span class="small">${K.fmt.duration(h.durationMin)}</span></td>
        <td><span class="badge b-green">${h.picked}/${h.total}</span></td>
        <td><span class="small">${K.fmt.km(h.distanceKm, 1)}</span></td>
        <td>${h.issues ? `<span class="badge b-red">${h.issues}</span>` : '<span class="tiny muted">—</span>'}</td>
        <td class="td-actions"><button class="icon-btn bordered" data-history="${h.id}" aria-label="Detalhes">${icon('external')}</button></td>
      </tr>`).join('');
  }

  function historyModal(entry) {
    K.modal({
      title: 'Detalhes do trajeto',
      subtitle: `${entry.routeName} · ${K.fmt.date(entry.startedAt)}`,
      icon: 'file',
      size: 'md',
      body: `
        <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);gap:10px">
          <div class="kpi"><div class="kpi-label">Início</div><div class="kpi-value" style="font-size:20px">${K.fmt.time(entry.startedAt)}</div></div>
          <div class="kpi"><div class="kpi-label">Término</div><div class="kpi-value" style="font-size:20px">${K.fmt.time(entry.finishedAt)}</div></div>
          <div class="kpi"><div class="kpi-label">Duração</div><div class="kpi-value" style="font-size:20px">${K.fmt.duration(entry.durationMin)}</div></div>
          <div class="kpi"><div class="kpi-label">Distância</div><div class="kpi-value" style="font-size:20px">${K.fmt.km(entry.distanceKm, 1)}</div></div>
        </div>
        <div class="notice ${entry.issues ? 'warn' : 'neutral'}" style="margin-top:14px">
          ${icon(entry.issues ? 'alert' : 'checkCircle')}
          <div><b>${entry.picked} de ${entry.total} alunos transportados.</b> ${entry.issues ? entry.issues + ' ocorrência(s) registrada(s).' : 'Nenhuma ocorrência registrada.'}
          ${entry.simulated ? ' Trajeto gerado em modo de demonstração.' : ''}</div>
        </div>
        <div class="mt-3">
          <div class="tiny strong" style="text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">Alunos embarcados</div>
          ${entry.stops && entry.stops.length
            ? entry.stops.map((s) => `
              <div class="list-row">
                <div class="avatar sm g">${esc(K.fmt.initials(s.name))}</div>
                <div class="grow"><div class="list-title">${esc(s.name)}</div><div class="list-sub">${s.pickedAt ? K.fmt.time(s.pickedAt) : '—'}${s.manual ? ' · confirmação manual' : ' · automático'}</div></div>
                <span class="badge b-green">${icon('check')}Pego</span>
              </div>`).join('')
            : '<p class="small muted">Nenhum aluno registrado neste trajeto.</p>'}
        </div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Fechar</button>`
    });
  }

  function render() {
    if (!rootEl) return;
    const sum = K.store.reportSummary();
    const el = $('#reportBody');
    if (!el) return;
    const totalDone = sum.history.reduce((a, h) => a + h.picked, 0);
    const rate = sum.statusCounts.picked + sum.statusCounts.issue > 0
      ? Math.round((sum.statusCounts.picked / (sum.statusCounts.picked + sum.statusCounts.issue)) * 100)
      : 0;

    el.innerHTML = `
      <div class="kpi-grid stagger">
        <div class="kpi">
          <div class="kpi-label">Alunos transportados</div>
          <div class="kpi-value">${sum.monthStudents}<small>no mês</small></div>
          <div class="kpi-foot">${icon('users')}${totalDone} no histórico completo</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Rotas concluídas</div>
          <div class="kpi-value">${sum.completed}<small>${sum.pending ? '· ' + sum.pending + ' pendente' : 'no mês'}</small></div>
          <div class="kpi-foot">${icon('checkCircle')}${sum.pending ? 'Existe uma rota em aberto hoje' : 'Todas as rotas do dia concluídas'}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Tempo médio por rota</div>
          <div class="kpi-value">${K.fmt.duration(sum.avgDuration)}</div>
          <div class="kpi-foot">${icon('clock')}Baseado nas rotas do mês</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Distância total</div>
          <div class="kpi-value">${sum.monthKm.toFixed(1).replace('.', ',')}<small>km</small></div>
          <div class="kpi-foot">${icon('mapPin')}${sum.monthIssues} ocorrência(s) no mês</div>
        </div>
      </div>

      <div class="chart-grid mt-3">
        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">${icon('chart')}Alunos transportados</div>
              <div class="panel-sub">Últimos 7 dias · dados de rotas concluídas</div>
            </div>
            <span class="badge b-blue">Semanal</span>
          </div>
          <div class="panel-body">${barChart(sum.days)}</div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">${icon('users')}Status dos alunos</div>
              <div class="panel-sub">Situação atual da rota ativa</div>
            </div>
          </div>
          <div class="panel-body">${donutChart(sum.statusCounts)}</div>
        </section>
      </div>

      <div class="chart-grid mt-3">
        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">${icon('clock')}Duração das últimas rotas</div>
              <div class="panel-sub">Minutos por trajeto concluído</div>
            </div>
          </div>
          <div class="panel-body">${lineChart(sum.history)}</div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">${icon('shield')}Resumo operacional</div>
              <div class="panel-sub">Indicadores de segurança e conclusão</div>
            </div>
          </div>
          <div class="panel-body">
            <div class="list-row">
              <div class="stat-ico green" style="width:34px;height:34px;border-radius:10px">${icon('userCheck')}</div>
              <div class="grow"><div class="list-title">Taxa de embarque confirmado</div><div class="list-sub">Alunos confirmados sobre o total do dia</div></div>
              <b style="font-size:16px">${rate}%</b>
            </div>
            <div class="list-row">
              <div class="stat-ico amber" style="width:34px;height:34px;border-radius:10px">${icon('clock')}</div>
              <div class="grow"><div class="list-title">Alunos aguardando</div><div class="list-sub">Ainda não confirmados na rota ativa</div></div>
              <b style="font-size:16px">${sum.statusCounts.waiting + sum.statusCounts.next}</b>
            </div>
            <div class="list-row">
              <div class="stat-ico red" style="width:34px;height:34px;border-radius:10px">${icon('alert')}</div>
              <div class="grow"><div class="list-title">Ocorrências no mês</div><div class="list-sub">Problemas de localização ou coleta</div></div>
              <b style="font-size:16px">${sum.monthIssues}</b>
            </div>
            <div class="list-row">
              <div class="stat-ico navy" style="width:34px;height:34px;border-radius:10px">${icon('route')}</div>
              <div class="grow"><div class="list-title">Rotas pendentes</div><div class="list-sub">Trajetos que ainda não foram finalizados hoje</div></div>
              <b style="font-size:16px">${sum.pending}</b>
            </div>
            <div class="notice neutral" style="margin-top:10px;font-size:11.5px">
              ${icon('info')}<div>Relatórios consideram apenas rotas finalizadas. Trajetos em modo de demonstração são identificados no histórico.</div>
            </div>
          </div>
        </section>
      </div>

      <section class="panel mt-3">
        <div class="panel-head">
          <div>
            <div class="panel-title">${icon('file')}Histórico de trajetos</div>
            <div class="panel-sub">Registro das rotas concluídas, com horários e ocorrências</div>
          </div>
          <div class="row" style="gap:7px">
            <button class="btn btn-ghost btn-sm" data-export-csv>${icon('download')}CSV</button>
            <button class="btn btn-ghost btn-sm" data-export-json>${icon('file')}JSON</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="tbl-wrap table-desktop">
            <table class="tbl">
              <thead><tr><th>Data</th><th>Rota</th><th>Horário</th><th>Duração</th><th>Alunos</th><th>Distância</th><th>Ocorr.</th><th></th></tr></thead>
              <tbody>${historyRows(sum.history)}</tbody>
            </table>
          </div>
          <div class="table-mobile" style="display:none">
            ${sum.history.slice(0, 10).map((h) => `
              <div class="card" style="padding:13px;margin-bottom:10px">
                <div class="row-between">
                  <div><div class="strong" style="font-size:13px">${esc(h.routeName)}</div><div class="tiny muted">${K.fmt.date(h.startedAt)} · ${K.fmt.weekday(h.startedAt)}</div></div>
                  <span class="badge b-green">${h.picked}/${h.total}</span>
                </div>
                <div class="row-between tiny muted" style="margin-top:8px">
                  <span>${K.fmt.time(h.startedAt)} — ${K.fmt.time(h.finishedAt)}</span>
                  <span>${K.fmt.duration(h.durationMin)} · ${K.fmt.km(h.distanceKm, 1)}</span>
                </div>
                <button class="btn btn-ghost btn-xs btn-block" style="margin-top:9px" data-history="${h.id}">${icon('external')}Ver detalhes</button>
              </div>`).join('') || '<p class="small muted">Sem histórico.</p>'}
          </div>
        </div>
      </section>`;
  }

  function exportCsv() {
    const rows = K.store.history().map((h) => [
      K.fmt.date(h.startedAt), h.routeName, K.fmt.time(h.startedAt), K.fmt.time(h.finishedAt),
      h.durationMin, h.total, h.picked, h.issues, h.distanceKm, h.simulated ? 'Demonstração' : 'GPS real'
    ]);
    const csv = K.util.toCSV(rows, ['Data', 'Rota', 'Início', 'Término', 'Duração (min)', 'Total alunos', 'Buscados', 'Ocorrências', 'Distância (km)', 'Modo']);
    K.util.download(`kombitech-relatorio-${K.store.isoDay(new Date())}.csv`, csv, 'text/csv;charset=utf-8');
    K.toast('Relatório exportado', 'Arquivo CSV gerado com o histórico de rotas.', 'success');
  }

  function exportJson() {
    K.util.download(`kombitech-dados-${K.store.isoDay(new Date())}.json`, K.store.exportData(), 'application/json');
    K.toast('Dados exportados', 'Backup completo em JSON (LGPD · portabilidade).', 'success');
  }

  function mount(container) {
    rootEl = container;
    container.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="page-title">Relatórios</h1>
          <p class="page-sub">Acompanhe alunos transportados, horários, distâncias e ocorrências. Os dados são gerados a partir das rotas finalizadas.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost" data-print>${icon('printer')}Imprimir</button>
          <button class="btn btn-primary" data-export-csv>${icon('download')}Exportar relatório</button>
        </div>
      </div>
      <div id="reportBody"></div>`;

    render();
    rootEl.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-export-csv]')) { exportCsv(); return; }
      if (ev.target.closest('[data-export-json]')) { exportJson(); return; }
      if (ev.target.closest('[data-print]')) { window.print(); return; }
      const btn = ev.target.closest('[data-history]');
      if (btn) {
        const entry = K.store.history().find((h) => h.id === btn.getAttribute('data-history'));
        if (entry) historyModal(entry);
      }
    });
  }

  K.views = K.views || {};
  K.views.relatorios = {
    mount,
    unmount() { rootEl = null; },
    onRoute(type) { if (type !== 'move') render(); }
  };
})(window.KT);
