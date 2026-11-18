/* ==========================================================================
   KombiTech — Views do responsável
   Início, acompanhamento da rota, notificações e perfil da família.
   Privacidade: o responsável vê apenas o próprio filho, a van e a escola.
   ========================================================================== */
(function (K) {
  'use strict';

  const { $, icon, esc } = K;
  let rootEl = null;
  let activeMap = null;
  let activeMapKey = '';
  let mapTimer = 0;
  let storageHandler = null;
  let notifFilter = 'all';

  function guardianSession() {
    const s = K.store.session() || {};
    return s.role === 'guardian' ? K.store.guardian(s.guardianId) : null;
  }

  function childOf(guardian) {
    const list = K.store.guardianChildren(guardian);
    return list.length ? list[0] : null;
  }

  function todayISO() {
    return K.store.isoDay(new Date());
  }

  function statusInfo(child, route) {
    if (!child) return { label: 'Sem aluno vinculado', cls: 'b-gray', icon: 'alert', tone: '' };
    const afternoon = !!(route && route.shift === 'afternoon');
    if (child.status === 'delivered') {
      return { label: 'Entregue em casa', cls: 'b-green', icon: 'home', tone: 'green' };
    }
    if (child.status === 'no_delivery') {
      return { label: 'Entrega não realizada', cls: 'b-red', icon: 'alert', tone: 'amber' };
    }
    if (child.status === 'picked') {
      return {
        label: afternoon ? 'A caminho de casa' : 'A caminho da escola',
        cls: 'b-blue',
        icon: 'van',
        tone: 'blue'
      };
    }
    if (child.status === 'next') return { label: afternoon ? 'Próximo embarque' : 'Próxima parada', cls: 'b-blue', icon: 'locate', tone: 'blue' };
    if (child.status === 'issue') {
      return {
        label: afternoon ? 'Não embarcou' : 'Ocorrência na coleta',
        cls: 'b-red',
        icon: 'alert',
        tone: 'amber'
      };
    }
    return {
      label: afternoon ? 'Aguardando embarque na escola' : 'Aguardando a van',
      cls: 'b-gray',
      icon: 'clock',
      tone: ''
    };
  }

  function notifMeta(n) {
    const type = n.type || 'info';
    if (type === 'school') return { icon: 'school', tone: 'green', label: 'Escola' };
    if (type === 'home') return { icon: 'home', tone: 'green', label: 'Casa' };
    if (type === 'route') return { icon: 'route', tone: 'blue', label: 'Rota' };
    if (type === 'hazard') return { icon: 'alert', tone: 'amber', label: 'Perigo na via' };
    if (type === 'van') return { icon: 'van', tone: 'blue', label: 'Van' };
    if (type === 'boarding') return { icon: 'users', tone: 'blue', label: 'Embarque' };
    if (type === 'delivery') return { icon: 'home', tone: 'green', label: 'Entrega' };
    if (type === 'no_delivery') return { icon: 'alert', tone: 'amber', label: 'Entrega não realizada' };
    if (type === 'issue') return { icon: 'alert', tone: 'amber', label: 'Ocorrência' };
    if (type === 'message') return { icon: 'message', tone: 'blue', label: 'Mensagem' };
    return { icon: 'info', tone: '', label: 'Aviso' };
  }

  function notifRow(n, compact) {
    const m = notifMeta(n);
    return `
      <div class="list-row" style="align-items:flex-start;${compact ? 'padding:8px 0' : ''}">
        <div class="stat-ico ${m.tone}" style="width:34px;height:34px;border-radius:10px">${icon(m.icon)}</div>
        <div class="grow" style="min-width:0">
          <div class="list-title">${esc(n.title)}</div>
          <div class="list-sub" style="white-space:normal">${esc(n.text)}</div>
          <div class="tiny muted" style="margin-top:4px">${m.label} · ${K.fmt.date(n.at)} · ${K.fmt.time(n.at)}</div>
        </div>
        ${n.read ? '' : '<span class="live-dot blue"></span>'}
      </div>`;
  }

  function guardianMapData() {
    const guardian = guardianSession();
    const child = childOf(guardian);
    const route = K.store.activeRoute();
    const db = K.store.get() || {};
    const live = db.live || null;
    const school = db.school || null;
    const base = K.store.driver().base || null;
    const students = child ? [child] : [];
    const nextId = child && child.status === 'next' ? child.id : null;

    if (live && Array.isArray(live.geometry) && live.geometry.length) {
      const idx = Math.max(1, Math.min(live.geometry.length, (live.traveledIndex || 0) + 1));
      return {
        students,
        school,
        van: live.van,
        route: live.geometry,
        traveled: live.geometry.slice(0, idx),
        nextId,
        routeApprox: !!live.approx,
        live,
        routeObj: route,
        child
      };
    }

    const line = [];
    const afternoon = !!(route && route.shift === 'afternoon');
    if (afternoon && school) line.push({ lat: school.lat, lng: school.lng });
    else if (base) line.push({ lat: base.lat, lng: base.lng });
    if (child) line.push({ lat: child.lat, lng: child.lng });
    if (!afternoon && school) line.push({ lat: school.lat, lng: school.lng });
    return {
      students,
      school,
      van: null,
      route: line,
      traveled: [],
      nextId,
      routeApprox: true,
      live: null,
      routeObj: route,
      child
    };
  }

  function liveMetrics(data) {
    const route = data.routeObj;
    const live = data.live;
    const total = live && data.route && data.route.length
      ? K.geo.pathDistance(data.route)
      : (route ? K.store.estimateDistance(route) * 1000 : 0);
    const traveled = live ? (live.traveledMeters || 0) : 0;
    const remaining = Math.max(0, total - traveled);
    const speed = live && live.speedKmh ? live.speedKmh : 26;
    const etaMin = data.live && route && route.status === 'running' && remaining
      ? remaining / (speed * 1000 / 60)
      : null;
    return {
      total,
      traveled,
      remaining,
      etaMin,
      progress: total ? Math.min(100, Math.round((traveled / total) * 100)) : 0
    };
  }

  function initMap(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    activeMapKey = '';
    activeMap = new K.MapView(el, {
      onStudentClick: (id) => openStudentModal(id)
    });
  }

  function updateMap(data) {
    if (!activeMap) return;
    const key = `${data.routeObj ? data.routeObj.id : 'none'}:${data.live ? 'live' : 'idle'}:${data.students.length}`;
    const fit = key !== activeMapKey;
    activeMapKey = key;
    activeMap.setData(Object.assign({}, data, { fit }));
  }

  function startLive(cb) {
    stopLive();
    cb();
    mapTimer = setInterval(cb, 5000);
    storageHandler = (ev) => {
      if (ev.key === 'kombitech.db.v1' || ev.key === 'kombitech.lastActivity.v1') cb();
    };
    window.addEventListener('storage', storageHandler);
  }

  function stopLive() {
    if (mapTimer) { clearInterval(mapTimer); mapTimer = 0; }
    if (storageHandler) { window.removeEventListener('storage', storageHandler); storageHandler = null; }
    if (activeMap) { activeMap.destroy(); activeMap = null; }
    activeMapKey = '';
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

  function childStatusCard(guardian, child, route, data) {
    const info = statusInfo(child, route);
    const metrics = liveMetrics(data);
    const driver = K.store.driver();
    return `
      <div class="row-between" style="align-items:flex-start">
        <div class="row" style="gap:10px;min-width:0">
          <div class="avatar">${esc(K.fmt.initials(child ? child.name : guardian.name))}</div>
          <div style="min-width:0">
            <div class="strong">${esc(child ? child.name : 'Aluno não vinculado')}</div>
            <div class="tiny muted">${child ? esc(child.school) : 'Fale com o motorista para vincular'}</div>
          </div>
        </div>
        <span class="badge ${info.cls}">${icon(info.icon)}${info.label}</span>
      </div>
      <div class="guardian-mini-grid">
        <div><span>Próxima parada</span><b>${esc(data.students.find((s) => s.status === 'next') ? data.students.find((s) => s.status === 'next').name : (child && child.status === 'picked' ? 'Destino final' : child && child.status === 'delivered' ? 'Concluído' : 'Aguardando'))}</b></div>
        <div><span>Previsão</span><b>${metrics.etaMin != null ? Math.ceil(metrics.etaMin) + ' min' : '—'}</b></div>
        <div><span>Embarque</span><b>${child && child.boardedAt ? K.fmt.time(child.boardedAt) : '—'}</b></div>
        <div><span>Entrega</span><b>${child && child.deliveredAt ? K.fmt.time(child.deliveredAt) : child && child.noDeliveryAt ? 'Não realizada' : '—'}</b></div>
        <div><span>Motorista</span><b>${esc(K.fmt.firstName(driver.name))}</b></div>
        <div><span>Van</span><b>${esc(driver.van.plate)}</b></div>
      </div>
      <div class="progress" style="margin-top:14px"><div class="progress-fill ${metrics.progress >= 100 ? 'green' : ''}" style="width:${metrics.progress}%"></div></div>
      <div class="row-between tiny muted" style="margin-top:6px"><span>${metrics.progress}% do trajeto</span><span>${K.fmt.distance(metrics.remaining)} restantes</span></div>
      <div class="row guardian-action-row" style="gap:8px;margin-top:14px">
        <a class="btn btn-soft btn-sm" href="#/mapa">${icon('map')}Acompanhar no mapa</a>
        <a class="btn btn-ghost btn-sm" href="#/mensagens">${icon('message')}Falar com motorista</a>
      </div>`;
  }

  function homeHtml(guardian, child) {
    const driver = K.store.driver();
    return `
      <div class="stack" style="gap:16px">
        <section class="hero guardian-hero">
          <div class="hero-main">
            <div class="hero-eyebrow">${icon('calendar')}${K.fmt.todayLong()}</div>
            <h1>${K.fmt.greeting()}, ${esc(K.fmt.firstName(guardian.name))} <span class="wave">👋</span></h1>
            <p id="gHeroText">Acompanhe a rotina de ${child ? esc(K.fmt.firstName(child.name)) : 'seu filho'} com segurança e tranquilidade.</p>
            <div class="hero-tagline">${icon('shield')}“Rastreamento inteligente, do primeiro aluno até a escola.”</div>
          </div>
          <div class="hero-side">
            <div class="guardian-child-badge">
              <div class="avatar photo">${esc(K.fmt.initials(child ? child.name : guardian.name))}</div>
              <div class="grow">
                <div class="strong">${esc(child ? child.name : 'Nenhum aluno vinculado')}</div>
                <div class="tiny" style="color:#BBD2EC">${child ? esc(child.school) : 'Fale com o motorista'}</div>
              </div>
              <span class="badge" style="background:rgba(255,255,255,.12);color:#DCE9FA">${icon('shield')} Família</span>
            </div>
            <div class="hero-actions">
              <a class="btn btn-soft" href="#/mensagens">${icon('message')}Conversar</a>
              <a class="btn btn-primary" href="#/mapa">${icon('locate')}Acompanhar</a>
            </div>
          </div>
        </section>

        <section class="stat-grid stat-grid-4 stagger" id="gStats"></section>

        <div class="dash-grid">
          <section class="panel map-card">
            <div class="map-head">
              <div class="map-head-left">
                <span class="stat-ico" style="width:36px;height:36px;border-radius:10px">${icon('map')}</span>
                <div>
                  <div class="map-head-title">Rota do seu filho <span class="badge b-blue" id="gLiveBadge"><span class="live-dot"></span>Ao vivo</span></div>
                  <div class="map-head-sub" id="gMapStats"></div>
                </div>
              </div>
              <a class="btn btn-soft btn-sm" href="#/mapa">${icon('external')}Expandir</a>
            </div>
            <div class="map-shell tall">
              <div class="map-box" id="gHomeMap"></div>
              <div class="map-overlay tl"><span class="map-chip demo" id="gMapMode">${icon('bolt')}Demonstração · posição simulada</span></div>
              <div class="map-overlay bl">
                <div class="map-legend">
                  <span class="legend-item"><span class="legend-dot" style="background:#1265E8"></span>Seu filho</span>
                  <span class="legend-item"><span class="legend-dot" style="background:#071629"></span>Escola</span>
                  <span class="legend-item"><span class="legend-line" style="background:#1265E8"></span>Rota</span>
                  <span class="legend-item"><span class="legend-line" style="background:#159B5B"></span>Percorrido</span>
                </div>
              </div>
              <div class="map-overlay br">
                <div class="map-next-card" id="gNextCard">
                  <div class="map-next-name">${icon('nav')}${esc(child ? child.name : 'Rota')}</div>
                  <div class="map-next-addr">${esc(child ? `${child.address}, ${child.number}` : 'Aguardando rota')}</div>
                </div>
              </div>
            </div>
          </section>

          <aside class="stack" style="gap:14px">
            <section class="card guardian-status-card" id="gChildStatus"></section>

            <section class="card">
              <div class="row-between"><div class="strong">Avisos recentes</div><a class="auth-link" href="#/notificacoes">Ver todos</a></div>
              <div class="stack" id="gNotifPreview" style="margin-top:10px"></div>
            </section>

            <section class="card">
              <div class="row-between"><div class="strong">Conversa com ${esc(K.fmt.firstName(driver.name))}</div><a class="auth-link" href="#/mensagens">Abrir</a></div>
              <div id="gMsgPreview" style="margin-top:10px"></div>
            </section>

            <section class="card">
              <div class="row-between"><div class="strong">Próximos eventos</div><span class="badge b-gray" id="gEventCount">0</span></div>
              <div class="stack" id="gEvents" style="margin-top:10px"></div>
            </section>
          </aside>
        </div>
      </div>`;
  }

  function refreshHome() {
    if (!rootEl) return;
    const guardian = guardianSession();
    const child = childOf(guardian);
    const data = guardianMapData();
    const route = data.routeObj;
    const metrics = liveMetrics(data);
    const info = statusInfo(child, route);
    const driver = K.store.driver();
    const stats = route ? K.store.routeStats(route) : { total: 0, picked: 0, progress: 0 };
    const notifications = K.store.notificationsFor('guardian', guardian.id);
    const unread = notifications.filter((n) => !n.read).length;
    const conv = K.store.conversationForGuardian(guardian.id);
    const last = conv ? K.store.lastMessage(conv.id) : null;
    const events = K.store.calendarEvents().filter((e) => e.date >= todayISO()).slice(0, 3);

    const afternoon = !!(route && route.shift === 'afternoon');
    const heroText = !route
      ? 'Ainda não há uma rota programada. Quando o motorista iniciar o trajeto, você poderá acompanhar tudo por aqui.'
      : route.status === 'running'
        ? (child && child.status === 'delivered'
          ? `${K.fmt.firstName(child.name)} foi entregue em casa${child.deliveredAt ? ' às ' + K.fmt.time(child.deliveredAt) : ''}. Bom descanso!`
          : child && child.status === 'no_delivery'
            ? `A entrega de ${K.fmt.firstName(child.name)} não pôde ser realizada. O motorista registrou a ocorrência e vai falar com você.`
            : child && child.status === 'picked'
              ? (afternoon
                ? `${K.fmt.firstName(child.name)} embarcou na escola e está a caminho de casa. Acompanhe a posição da van em tempo real.`
                : `${K.fmt.firstName(child.name)} já embarcou e está a caminho da escola. Acompanhe a posição da van em tempo real.`)
              : `A van está em rota. ${child ? K.fmt.firstName(child.name) : 'Seu filho'} será avisado quando estiver chegando.`)
        : route.status === 'paused'
          ? 'A rota está pausada neste momento. Você será avisado quando o motorista retomar.'
          : route.status === 'done'
            ? (child && child.status === 'delivered'
              ? `${K.fmt.firstName(child.name)} foi entregue em casa${child.deliveredAt ? ' às ' + K.fmt.time(child.deliveredAt) : ''}. Rota concluída com segurança.`
              : child && child.status === 'no_delivery'
                ? `A entrega de ${K.fmt.firstName(child.name)} não pôde ser realizada. O motorista registrou a ocorrência e vai falar com você.`
                : `A rota de hoje foi concluída. ${child ? K.fmt.firstName(child.name) : 'Seu filho'} não embarcou nesta viagem.`)
            : `A próxima saída está prevista para ${route.time}. Você receberá uma notificação quando a van iniciar o trajeto.`;
    const heroEl = $('#gHeroText');
    if (heroEl) heroEl.textContent = heroText;

    const statsEl = $('#gStats');
    if (statsEl) {
      statsEl.innerHTML = [
        statCard({
          icon: info.icon,
          tone: info.tone,
          label: 'Meu filho',
          value: esc(info.label),
          small: true,
          flag: child ? `#${child.status === 'picked' ? 'A bordo' : child.status === 'delivered' ? 'Entregue' : child.status === 'no_delivery' ? 'Não entregue' : child.status === 'next' ? 'Próximo' : child.status === 'issue' ? 'Ocorrência' : 'Aguardando'}` : '',
          flagCls: info.cls,
          meta: child ? esc(child.name) : 'Sem vínculo'
        }),
        statCard({
          icon: 'clock',
          tone: 'blue',
          label: 'Previsão de chegada',
          value: metrics.etaMin != null ? Math.ceil(metrics.etaMin) + ' min' : '—',
          flag: route && route.status === 'running' ? 'Em rota' : 'Aguardando',
          flagCls: route && route.status === 'running' ? 'b-blue' : 'b-gray',
          meta: route ? `Saída ${esc(route.time)}` : 'Sem rota programada'
        }),
        statCard({
          icon: 'van',
          tone: 'green',
          label: 'Van de hoje',
          value: esc(driver.van.model),
          small: true,
          flag: 'Verificada',
          flagCls: 'b-green',
          meta: `${esc(driver.van.plate)} · ${esc(K.fmt.firstName(driver.name))}`
        }),
        statCard({
          icon: 'bell',
          tone: unread ? 'amber' : '',
          label: 'Notificações',
          value: `${unread}`,
          flag: unread ? 'Novas' : 'Em dia',
          flagCls: unread ? 'b-amber' : 'b-green',
          meta: unread ? 'Toque para revisar os avisos' : 'Nenhum aviso pendente'
        })
      ].join('');
    }

    const childStatus = $('#gChildStatus');
    if (childStatus) childStatus.innerHTML = childStatusCard(guardian, child, route, data);

    const notifPreview = $('#gNotifPreview');
    if (notifPreview) {
      notifPreview.innerHTML = notifications.length
        ? notifications.slice(0, 3).map((n) => notifRow(n, true)).join('')
        : `<div class="tiny muted">Nenhum aviso recente.</div>`;
    }

    const msgPreview = $('#gMsgPreview');
    if (msgPreview) {
      msgPreview.innerHTML = last
        ? `<div class="list-row" style="padding:0"><div class="stat-ico blue" style="width:34px;height:34px;border-radius:10px">${icon('message')}</div><div class="grow"><div class="list-title">${esc(driver.name)}</div><div class="list-sub" style="white-space:normal">${esc(last.text)}</div><div class="tiny muted">${K.fmt.time(last.at)}</div></div>${conv && conv.unreadGuardian ? `<span class="chat-unread">${conv.unreadGuardian}</span>` : ''}</div>`
        : `<div class="tiny muted">Nenhuma mensagem ainda. Inicie a conversa com o motorista.</div>`;
    }

    const eventsEl = $('#gEvents');
    if (eventsEl) {
      eventsEl.innerHTML = events.length
        ? events.map((e) => `<div class="cal-event compact"><span class="cal-event-ico ${e.type}">${icon(e.type === 'holiday' ? 'calendar' : e.type === 'school' ? 'school' : 'users')}</span><div class="grow"><div class="cal-event-title">${esc(e.title)}</div><div class="tiny muted">${esc(e.date)}${e.time ? ' · ' + esc(e.time) : ''}</div></div></div>`).join('')
        : `<div class="tiny muted">Nenhum evento futuro.</div>`;
    }
    const eventCount = $('#gEventCount');
    if (eventCount) eventCount.textContent = events.length;

    const badge = $('#gLiveBadge');
    if (badge) {
      const running = route && route.status === 'running';
      const done = route && route.status === 'done';
      badge.className = 'badge ' + (running ? 'b-blue' : route && route.status === 'paused' ? 'b-amber' : done ? 'b-green' : 'b-gray');
      badge.innerHTML = running
        ? `<span class="live-dot"></span>Ao vivo`
        : route && route.status === 'paused'
          ? 'Pausada'
          : done
            ? `${icon('checkCircle')}Concluída`
            : 'Aguardando';
    }
    const mapStats = $('#gMapStats');
    if (mapStats) {
      mapStats.innerHTML = afternoon
        ? `${stats.picked} a bordo · ${stats.delivered}/${stats.total} entregues · ${esc(child ? child.school : 'Escola')}`
        : `${stats.picked}/${stats.total} paradas · ${esc(child ? child.school : 'Escola')}`;
    }
    const nextCard = $('#gNextCard');
    if (nextCard) {
      const next = data.students.find((s) => s.status === 'next');
      if (child && child.status === 'delivered') {
        nextCard.innerHTML = `<div class="map-next-name">${icon('home')}Entregue em casa</div><div class="map-next-addr">${child.deliveredAt ? 'Às ' + K.fmt.time(child.deliveredAt) : 'Entrega confirmada'}</div><div class="map-next-meta"><span class="badge b-green">${icon('checkCircle')}Concluído</span></div>`;
      } else if (child && child.status === 'no_delivery') {
        nextCard.innerHTML = `<div class="map-next-name">${icon('alert')}Entrega não realizada</div><div class="map-next-addr">${child.noDeliveryAt ? 'Registrada às ' + K.fmt.time(child.noDeliveryAt) : 'Ocorrência registrada'}</div><div class="map-next-meta"><span class="badge b-red">${icon('alert')}Falar com o motorista</span></div>`;
      } else if (afternoon && child && child.status === 'picked') {
        nextCard.innerHTML = `<div class="map-next-name">${icon('home')}Entrega em andamento</div><div class="map-next-addr">${esc(child.address)}, ${esc(child.number)} — ${esc(child.district)}</div><div class="map-next-meta"><span class="badge b-blue">${icon('clock')}A caminho de casa</span></div>`;
      } else if (afternoon && child && (child.status === 'waiting' || child.status === 'next')) {
        nextCard.innerHTML = `<div class="map-next-name">${icon('school')}Embarque na escola</div><div class="map-next-addr">${esc(child.school)}</div><div class="map-next-meta"><span class="badge b-gray">${icon('clock')}Aguardando confirmação do motorista</span></div>`;
      } else if (next) {
        nextCard.innerHTML = `<div class="map-next-name">${icon('nav')}${esc(next.name)}</div><div class="map-next-addr">${esc(next.address)}, ${esc(next.number)} — ${esc(next.district)}</div><div class="map-next-meta"><span class="badge b-blue">${icon('clock')}Próxima parada</span></div>`;
      } else {
        nextCard.innerHTML = `<div class="map-next-name">${icon('school')}${esc(child ? child.school : 'Escola')}</div><div class="map-next-addr">${esc(child ? 'Destino final da rota' : 'Aguardando rota')}</div>`;
      }
    }
    const mode = $('#gMapMode');
    if (mode) {
      mode.innerHTML = K.store.settings().demoMode
        ? `${icon('bolt')}Demonstração · posição simulada`
        : `${icon('locate')}Acompanhamento em tempo real`;
    }

    updateMap(data);
  }

  function mountHome(root) {
    const guardian = guardianSession();
    if (!guardian) {
      root.innerHTML = `<div class="panel"><div class="empty"><div class="empty-ico">${icon('alert')}</div><h4>Conta de responsável não encontrada</h4><p>Saia e entre novamente para recarregar a sessão.</p></div></div>`;
      return;
    }
    const child = childOf(guardian);
    root.innerHTML = homeHtml(guardian, child);
    initMap('gHomeMap');
    startLive(refreshHome);
  }

  function mapSideHtml(guardian, child, data) {
    const route = data.routeObj;
    const metrics = liveMetrics(data);
    const info = statusInfo(child, route);
    const driver = K.store.driver();
    const notifications = K.store.notificationsFor('guardian', guardian.id).filter((n) => !n.read);
    const next = data.students.find((s) => s.status === 'next');
    return `
      <section class="card guardian-status-card">
        <div class="row-between" style="align-items:flex-start">
          <div class="row" style="gap:10px;min-width:0">
            <div class="avatar photo">${esc(K.fmt.initials(child ? child.name : guardian.name))}</div>
            <div style="min-width:0">
              <div class="strong">${esc(child ? child.name : 'Aluno não vinculado')}</div>
              <div class="tiny muted">${child ? esc(child.school) : 'Sem vínculo'}</div>
            </div>
          </div>
          <span class="badge ${info.cls}">${icon(info.icon)}${info.label}</span>
        </div>
        <div class="guardian-mini-grid">
          <div><span>Próxima parada</span><b>${esc(next ? next.name : child && child.status === 'picked' ? 'Destino final' : 'Aguardando')}</b></div>
          <div><span>Previsão</span><b>${metrics.etaMin != null ? Math.ceil(metrics.etaMin) + ' min' : '—'}</b></div>
          <div><span>Distância</span><b>${K.fmt.distance(metrics.remaining)}</b></div>
          <div><span>Progresso</span><b>${metrics.progress}%</b></div>
        </div>
        <div class="progress" style="margin-top:14px"><div class="progress-fill ${metrics.progress >= 100 ? 'green' : ''}" style="width:${metrics.progress}%"></div></div>
      </section>

      <section class="card">
        <div class="row" style="gap:11px">
          <div class="avatar">${esc(K.fmt.initials(driver.name))}</div>
          <div class="grow" style="min-width:0">
            <div class="strong">${esc(driver.name)}</div>
            <div class="tiny muted">Motorista · ${esc(driver.van.model)} · ${esc(driver.van.plate)}</div>
          </div>
          <span class="badge b-green">${icon('shield')}Verificado</span>
        </div>
        <div class="row" style="gap:8px;margin-top:12px">
          <a class="btn btn-primary btn-sm" href="#/mensagens">${icon('message')}Conversar</a>
          <a class="btn btn-ghost btn-sm" href="#/notificacoes">${icon('bell')}Avisos${notifications.length ? ` · ${notifications.length}` : ''}</a>
        </div>
      </section>

      <section class="card">
        <div class="row-between"><div class="strong">Segurança e privacidade</div><span class="badge b-green">${icon('shield')}LGPD</span></div>
        <div class="notice neutral" style="margin-top:10px">${icon('info')}<div>Você vê apenas o trajeto, a van e o seu filho. Endereços de outros alunos não são exibidos.</div></div>
        <div class="tiny muted" style="margin-top:10px">${K.store.settings().demoMode ? 'Posição simulada para demonstração — não é GPS real.' : 'Posição atualizada pelo dispositivo do motorista.'}</div>
      </section>`;
  }

  function refreshMapPage() {
    if (!rootEl) return;
    const guardian = guardianSession();
    const child = childOf(guardian);
    const data = guardianMapData();
    const route = data.routeObj;
    const side = $('#gMapSide');
    if (side) side.innerHTML = mapSideHtml(guardian, child, data);
    const badge = $('#gMapBadge');
    if (badge) {
      const running = route && route.status === 'running';
      badge.className = 'badge ' + (running ? 'b-blue' : route && route.status === 'paused' ? 'b-amber' : 'b-gray');
      badge.innerHTML = running ? `<span class="live-dot"></span>Ao vivo` : route && route.status === 'paused' ? 'Pausada' : 'Aguardando';
    }
    const mode = $('#gMapMode2');
    if (mode) {
      mode.innerHTML = K.store.settings().demoMode
        ? `${icon('bolt')}Demonstração · posição simulada`
        : `${icon('locate')}Acompanhamento em tempo real`;
    }
    updateMap(data);
  }

  function mountMap(root) {
    const guardian = guardianSession();
    const child = childOf(guardian);
    root.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">${icon('locate')} Acompanhamento em tempo real</div>
          <h2 class="page-title">Rota do seu filho</h2>
          <p class="page-sub">${child ? `Acompanhe ${esc(K.fmt.firstName(child.name))}, a van e o próximo destino com segurança.` : 'Vincule seu filho para acompanhar a rota.'}</p>
        </div>
        <span class="badge b-gray" id="gMapBadge">Aguardando</span>
      </div>
      <div class="guardian-map-layout">
        <section class="panel map-card">
          <div class="map-head">
            <div class="map-head-left">
              <span class="stat-ico" style="width:36px;height:36px;border-radius:10px">${icon('map')}</span>
              <div>
                <div class="map-head-title">Mapa ao vivo <span class="badge b-green">${icon('shield')}Acesso restrito</span></div>
                <div class="map-head-sub">Somente seu filho, a van e a escola são exibidos</div>
              </div>
            </div>
            <button class="btn btn-soft btn-sm" data-center>${icon('crosshair')}Centralizar</button>
          </div>
          <div class="map-shell tall guardian-map-shell">
            <div class="map-box" id="gMap"></div>
            <div class="map-overlay tl"><span class="map-chip demo" id="gMapMode2">${icon('bolt')}Demonstração · posição simulada</span></div>
            <div class="map-overlay bl">
              <div class="map-legend">
                <span class="legend-item"><span class="legend-dot" style="background:#1265E8"></span>Seu filho</span>
                <span class="legend-item"><span class="legend-dot" style="background:#071629"></span>Escola</span>
                <span class="legend-item"><span class="legend-line" style="background:#1265E8"></span>Rota</span>
                <span class="legend-item"><span class="legend-line" style="background:#159B5B"></span>Percorrido</span>
              </div>
            </div>
          </div>
        </section>
        <aside class="stack" style="gap:14px" id="gMapSide"></aside>
      </div>`;
    initMap('gMap');
    startLive(refreshMapPage);
    const center = root.querySelector('[data-center]');
    if (center) center.addEventListener('click', () => { if (activeMap) activeMap.fitNow(); });
  }

  function openStudentModal(id) {
    const guardian = guardianSession();
    const child = childOf(guardian);
    if (!child || child.id !== id) return;
    const route = K.store.activeRoute();
    const info = statusInfo(child, route);
    K.modal({
      title: child.name,
      subtitle: 'Dados do aluno vinculado ao seu acesso',
      icon: 'users',
      size: 'sm',
      body: `
        <div class="stack" style="gap:12px">
          <div class="row-between"><span class="badge ${info.cls}">${icon(info.icon)}${info.label}</span><span class="badge b-gray">${esc(child.school)}</span></div>
          <div class="list-row"><div class="stat-ico">${icon('pin')}</div><div class="grow"><div class="list-title">Endereço residencial</div><div class="list-sub">${esc(K.store.fullAddress(child))}</div></div></div>
          <div class="list-row"><div class="stat-ico">${icon('phone')}</div><div class="grow"><div class="list-title">Telefone do responsável</div><div class="list-sub">${esc(K.fmt.phone(child.phone))}</div></div></div>
          ${child.note ? `<div class="notice neutral">${icon('info')}<div>${esc(child.note)}</div></div>` : ''}
          <div class="notice">${icon('shield')}<div>Estes dados são visíveis apenas para o responsável vinculado e para o motorista autorizado.</div></div>
        </div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Fechar</button><a class="btn btn-primary" href="#/mensagens" data-modal-close>${icon('message')}Falar com motorista</a>`
    });
  }

  /* ---------- Notificações ---------- */
  function notificationsHtml(guardian) {
    const all = K.store.notificationsFor('guardian', guardian.id);
    const unread = all.filter((n) => !n.read).length;
    const filters = [
      { key: 'all', label: 'Todas' },
      { key: 'school', label: 'Escola' },
      { key: 'home', label: 'Casa' },
      { key: 'route', label: 'Rota' },
      { key: 'hazard', label: 'Perigos' },
      { key: 'van', label: 'Van' },
      { key: 'message', label: 'Mensagens' }
    ];
    const list = notifFilter === 'all' ? all : all.filter((n) => n.type === notifFilter);
    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">${icon('bell')} Central de avisos</div>
          <h2 class="page-title">Notificações</h2>
          <p class="page-sub">Chegadas, mudanças de rota, perigos na via e novidades da van.</p>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn btn-ghost" data-mark-read>${icon('checkCircle')}Marcar lidas</button>
          <a class="btn btn-soft" href="#/perfil">${icon('settings')}Preferências</a>
        </div>
      </div>
      <div class="notif-toolbar">
        <div class="notif-filters">
          ${filters.map((f) => `<button class="filter-chip ${notifFilter === f.key ? 'active' : ''}" data-filter="${f.key}">${f.label}${f.key === 'all' && unread ? ` <b>${unread}</b>` : ''}</button>`).join('')}
        </div>
        <span class="tiny muted">${list.length} aviso(s)</span>
      </div>
      <div class="notif-list">
        ${list.length ? list.map((n) => {
          const m = notifMeta(n);
          return `
            <article class="card notif-card ${n.read ? '' : 'unread'}">
              <div class="stat-ico ${m.tone}">${icon(m.icon)}</div>
              <div class="grow" style="min-width:0">
                <div class="row-between" style="align-items:flex-start"><div class="strong">${esc(n.title)}</div>${n.read ? '' : '<span class="live-dot blue"></span>'}</div>
                <div class="small muted" style="margin-top:3px;white-space:normal">${esc(n.text)}</div>
                <div class="tiny muted" style="margin-top:8px">${m.label} · ${K.fmt.date(n.at)} · ${K.fmt.time(n.at)}</div>
              </div>
            </article>`;
        }).join('') : `<div class="card"><div class="empty"><div class="empty-ico">${icon('bell')}</div><h4>Nenhum aviso neste filtro</h4><p>Quando houver novidades sobre a rota, elas aparecerão aqui.</p></div></div>`}
      </div>
      <div class="notice neutral" style="margin-top:14px">${icon('shield')}<div><b>Privacidade.</b> A localização do seu filho é restrita ao seu acesso. Em produção, as notificações devem ser enviadas por push autenticado, com consentimento e opção de descadastro.</div></div>`;
  }

  function mountNotifs(root) {
    const guardian = guardianSession();
    root.innerHTML = notificationsHtml(guardian);
    root.addEventListener('click', (ev) => {
      const filter = ev.target.closest('[data-filter]');
      if (filter) {
        notifFilter = filter.getAttribute('data-filter');
        root.innerHTML = notificationsHtml(guardian);
        return;
      }
      if (ev.target.closest('[data-mark-read]')) {
        K.store.markNotificationsRead('guardian', guardian.id);
        root.innerHTML = notificationsHtml(guardian);
        document.dispatchEvent(new CustomEvent('kt:chrome'));
        K.toast('Notificações lidas', 'Sua central está em dia.', 'success');
      }
    });
  }

  /* ---------- Perfil do responsável ---------- */
  function prefRow(key, title, desc, prefs) {
    return `
      <label class="pref-row">
        <div class="grow"><div class="strong">${title}</div><div class="tiny muted">${desc}</div></div>
        <span class="switch"><input type="checkbox" data-pref="${key}" ${prefs[key] !== false ? 'checked' : ''}><span class="track"></span></span>
      </label>`;
  }

  function editGuardianModal(guardian) {
    K.modal({
      title: 'Editar meus dados',
      subtitle: 'Informações da conta da família',
      icon: 'user',
      size: 'sm',
      body: `
        <div class="stack" style="gap:12px">
          <div class="field"><label class="label" for="gName">Nome completo</label><input class="input" id="gName" value="${esc(guardian.name)}" maxlength="80"></div>
          <div class="field"><label class="label" for="gPhone">Telefone</label><input class="input" id="gPhone" value="${esc(guardian.phone)}" maxlength="20"></div>
          <div class="field"><label class="label" for="gRelation">Vínculo com o aluno</label><input class="input" id="gRelation" value="${esc(guardian.relation || 'Responsável')}" maxlength="30"></div>
          <div class="field"><label class="label">E-mail de acesso</label><input class="input" value="${esc(guardian.email)}" disabled></div>
          <div class="notice neutral">${icon('info')}<div>Para alterar o e-mail de acesso ou o vínculo com o aluno, fale com a coordenação da escola.</div></div>
        </div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="saveGuardian">${icon('check')}Salvar</button>`,
      onMount: (el, close) => {
        el.querySelector('#saveGuardian').addEventListener('click', () => {
          const name = el.querySelector('#gName').value.trim();
          const phone = el.querySelector('#gPhone').value.trim();
          if (!name) { K.toast('Informe seu nome', 'O nome não pode ficar vazio.', 'warn'); return; }
          K.store.updateGuardian(guardian.id, { name, phone, relation: el.querySelector('#gRelation').value.trim() || 'Responsável' });
          close();
          renderProfile();
          document.dispatchEvent(new CustomEvent('kt:chrome'));
          K.toast('Dados atualizados', 'Seu perfil foi salvo.', 'success');
        });
      }
    });
  }

  function passwordModal(guardian) {
    K.modal({
      title: 'Alterar senha',
      subtitle: 'Segurança da conta da família',
      icon: 'key',
      size: 'sm',
      body: `
        <div class="stack" style="gap:12px">
          <div class="field"><label class="label" for="gCur">Senha atual</label><input class="input" id="gCur" type="password" autocomplete="current-password"></div>
          <div class="field"><label class="label" for="gNew">Nova senha</label><input class="input" id="gNew" type="password" autocomplete="new-password" placeholder="Mínimo de 8 caracteres"></div>
          <div class="field"><label class="label" for="gNew2">Confirmar nova senha</label><input class="input" id="gNew2" type="password" autocomplete="new-password"></div>
          <div class="notice">${icon('shield')}<div>A senha é armazenada como hash SHA-256 nesta demonstração. Em produção, use bcrypt ou argon2 no servidor.</div></div>
        </div>`,
      footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="savePass">${icon('check')}Alterar senha</button>`,
      onMount: (el, close) => {
        el.querySelector('#savePass').addEventListener('click', async () => {
          const cur = el.querySelector('#gCur').value;
          const next = el.querySelector('#gNew').value;
          const next2 = el.querySelector('#gNew2').value;
          if (next !== next2) { K.toast('Senhas diferentes', 'A confirmação não confere com a nova senha.', 'warn'); return; }
          const result = await K.store.changeGuardianPassword(guardian.id, cur, next);
          if (!result.ok) { K.toast('Não foi possível alterar', result.error, 'warn'); return; }
          close();
          K.toast('Senha alterada', 'Use a nova senha no próximo acesso.', 'success');
        });
      }
    });
  }

  function profileHtml(guardian) {
    const child = childOf(guardian);
    const prefs = guardian.preferences || {};
    const notifications = K.store.notificationsFor('guardian', guardian.id);
    const unread = notifications.filter((n) => !n.read).length;
    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">${icon('user')} Conta da família</div>
          <h2 class="page-title">Perfil do responsável</h2>
          <p class="page-sub">Seus dados, vínculo com o aluno e preferências de acompanhamento.</p>
        </div>
        <button class="btn btn-soft" data-edit-profile>${icon('edit')}Editar dados</button>
      </div>

      <section class="profile-hero guardian-profile-hero">
        <div class="avatar xl photo">${esc(K.fmt.initials(guardian.name))}</div>
        <div class="grow">
          <div class="row" style="gap:8px;flex-wrap:wrap"><h3>${esc(guardian.name)}</h3><span class="badge b-green">${icon('shield')}Responsável verificado</span></div>
          <div class="small" style="color:#BBD2EC">${esc(guardian.email)} · ${esc(guardian.relation || 'Responsável')}</div>
          <div class="tiny" style="color:#8CA4C0">${child ? `Vinculado a ${esc(child.name)} · ${esc(child.school)}` : 'Nenhum aluno vinculado'}</div>
        </div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <a class="btn btn-soft btn-sm" href="#/mensagens">${icon('message')}Conversar</a>
          <a class="btn btn-ghost btn-sm" href="#/notificacoes" style="color:#DCE9FA">${icon('bell')}Avisos${unread ? ` · ${unread}` : ''}</a>
        </div>
      </section>

      <div class="profile-grid">
        <section class="card">
          <div class="row-between"><div class="strong">Meu filho</div><span class="badge b-blue">${icon('users')}Aluno</span></div>
          ${child ? `
            <div class="list-row" style="padding:12px 0"><div class="stat-ico blue">${icon('user')}</div><div class="grow"><div class="list-title">${esc(child.name)}</div><div class="list-sub">${esc(child.school)}</div></div></div>
            <div class="list-row" style="padding:12px 0"><div class="stat-ico">${icon('pin')}</div><div class="grow"><div class="list-title">Endereço residencial</div><div class="list-sub">${esc(K.store.fullAddress(child))}</div></div></div>
            <div class="list-row" style="padding:12px 0"><div class="stat-ico">${icon('phone')}</div><div class="grow"><div class="list-title">Telefone do responsável</div><div class="list-sub">${esc(K.fmt.phone(child.phone))}</div></div></div>
            <div class="row guardian-action-row" style="gap:8px;margin-top:8px"><a class="btn btn-soft btn-sm" href="#/mapa">${icon('map')}Ver no mapa</a><a class="btn btn-ghost btn-sm" href="#/mensagens">${icon('message')}Falar com motorista</a></div>
          ` : `<div class="empty" style="padding:24px 8px"><div class="empty-ico">${icon('alert')}</div><h4>Sem aluno vinculado</h4><p>Fale com o motorista ou a coordenação para vincular seu filho.</p></div>`}
          <div class="notice neutral" style="margin-top:10px">${icon('info')}<div>Para corrigir nome, endereço ou escola, fale com o motorista. Alterações são auditadas.</div></div>
        </section>

        <section class="card">
          <div class="row-between"><div class="strong">Preferências de notificação</div><span class="badge b-gray">${unread} não lida(s)</span></div>
          <div class="pref-list">
            ${prefRow('notifyHome', 'Chegada em casa', 'Avise quando meu filho chegar ao endereço residencial.', prefs)}
            ${prefRow('notifySchool', 'Chegada na escola', 'Avise quando meu filho chegar à escola.', prefs)}
            ${prefRow('notifyRoute', 'Mudanças de rota', 'Avise sobre ajustes de horário, paradas ou desvios.', prefs)}
            ${prefRow('notifyHazard', 'Perigos na estrada', 'Avise sobre obras, acidentes e riscos no trajeto.', prefs)}
            ${prefRow('notifyVan', 'Mudanças na van', 'Avise sobre troca de veículo ou manutenção.', prefs)}
            ${prefRow('notifyMessages', 'Mensagens do motorista', 'Avise quando o motorista enviar uma mensagem.', prefs)}
          </div>
          <div class="tiny muted" style="margin-top:10px">As preferências valem para este navegador. Em produção, devem ser sincronizadas com o servidor de notificações.</div>
        </section>

        <section class="card">
          <div class="row-between"><div class="strong">Segurança da conta</div><span class="badge b-green">${icon('shield')}Protegida</span></div>
          <div class="stack" style="gap:10px;margin-top:12px">
            <button class="btn btn-ghost btn-block" data-change-pass>${icon('key')}Alterar senha</button>
            <button class="btn btn-ghost btn-block" data-edit-profile>${icon('edit')}Editar meus dados</button>
            <button class="btn btn-outline-danger btn-block" data-logout>${icon('logout')}Sair da conta</button>
          </div>
          <div class="tiny muted" style="margin-top:10px">Sessão com expiração automática e bloqueio por inatividade. Em produção, use autenticação no servidor e HTTPS.</div>
        </section>

        <section class="card">
          <div class="row-between"><div class="strong">Privacidade e LGPD</div><span class="badge b-blue">${icon('shield')}Direitos</span></div>
          <div class="stack" style="gap:10px;margin-top:12px;font-size:12.5px;color:var(--ink-soft);line-height:1.6">
            <p style="margin:0">Você acessa apenas os dados do seu filho e a localização da van durante o trajeto. Endereços de outros alunos não são exibidos.</p>
            <p style="margin:0">Para solicitar acesso, correção, portabilidade ou exclusão, use o canal <b>privacidade@kombitech.app</b>. O pedido será registrado e respondido nos prazos da LGPD.</p>
          </div>
          <div class="notice" style="margin-top:12px">${icon('info')}<div><b>Demonstração.</b> Os dados são fictícios e ficam apenas neste navegador. Nada é enviado para servidores.</div></div>
        </section>
      </div>`;
  }

  function renderProfile() {
    if (!rootEl) return;
    const guardian = guardianSession();
    rootEl.innerHTML = profileHtml(guardian);
  }

  function mountProfile(root) {
    rootEl = root;
    renderProfile();
    root.addEventListener('click', (ev) => {
      const guardian = guardianSession();
      if (ev.target.closest('[data-edit-profile]')) { editGuardianModal(guardian); return; }
      if (ev.target.closest('[data-change-pass]')) { passwordModal(guardian); return; }
    });
    root.addEventListener('change', (ev) => {
      const input = ev.target.closest('[data-pref]');
      if (!input) return;
      const guardian = guardianSession();
      const key = input.getAttribute('data-pref');
      const prefs = Object.assign({}, guardian.preferences || {});
      prefs[key] = input.checked;
      K.store.updateGuardian(guardian.id, { preferences: prefs });
      K.toast('Preferência atualizada', 'As notificações foram ajustadas.', 'success');
    });
  }

  /* ---------- Registro das views ---------- */
  K.guardianViews = K.guardianViews || {};

  K.guardianViews.inicio = {
    mount(root) {
      rootEl = root;
      mountHome(root);
    },
    unmount() { stopLive(); rootEl = null; },
    onRoute() { if (rootEl) refreshHome(); }
  };

  K.guardianViews.mapa = {
    mount(root) {
      rootEl = root;
      mountMap(root);
    },
    unmount() { stopLive(); rootEl = null; },
    onRoute() { if (rootEl) refreshMapPage(); },
    onResize() { if (activeMap) activeMap.invalidate(); }
  };

  K.guardianViews.notificacoes = {
    mount(root) {
      rootEl = root;
      mountNotifs(root);
    },
    unmount() { rootEl = null; },
    onRoute() {}
  };

  K.guardianViews.perfil = {
    mount(root) {
      rootEl = root;
      mountProfile(root);
    },
    unmount() { rootEl = null; },
    onRoute() {}
  };

  K.guardianViews.mensagens = K.views.mensagens;
})(window.KT);
