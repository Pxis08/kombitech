/* ==========================================================================
   KombiTech — View: Início (dashboard)
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, $$, icon, esc } = K;

  let rootEl = null;
  let mapView = null;
  let stopScroll = 0;
  let mapFitKey = '';

  function routeStatusInfo(st) {
    if (st.active && !st.paused) return { label: 'Em andamento', cls: 'b-blue', dot: 'blue' };
    if (st.active && st.paused) return { label: 'Pausada', cls: 'b-amber', dot: 'amber' };
    if (st.route && st.route.status === 'done') return { label: 'Concluída', cls: 'b-green', dot: 'green' };
    return { label: 'Não iniciada', cls: 'b-gray', dot: 'gray' };
  }

  function statCard(cfg) {
    return `
      <article class="stat">
        <div class="stat-top">
          <span class="stat-ico ${cfg.tone || ''}">${icon(cfg.icon)}</span>
          ${cfg.flag ? `<span class="badge ${cfg.flagCls || 'b-gray'}">${cfg.flag}</span>` : ''}
        </div>
        <div class="stat-label">${esc(cfg.label)}</div>
        <div class="stat-value ${cfg.small ? 'sm' : ''}">${cfg.value}</div>
        <div class="stat-meta">${cfg.meta || ''}</div>
      </article>`;
  }

  function afternoonBadge(status) {
    if (status === 'picked') return `<span class="badge b-green">${icon('van')}Embarcado</span>`;
    if (status === 'delivered') return `<span class="badge b-green">${icon('checkCircle')}Entregue</span>`;
    if (status === 'no_delivery') return `<span class="badge b-red">${icon('alert')}Não entregue</span>`;
    if (status === 'issue') return `<span class="badge b-red">${icon('alert')}Não embarcou</span>`;
    return `<span class="badge b-gray">${icon('clock')}Aguardando embarque</span>`;
  }

  function stopsHtml(st) {
    const route = st.route;
    if (!route) return `<div class="empty"><div class="empty-ico">${icon('route')}</div><h4>Nenhuma rota ativa</h4><p>Ative uma rota para ver a sequência de alunos.</p></div>`;
    const list = K.store.routeStudents(route);
    if (!list.length) {
      return `<div class="empty"><div class="empty-ico">${icon('users')}</div><h4>Nenhum aluno na rota</h4><p>Cadastre alunos e adicione-os a esta rota.</p><a class="btn btn-soft btn-sm" href="#/alunos">${icon('plus')}Cadastrar aluno</a></div>`;
    }
    const afternoon = route.shift === 'afternoon';
    return list.map((s, i) => {
      const isNext = s.status === 'next';
      const done = afternoon
        ? (s.status === 'delivered' || s.status === 'no_delivery' || s.status === 'issue')
        : s.status === 'picked';
      const cls = done ? 'done' : isNext ? 'active' : s.status === 'issue' ? 'issue' : '';
      const when = afternoon
        ? (s.status === 'delivered' && s.deliveredAt
            ? `Entregue às ${K.fmt.time(s.deliveredAt)}`
            : s.status === 'picked' && s.boardedAt
              ? `Embarcou às ${K.fmt.time(s.boardedAt)}`
              : s.status === 'no_delivery' && s.noDeliveryAt
                ? `Ocorrência às ${K.fmt.time(s.noDeliveryAt)}`
                : '')
        : '';
      let actions = '';
      if (afternoon && st.active) {
        if (s.status === 'waiting' || s.status === 'next') {
          actions = `<button class="btn btn-soft btn-xs quick" data-board="${s.id}">${icon('userCheck')}Embarcar</button>`;
        } else if (s.status === 'picked') {
          actions = `<button class="btn btn-success btn-xs quick" data-dropoff="${s.id}">${icon('check')}Entregar</button>
            <button class="btn btn-ghost btn-xs" data-nodelivery="${s.id}">${icon('alert')}Não entregue</button>`;
        }
      } else if (!afternoon && isNext) {
        actions = `<button class="btn btn-soft btn-xs quick" data-confirm="${s.id}">${icon('check')}Confirmar</button>`;
      }
      return `
        <div class="stop ${cls}" data-student="${s.id}" role="button" tabindex="0" aria-label="${esc(s.name)}">
          <div class="stop-idx">${done ? icon('check') : i + 1}</div>
          <div class="stop-main">
            <div class="stop-name">${esc(s.name)}</div>
            <div class="stop-addr">${esc(s.address)}, ${esc(s.number)} · ${esc(s.district)}</div>
            ${when ? `<div class="stop-addr" style="color:var(--green);font-weight:700">${icon('clock')} ${when}</div>` : ''}
          </div>
          <div class="stop-side">
            ${afternoon ? afternoonBadge(s.status) : K.statusBadge(s.status)}
            ${actions}
          </div>
        </div>`;
    }).join('');
  }

  function nextCardHtml(st) {
    const afternoon = st.shift === 'afternoon';
    if (st.active && st.allFinal) {
      return `
        <div class="label">Rota concluída</div>
        <div class="map-next-name">${icon('checkCircle')}Todos os alunos com status final</div>
        <div class="map-next-addr">${st.stats.delivered} entregue(s) · ${st.stats.noDelivery + st.stats.issues} ocorrência(s)</div>
        <div class="map-next-meta">
          <span>${icon('users')}${st.stats.total} alunos</span>
          <span>${icon('clock')}${st.etaMin != null ? Math.ceil(st.etaMin) + ' min' : '—'}</span>
        </div>`;
    }
    if (st.active && afternoon && st.next) {
      const s = st.next;
      if (s.status === 'picked') {
        return `
          <div class="label">Entrega na residência</div>
          <div class="map-next-name">${icon('home')}${esc(s.name)}</div>
          <div class="map-next-addr">${esc(s.address)}, ${esc(s.number)} — ${esc(s.district)}</div>
          <div class="map-next-meta">
            <span>${icon('users')}${st.stats.picked} a bordo</span>
            <span>${icon('clock')}${st.etaMin != null ? Math.ceil(st.etaMin) + ' min' : '—'}</span>
            <span>${icon('check')}Confirme a entrega</span>
          </div>`;
      }
      return `
        <div class="label">Embarque na escola</div>
        <div class="map-next-name">${icon('school')}${esc(s.name)}</div>
        <div class="map-next-addr">${esc(st.school ? st.school.name : 'Escola')} · ${esc(st.school ? st.school.district : '')}</div>
        <div class="map-next-meta">
          <span>${icon('users')}${st.stats.waiting} aguardando</span>
          <span>${icon('clock')}${st.etaMin != null ? Math.ceil(st.etaMin) + ' min' : '—'}</span>
          <span>${icon('userCheck')}Confirme o embarque</span>
        </div>`;
    }
    if (st.active && st.allPicked) {
      return `
        <div class="label">Todos a bordo</div>
        <div class="map-next-name">${icon('school')}${esc(st.school ? st.school.name : 'Escola')}</div>
        <div class="map-next-addr">${esc(st.school ? st.school.address + ' · ' + st.school.district : 'Destino final')}</div>
        <div class="map-next-meta">
          <span>${icon('users')}${st.stats.picked} alunos</span>
          <span>${icon('clock')}${st.etaMin != null ? Math.ceil(st.etaMin) + ' min' : '—'}</span>
        </div>`;
    }
    if (!st.next) {
      return `
        <div class="label">Próximo destino</div>
        <div class="map-next-name">${icon('route')}${st.active ? 'Calculando…' : 'Rota não iniciada'}</div>
        <div class="map-next-addr">${st.active ? 'Aguardando posição da perua' : 'Inicie a rota para acompanhar'}</div>`;
    }
    const s = st.next;
    const dist = st.van ? K.geo.haversine(st.van, s) : null;
    return `
      <div class="label">Próximo destino</div>
      <div class="map-next-name">${icon('nav')}${esc(s.name)}</div>
      <div class="map-next-addr">${esc(s.address)}, ${esc(s.number)} — ${esc(s.district)}</div>
      <div class="map-next-meta">
        <span>${icon('mapPin')}${dist != null ? K.fmt.distance(dist) : '—'}</span>
        <span>${icon('clock')}${st.etaMin != null ? Math.ceil(st.etaMin) + ' min' : '—'}</span>
        <span>${icon('users')}${esc((s.guardian || '').split(' ')[0] || '')}</span>
      </div>`;
  }

  function controlsHtml(st) {
    if (!st.active) {
      return `
        <button class="btn btn-primary" data-start>${icon('play')}Iniciar rota</button>
        <button class="btn btn-ghost" data-open-route>${icon('route')}Ver rota completa</button>
        <button class="btn btn-ghost" data-open-map>${icon('map')}Abrir mapa</button>`;
    }
    if (st.shift === 'afternoon') {
      const next = st.next;
      if (!next || st.allFinal) {
        return `
          <button class="btn btn-success" data-finish>${icon('check')}Finalizar rota</button>
          ${st.paused ? `<button class="btn btn-ghost" data-resume>${icon('play')}Retomar</button>` : `<button class="btn btn-ghost" data-pause>${icon('pause')}Pausar</button>`}`;
      }
      if (next.status === 'picked') {
        return `
          <button class="btn btn-success" data-dropoff="${next.id}">${icon('check')}Confirmar entrega</button>
          <button class="btn btn-ghost" data-nodelivery="${next.id}">${icon('alert')}Entrega não realizada</button>
          ${st.paused
            ? `<button class="btn btn-primary" data-resume>${icon('play')}Retomar rota</button>`
            : `<button class="btn btn-ghost" data-pause>${icon('pause')}Pausar</button>`}
          <button class="btn btn-outline-danger" data-finish>${icon('stop')}Finalizar</button>`;
      }
      return `
        <button class="btn btn-success" data-confirm>${icon('userCheck')}Confirmar embarque</button>
        <button class="btn btn-ghost" data-next>${icon('skip')}Não embarcou</button>
        ${st.paused
          ? `<button class="btn btn-primary" data-resume>${icon('play')}Retomar rota</button>`
          : `<button class="btn btn-ghost" data-pause>${icon('pause')}Pausar</button>`}
        <button class="btn btn-outline-danger" data-finish>${icon('stop')}Finalizar</button>`;
    }
    if (st.allPicked) {
      return `
        <button class="btn btn-success" data-finish>${icon('check')}Finalizar na escola</button>
        ${st.paused ? `<button class="btn btn-ghost" data-resume>${icon('play')}Retomar</button>` : `<button class="btn btn-ghost" data-pause>${icon('pause')}Pausar</button>`}
        <button class="btn btn-outline-danger" data-finish>${icon('stop')}Finalizar rota</button>`;
    }
    return `
      <button class="btn btn-success" data-confirm>${icon('check')}Confirmar embarque</button>
      <button class="btn btn-ghost" data-next>${icon('skip')}Próximo aluno</button>
      ${st.paused
        ? `<button class="btn btn-primary" data-resume>${icon('play')}Retomar rota</button>`
        : `<button class="btn btn-ghost" data-pause>${icon('pause')}Pausar</button>`}
      <button class="btn btn-outline-danger" data-finish>${icon('stop')}Finalizar</button>`;
  }

  function renderStatus(st) {
    const route = st.route || K.store.activeRoute();
    const stats = st.active ? st.stats : K.store.routeStats(route);
    const info = routeStatusInfo(st);
    const next = st.next;
    const driver = K.store.driver();

    /* Stats */
    const afternoon = !!(route && route.shift === 'afternoon');
    const statsEl = $('#statsGrid');
    if (statsEl) {
      const cards = afternoon ? [
        statCard({
          icon: 'users', tone: '', label: 'Total de alunos', value: stats.total,
          meta: `<b>${stats.total}</b> na rota da tarde`
        }),
        statCard({
          icon: 'userCheck', tone: 'green', label: 'Embarcados na escola', value: stats.picked,
          meta: `${stats.waiting} aguardando embarque`,
          flag: stats.picked ? 'A bordo' : null, flagCls: 'b-green'
        }),
        statCard({
          icon: 'home', tone: 'green', label: 'Entregues na residência', value: stats.delivered,
          meta: `${stats.total ? Math.round((stats.delivered / stats.total) * 100) : 0}% da rota concluída`
        }),
        statCard({
          icon: 'clock', tone: 'gray', label: 'Restantes na rota', value: stats.waiting + stats.picked,
          meta: `${stats.picked} a bordo · ${stats.waiting} sem embarcar · ${stats.noDelivery + stats.issues} ocorrência(s)`,
          flag: stats.noDelivery ? String(stats.noDelivery) : null, flagCls: 'b-red'
        }),
        statCard({
          icon: 'nav', tone: '', label: 'Próximo destino', small: true,
          value: next ? esc(next.name) : (st.active && st.allFinal ? 'Concluído' : '—'),
          meta: next
            ? (next.status === 'picked' ? `${esc(next.address)}, ${esc(next.number)}` : `Embarque · ${esc(st.school ? st.school.name : 'Escola')}`)
            : (st.active ? 'Todos os alunos com status final' : 'Inicie a rota para definir')
        }),
        statCard({
          icon: 'route', tone: st.active && !st.paused ? '' : st.active ? 'amber' : 'navy',
          label: 'Status da rota', small: true,
          value: `<span class="row" style="gap:7px"><span class="live-dot ${info.dot}"></span>${info.label}</span>`,
          meta: st.active
            ? `${K.fmt.time(st.startedAt)} · ${st.etaMin != null ? Math.ceil(st.etaMin) + ' min restantes' : 'calculando'}`
            : `${route ? esc(route.name) : 'Sem rota'} · ${route ? esc(route.time) : '--:--'}`
        })
      ] : [
        statCard({
          icon: 'users', tone: '', label: 'Total de alunos', value: stats.total,
          meta: `<b>${stats.total}</b> cadastrados na rota ativa`
        }),
        statCard({
          icon: 'userCheck', tone: 'green', label: 'Alunos já buscados', value: stats.picked,
          meta: `<span class="up">${stats.total ? Math.round((stats.picked / stats.total) * 100) : 0}%</span> da rota concluída`,
          flag: stats.picked ? 'A bordo' : null, flagCls: 'b-green'
        }),
        statCard({
          icon: 'clock', tone: 'gray', label: 'Aguardando', value: stats.waiting,
          meta: `${stats.issues} ocorrência(s) registrada(s)`,
          flag: stats.issues ? String(stats.issues) : null, flagCls: 'b-red'
        }),
        statCard({
          icon: 'nav', tone: '', label: 'Próximo destino', small: true,
          value: next ? esc(next.name) : (st.active && st.allPicked ? 'Escola' : '—'),
          meta: next ? `${esc(next.address)}, ${esc(next.number)}` : (st.active ? 'Todos os alunos confirmados' : 'Inicie a rota para definir')
        }),
        statCard({
          icon: 'route', tone: st.active && !st.paused ? '' : st.active ? 'amber' : 'navy',
          label: 'Status da rota', small: true,
          value: `<span class="row" style="gap:7px"><span class="live-dot ${info.dot}"></span>${info.label}</span>`,
          meta: st.active
            ? `${K.fmt.time(st.startedAt)} · ${st.etaMin != null ? Math.ceil(st.etaMin) + ' min restantes' : 'calculando'}`
            : `${route ? esc(route.name) : 'Sem rota'} · ${route ? esc(route.time) : '--:--'}`
        })
      ];
      statsEl.innerHTML = cards.join('');
    }

    /* Stops */
    const listEl = $('#stopList');
    if (listEl) {
      const scroll = listEl.scrollTop;
      listEl.innerHTML = stopsHtml(st);
      listEl.scrollTop = scroll || stopScroll;
    }
    const countEl = $('#stopCount');
    if (countEl) countEl.textContent = `${stats.done}/${stats.total}`;

    /* Controls */
    const controlsEl = $('#routeControls');
    if (controlsEl) controlsEl.innerHTML = controlsHtml(st);

    /* Hero primary */
    const heroPrimary = $('#heroPrimary');
    if (heroPrimary) {
      if (!st.active) {
        heroPrimary.innerHTML = `${icon('play')}Iniciar rota`;
        heroPrimary.setAttribute('data-hero-action', 'start');
      } else if (st.shift === 'afternoon') {
        if (st.allFinal) {
          heroPrimary.innerHTML = `${icon('check')}Finalizar rota`;
          heroPrimary.setAttribute('data-hero-action', 'finish');
        } else if (st.next && st.next.status === 'picked') {
          heroPrimary.innerHTML = `${icon('home')}Confirmar entrega`;
          heroPrimary.setAttribute('data-hero-action', 'dropoff');
        } else {
          heroPrimary.innerHTML = `${icon('userCheck')}Confirmar embarque`;
          heroPrimary.setAttribute('data-hero-action', 'confirm');
        }
      } else if (st.allPicked) {
        heroPrimary.innerHTML = `${icon('check')}Finalizar na escola`;
        heroPrimary.setAttribute('data-hero-action', 'finish');
      } else {
        heroPrimary.innerHTML = `${icon('userCheck')}Confirmar embarque`;
        heroPrimary.setAttribute('data-hero-action', 'confirm');
      }
    }

    const heroMetrics = $('#heroMetrics');
    if (heroMetrics) {
      heroMetrics.innerHTML = st.shift === 'afternoon'
        ? `
          <div class="hero-metric"><b>${stats.total}</b><span>Alunos hoje</span></div>
          <div class="hero-metric"><b>${stats.picked}</b><span>Embarcados</span></div>
          <div class="hero-metric"><b>${st.active ? Math.round(st.progress) : stats.progress}%</b><span>Rota concluída</span></div>`
        : `
          <div class="hero-metric"><b>${stats.total}</b><span>Alunos hoje</span></div>
          <div class="hero-metric"><b>${route ? esc(route.time) : '--:--'}</b><span>Saída prevista</span></div>
          <div class="hero-metric"><b>${st.active ? Math.round(st.progress) : stats.progress}%</b><span>Rota concluída</span></div>`;
    }

    /* Overlays do mapa */
    const modeChip = $('#mapModeChip');
    if (modeChip) {
      const demo = K.store.settings().demoMode;
      modeChip.className = 'map-chip ' + (demo ? 'demo' : 'live');
      modeChip.innerHTML = demo
        ? `${icon('bolt')}Demonstração · localização simulada`
        : `${icon('locate')}GPS real · ${st.active ? 'acompanhando' : 'aguardando rota'}`;
    }
    const nextCard = $('#nextCard');
    if (nextCard) nextCard.innerHTML = nextCardHtml(st);

    const mapStats = $('#mapStats');
    if (mapStats) {
      mapStats.innerHTML = `<span class="live-dot ${info.dot}"></span>${info.label} · ${st.shift === 'afternoon' ? `${stats.delivered}/${stats.total} entregues` : `${stats.picked}/${stats.total} alunos`}`;
    }

    /* Mapa */
    if (mapView) {
      const data = K.engine.mapData();
      if (!st.active) {
        const afternoon = !!(route && route.shift === 'afternoon');
        const base = afternoon && st.school ? st.school : K.store.driver().base;
        const list = route ? K.store.routeStudents(route) : [];
        data.route = [base].concat(list.map((s) => ({ lat: s.lat, lng: s.lng })));
        if (!afternoon && st.school) data.route.push({ lat: st.school.lat, lng: st.school.lng });
        data.routeApprox = true;
        data.van = null;
      }
      const fitKey = `${st.routeId}:${st.active}:${stats.total}`;
      const fit = fitKey !== mapFitKey;
      mapFitKey = fitKey;
      mapView.setData(Object.assign({}, data, { fit }));
    }

    updateLive(st);
  }

  function updateLive(st) {
    const stats = st.active ? st.stats : K.store.routeStats(st.route);
    const pct = st.active ? Math.round(st.progress) : stats.progress;
    const bar = $('#routeProgress');
    if (bar) {
      bar.style.width = pct + '%';
      bar.classList.toggle('green', pct >= 100);
    }
    const etaEl = $('[data-live="eta"]');
    if (etaEl) etaEl.textContent = st.active && !st.paused && st.etaMin != null ? Math.ceil(st.etaMin) + ' min' : st.active ? 'pausada' : '—';
    const distEl = $('[data-live="distance"]');
    if (distEl) distEl.textContent = st.active ? K.fmt.distance(st.remainingMeters) : K.fmt.km(K.store.estimateDistance(st.route), 1);
    const pickedEl = $('[data-live="picked"]');
    if (pickedEl) pickedEl.textContent = stats.picked;
    const progressLabel = $('[data-live="progressLabel"]');
    if (progressLabel) progressLabel.textContent = `${pct}% concluído · ${stats.done} de ${stats.total} ${st.shift === 'afternoon' ? 'entregas' : 'paradas'}`;
    const arrival = $('[data-live="arrival"]');
    if (arrival) {
      if (st.active && !st.paused && st.etaMin != null) {
        const t = new Date(Date.now() + st.etaMin * 60000);
        arrival.textContent = K.fmt.time(t);
      } else {
        arrival.textContent = '—';
      }
    }
    const liveBadge = $('#liveBadge');
    if (liveBadge) {
      liveBadge.className = 'badge ' + (st.active && !st.paused ? 'b-blue' : st.active ? 'b-amber' : 'b-gray');
      liveBadge.innerHTML = st.active && !st.paused ? `<span class="live-dot"></span>Ao vivo` : st.active ? 'Pausada' : 'Aguardando';
    }

    if (st.active && mapView) {
      mapView.setVan(st.van);
      mapView.setTraveled(st.traveled);
    }
  }

  function mount(container) {
    rootEl = container;
    mapFitKey = '';
    const st = K.engine.getState();
    const driver = K.store.driver();
    const route = st.route || K.store.activeRoute();
    const info = routeStatusInfo(st);

    container.innerHTML = `
      <div class="stack" style="gap:16px">
        <section class="hero">
          <div class="hero-main">
            <div class="hero-eyebrow">${icon('calendar')}${K.fmt.todayLong()}</div>
            <h1>${K.fmt.greeting()}, ${esc(K.fmt.firstName(driver.name))} <span class="wave">👋</span></h1>
            <p>${st.active
              ? (st.paused
                ? 'Sua rota está pausada. Retome quando estiver pronto para continuar.'
                : st.shift === 'afternoon'
                  ? 'Rota da tarde em andamento. Confirme o embarque na escola e a entrega em cada residência.'
                  : 'A rota está em andamento. Acompanhe o próximo aluno e confirme os embarques.')
              : `Sua rota ${route ? 'da ' + (route.shift === 'morning' ? 'manhã' : 'tarde') : 'de hoje'} está pronta. Inicie quando chegar o horário da saída.`}</p>
            <div class="hero-tagline">${icon('shield')}“Rastreamento inteligente, do primeiro aluno até a escola.”</div>
          </div>
          <div class="hero-side">
            <div class="hero-metrics" id="heroMetrics"></div>
            <div class="hero-actions">
              <button class="btn btn-primary" id="heroPrimary" data-hero-action="start"></button>
              <button class="btn btn-hero-ghost" data-open-map>${icon('map')}Ver mapa</button>
            </div>
          </div>
        </section>

        <section class="stat-grid stagger" id="statsGrid"></section>

        <div class="dash-grid">
          <section class="panel map-card">
            <div class="map-head">
              <div class="map-head-left">
                <span class="stat-ico" style="width:36px;height:36px;border-radius:10px">${icon('map')}</span>
                <div>
                  <div class="map-head-title">Rota ao vivo <span class="badge b-blue" id="liveBadge"><span class="live-dot"></span>Ao vivo</span></div>
                  <div class="map-head-sub" id="mapStats"></div>
                </div>
              </div>
              <div class="row" style="gap:7px">
                <button class="btn btn-ghost btn-sm" data-center>${icon('crosshair')}Centralizar</button>
                <a class="btn btn-soft btn-sm" href="#/mapa">${icon('external')}Expandir</a>
              </div>
            </div>
            <div class="map-shell tall">
              <div class="map-box" id="dashMap"></div>
              <div class="map-overlay tl">
                <span class="map-chip" id="mapModeChip"></span>
              </div>
              <div class="map-overlay bl">
                <div class="map-legend">
                  <span class="legend-item"><span class="legend-dot" style="background:#1265E8"></span>Próximo</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#159B5B"></span>Pego</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#93A0B3"></span>Aguardando</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#E5484D"></span>Problema</span>
                  <span class="legend-item"><span class="legend-line" style="background:#1265E8"></span>Rota</span>
                </div>
              </div>
              <div class="map-overlay br">
                <div class="map-next-card" id="nextCard"></div>
              </div>
            </div>
          </section>

          <section class="panel" style="min-height:0">
            <div class="panel-head">
              <div>
                <div class="panel-title">${icon('users')}Sequência de alunos</div>
                <div class="panel-sub">${esc(route ? route.name : 'Rota')} · ${esc(route ? route.time : '--:--')}</div>
              </div>
              <span class="badge b-blue" id="stopCount">0/0</span>
            </div>
            <div class="panel-body" style="display:flex;flex-direction:column;min-height:0">
              <div class="stop-list" id="stopList" style="max-height:470px"></div>
              <div class="stop-list-foot">
                <button class="btn btn-ghost btn-block btn-sm" data-open-route>${icon('route')}Ver rota completa${icon('arrowRight')}</button>
              </div>
            </div>
          </section>
        </div>

        <section class="route-bar">
          <div class="route-bar-top">
            <div class="route-bar-title">${icon('route')}Progresso da rota
              <span class="badge ${info.cls}"><span class="live-dot ${info.dot}"></span>${info.label}</span>
            </div>
            <div class="route-bar-meta">
              <span class="route-meta-item">${icon('clock')}Restam <b data-live="eta">—</b></span>
              <span class="route-meta-item">${icon('mapPin')}Distância <b data-live="distance">—</b></span>
              <span class="route-meta-item">${icon('users')}<b data-live="picked">0</b> alunos a bordo</span>
            </div>
          </div>
          <div class="progress progress-lg"><div class="progress-fill" id="routeProgress" style="width:0%"></div></div>
          <div class="progress-labels">
            <span data-live="progressLabel">0% concluído</span>
            <span>Chegada prevista <b data-live="arrival">—</b></span>
          </div>
          <div class="route-controls" id="routeControls"></div>
        </section>
      </div>`;

    initMap();
    bind();
    renderStatus(K.engine.getState());
  }

  function initMap() {
    const el = $('#dashMap');
    if (!el) return;
    mapView = new K.MapView(el, {
      onStudentClick: (id) => {
        const s = K.store.student(id);
        if (s) {
          K.toast(s.name, `${s.address}, ${s.number} — ${s.district}`, 'info');
        }
      }
    });
  }

  function handleAction(action) {
    if (action === 'start') K.actions.start();
    else if (action === 'pause') K.actions.pause();
    else if (action === 'resume') K.actions.resume();
    else if (action === 'finish') K.actions.finish();
    else if (action === 'confirm') K.actions.confirmPick();
    else if (action === 'dropoff') {
      const st = K.engine.getState();
      if (st.next) K.actions.confirmDropOff(st.next.id);
    } else if (action === 'next') K.actions.skip();
    else if (action === 'open-map') location.hash = '#/mapa';
    else if (action === 'open-route') location.hash = '#/rotas';
  }

  function bind() {
    rootEl.addEventListener('click', (ev) => {
      const boardBtn = ev.target.closest('[data-board]');
      if (boardBtn) {
        ev.stopPropagation();
        K.actions.board(boardBtn.getAttribute('data-board'));
        return;
      }
      const dropBtn = ev.target.closest('[data-dropoff]');
      if (dropBtn) {
        ev.stopPropagation();
        K.actions.confirmDropOff(dropBtn.getAttribute('data-dropoff'));
        return;
      }
      const noBtn = ev.target.closest('[data-nodelivery]');
      if (noBtn) {
        ev.stopPropagation();
        K.actions.failDelivery(noBtn.getAttribute('data-nodelivery'));
        return;
      }
      const confirmBtn = ev.target.closest('[data-confirm]');
      if (confirmBtn) {
        ev.stopPropagation();
        K.actions.confirmPick();
        return;
      }
      const actionEl = ev.target.closest('[data-start],[data-pause],[data-resume],[data-finish],[data-next],[data-open-map],[data-open-route]');
      if (actionEl) {
        if (actionEl.hasAttribute('data-start')) handleAction('start');
        else if (actionEl.hasAttribute('data-pause')) handleAction('pause');
        else if (actionEl.hasAttribute('data-resume')) handleAction('resume');
        else if (actionEl.hasAttribute('data-finish')) handleAction('finish');
        else if (actionEl.hasAttribute('data-next')) handleAction('next');
        else if (actionEl.hasAttribute('data-open-map')) handleAction('open-map');
        else if (actionEl.hasAttribute('data-open-route')) handleAction('open-route');
        return;
      }
      const heroBtn = ev.target.closest('[data-hero-action]');
      if (heroBtn) { handleAction(heroBtn.getAttribute('data-hero-action')); return; }
      if (ev.target.closest('[data-center]')) {
        if (mapView) mapView.fitNow();
        return;
      }
      const stop = ev.target.closest('[data-student]');
      if (stop && mapView) {
        mapView.openStudent(stop.getAttribute('data-student'));
      }
    });

    rootEl.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('stop')) {
        ev.preventDefault();
        const stop = ev.target.closest('[data-student]');
        if (stop && mapView) mapView.openStudent(stop.getAttribute('data-student'));
      }
    });
  }

  K.views = K.views || {};
  K.views.inicio = {
    mount,
    unmount() {
      if (mapView) { mapView.destroy(); mapView = null; }
      rootEl = null;
    },
    onResize() {
      if (mapView) mapView.invalidate();
    },
    onRoute(type, st) {
      if (type === 'move') {
        updateLive(st);
      } else {
        renderStatus(st);
      }
    }
  };
})(window.KT);
