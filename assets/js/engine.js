/* ==========================================================================
   KombiTech — Motor de rotas
   - Ordena paradas e calcula geometria (OSRM, com fallback)
   - Simulação de demonstração claramente identificada
   - Geolocalização real via navigator.geolocation
   - Atualização automática de status por proximidade
   ========================================================================== */
(function (K) {
  'use strict';

  const cfg = K.config;
  const listeners = new Set();

  const state = {
    active: false,
    paused: false,
    mode: 'demo',
    routeId: null,
    van: null,
    geometry: [],
    cum: [],
    total: 0,
    traveledMeters: 0,
    traveledIndex: 0,
    alongs: {},
    schoolAlong: 0,
    approx: false,
    startedAt: null,
    speedKmh: cfg.location.demoSpeedKmh,
    lastTick: 0,
    watchId: null,
    timer: null,
    picks: [],
    issues: [],
    drops: [],
    nearDropoffId: null,
    lastError: null,
    tickCount: 0
  };

  function emit(type) {
    const snapshot = getState();
    listeners.forEach((fn) => {
      try { fn(type, snapshot); } catch (e) { console.error('[KombiTech] listener error', e); }
    });
    document.dispatchEvent(new CustomEvent('kt:route', { detail: { type, state: snapshot } }));
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function settings() { return K.store.settings() || {}; }
  function activeRoute() { return K.store.activeRoute(); }
  function routeStudents() { return K.store.routeStudents(activeRoute()); }

  /* ---------- Geometria ---------- */
  function buildCum(coords) {
    const cum = [0];
    for (let i = 1; i < coords.length; i++) {
      cum[i] = cum[i - 1] + K.geo.haversine(coords[i - 1], coords[i]);
    }
    return cum;
  }

  function nearestIndex(point) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < state.geometry.length; i++) {
      const d = K.geo.haversine(point, state.geometry[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return { index: best, distance: bestD };
  }

  function rebuildAlongs() {
    state.alongs = {};
    routeStudents().forEach((s) => {
      if (s.lat == null) return;
      const near = nearestIndex(s);
      state.alongs[s.id] = state.cum[near.index] || 0;
    });
    const school = K.store.get().school;
    if (school) {
      const near = nearestIndex(school);
      state.schoolAlong = state.cum[near.index] || 0;
    }
  }

  function pointAt(distance) {
    const geo = state.geometry;
    if (!geo.length) return null;
    if (distance <= 0) return geo[0];
    if (distance >= state.total) return geo[geo.length - 1];
    let lo = 0, hi = state.cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (state.cum[mid] <= distance) lo = mid; else hi = mid;
    }
    const seg = state.cum[hi] - state.cum[lo] || 1;
    const t = (distance - state.cum[lo]) / seg;
    return K.geo.interpolate(geo[lo], geo[hi], t);
  }

  function traveledSlice() {
    if (!state.geometry.length) return [];
    const idx = Math.min(state.traveledIndex, state.geometry.length - 1);
    const pts = state.geometry.slice(0, idx + 1);
    if (state.van) pts.push({ lat: state.van.lat, lng: state.van.lng });
    return pts;
  }

  /* ---------- Alvo atual ---------- */
  function isAfternoon() {
    const route = activeRoute();
    return !!(route && route.shift === 'afternoon');
  }

  function isFinalStatus(status, afternoon) {
    if (afternoon) return status === 'delivered' || status === 'no_delivery' || status === 'issue';
    return status === 'picked' || status === 'issue';
  }

  /* Na rota da tarde o aluno embarcado continua pendente até a entrega ser
     confirmada pelo motorista. */
  function remainingStudents() {
    const afternoon = isAfternoon();
    return routeStudents().filter((s) => !isFinalStatus(s.status, afternoon));
  }

  function currentStudent() {
    const list = routeStudents();
    if (isAfternoon()) {
      const toBoard = list.find((s) => s.status === 'waiting' || s.status === 'next');
      if (toBoard) return toBoard;
      return list.find((s) => s.status === 'picked') || null;
    }
    return list.find((s) => s.status === 'next') || null;
  }

  function advanceTarget() {
    const list = routeStudents();
    const afternoon = isAfternoon();
    list.forEach((s) => { if (s.status === 'next') s.status = 'waiting'; });
    if (!afternoon) {
      const remaining = list.filter((s) => s.status === 'waiting');
      if (remaining.length) remaining[0].status = 'next';
    }
    K.store.save();
  }

  /* ---------- Persistência ---------- */
  function persistLive() {
    const db = K.store.get();
    if (!db) return;
    if (!state.active) { db.live = null; return; }
    db.live = {
      routeId: state.routeId,
      van: state.van,
      geometry: state.geometry.map((p) => ({ lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) })),
      approx: state.approx,
      traveledMeters: Math.round(state.traveledMeters),
      traveledIndex: state.traveledIndex,
      mode: state.mode,
      startedAt: state.startedAt,
      picks: state.picks,
      issues: state.issues,
      drops: state.drops,
      speedKmh: state.speedKmh
    };
    K.store.save();
  }

  /* ---------- Loop ---------- */
  function startLoop() {
    stopLoop();
    state.lastTick = Date.now();
    state.timer = setInterval(tick, 900);
  }

  function stopLoop() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  function tick() {
    if (!state.active || state.paused) return;
    const now = Date.now();
    const dt = Math.min((now - state.lastTick) / 1000, 3);
    state.lastTick = now;

    if (state.mode === 'demo') {
      const step = (state.speedKmh / 3.6) * dt * (cfg.location.demoTimeScale || 10);
      advanceAlong(step);
    } else {
      syncGpsProgress();
    }

    updateDerived();
    checkPickups();
    state.tickCount += 1;
    if (state.tickCount % 5 === 0) persistLive();
    emit('move');
  }

  function advanceAlong(meters) {
    if (!state.geometry.length) return;
    state.traveledMeters = Math.min(state.total, state.traveledMeters + meters);
    let idx = state.traveledIndex;
    while (idx < state.cum.length - 2 && state.cum[idx + 1] <= state.traveledMeters) idx += 1;
    state.traveledIndex = idx;
    state.van = pointAt(state.traveledMeters);
  }

  function syncGpsProgress() {
    if (!state.van || !state.geometry.length) return;
    const near = nearestIndex(state.van);
    if (near.index >= state.traveledIndex) {
      state.traveledIndex = near.index;
      state.traveledMeters = Math.max(state.traveledMeters, state.cum[near.index] || 0);
    }
  }

  function updateDerived() {
    state.progress = state.total ? Math.min(100, (state.traveledMeters / state.total) * 100) : 0;
    state.remainingMeters = Math.max(0, state.total - state.traveledMeters);
    state.etaMin = state.speedKmh > 0 ? state.remainingMeters / (state.speedKmh / 3.6) / 60 : null;
  }

  /* ---------- Coleta / entrega ---------- */
  function checkPickups() {
    if (state.paused) return;
    const threshold = Number(settings().proximity) || cfg.defaults.proximityMeters;

    /* Rota da tarde: a proximidade apenas sugere a chegada. Embarque e
       entrega só mudam de status por confirmação explícita do motorista. */
    if (isAfternoon()) {
      suggestDropOff(threshold);
      return;
    }

    const target = currentStudent();
    if (!target) {
      checkSchoolArrival(threshold);
      return;
    }

    let reached = false;
    if (state.mode === 'demo') {
      const along = state.alongs[target.id];
      reached = typeof along === 'number' && state.traveledMeters >= along - threshold;
    } else if (state.van) {
      reached = K.geo.haversine(state.van, target) <= threshold;
    }

    if (reached) pick(target.id, false);
  }

  function suggestDropOff(threshold) {
    const pending = routeStudents().filter((s) => s.status === 'picked' && s.lat != null);
    let near = null;
    if (state.mode === 'demo') {
      near = pending.find((s) => {
        const along = state.alongs[s.id];
        return typeof along === 'number' && state.traveledMeters >= along - threshold;
      }) || null;
    } else if (state.van) {
      near = pending.find((s) => K.geo.haversine(state.van, s) <= threshold) || null;
    }
    const nearId = near ? near.id : null;
    if (nearId && nearId !== state.nearDropoffId) {
      state.nearDropoffId = nearId;
      K.toast('Chegando ao destino', `${near.name} · confirme a entrega no painel do motorista.`, 'info', { ttl: 6000 });
    }
    if (!nearId) state.nearDropoffId = null;
  }

  function checkSchoolArrival(threshold) {
    if (isAfternoon()) return;
    if (!settings().autoFinish) return;
    if (remainingStudents().length) return;
    if (!state.van) return;
    let reached = false;
    if (state.mode === 'demo') {
      reached = state.traveledMeters >= state.schoolAlong - threshold;
    } else {
      const school = K.store.get().school;
      reached = school ? K.geo.haversine(state.van, school) <= threshold : false;
    }
    if (reached) finish('auto');
  }

  function pick(studentId, manual) {
    const s = K.store.student(studentId);
    if (!s || s.status === 'picked') return false;
    if (s.status === 'delivered' || s.status === 'no_delivery') return false;
    if (isAfternoon() && s.status !== 'waiting' && s.status !== 'next') return false;
    K.store.setStatus(studentId, 'picked');
    const at = new Date().toISOString();
    const entry = { id: s.id, name: s.name, at, manual: !!manual };
    state.picks = state.picks.filter((p) => p.id !== studentId).concat(entry);
    advanceTarget();
    persistLive();
    emit('status');
    K.toast(
      manual ? 'Embarque confirmado' : 'Aluno pego automaticamente',
      `${s.name} · ${K.fmt.time(at)}`,
      'success'
    );
    const afternoon = isAfternoon();
    const school = K.store.get().school;
    K.store.notifyGuardianForStudent(
      s.id,
      'boarding',
      `${String(s.name).split(' ')[0]} embarcou`,
      afternoon
        ? `${s.name} embarcou na ${school ? school.name : 'escola'} às ${K.fmt.time(at)}. Acompanhe a entrega na residência.`
        : `${s.name} embarcou às ${K.fmt.time(at)} na ${s.address}, ${s.number}.`
    );
    if (!remainingStudents().length) {
      emit('all-picked');
      K.toast(
        afternoon ? 'Todos os alunos a bordo' : 'Todos os alunos a bordo',
        afternoon
          ? 'Siga para as residências e confirme cada entrega.'
          : `Seguindo para ${school ? school.name : 'a escola'}.`,
        'info'
      );
    }
    return true;
  }

  function confirmDropOff(studentId) {
    const s = K.store.student(studentId);
    if (!s) return false;
    if (!isAfternoon()) {
      K.toast('Ação da rota da tarde', 'A entrega na residência só existe no trajeto escola → casa.', 'info');
      return false;
    }
    if (s.status !== 'picked') {
      K.toast('Embarque não registrado', 'Não é possível confirmar a entrega sem o embarque registrado.', 'error');
      return false;
    }
    K.store.setStatus(studentId, 'delivered');
    const at = new Date().toISOString();
    state.drops = (state.drops || []).filter((d) => d.id !== studentId).concat({ id: s.id, name: s.name, at });
    persistLive();
    emit('status');
    K.toast('Entrega confirmada', `${s.name} entregue na residência · ${K.fmt.time(at)}`, 'success');
    K.store.notifyGuardianForStudent(
      s.id,
      'home',
      `${String(s.name).split(' ')[0]} chegou em casa`,
      `${s.name} foi entregue na residência às ${K.fmt.time(at)}.`
    );
    return true;
  }

  function failDelivery(studentId) {
    const s = K.store.student(studentId);
    if (!s) return false;
    if (!isAfternoon()) {
      K.toast('Ação da rota da tarde', 'A entrega na residência só existe no trajeto escola → casa.', 'info');
      return false;
    }
    if (s.status !== 'picked') {
      K.toast('Embarque não registrado', 'Só é possível registrar falha de entrega para um aluno embarcado.', 'error');
      return false;
    }
    K.store.setStatus(studentId, 'no_delivery');
    const at = new Date().toISOString();
    state.drops = (state.drops || []).filter((d) => d.id !== studentId).concat({ id: s.id, name: s.name, at, failed: true });
    persistLive();
    emit('status');
    K.toast('Entrega não realizada', `${s.name} · ocorrência registrada.`, 'warn');
    K.store.notifyGuardianForStudent(
      s.id,
      'no_delivery',
      `${String(s.name).split(' ')[0]}: entrega não realizada`,
      `O motorista não conseguiu entregar ${s.name} na residência às ${K.fmt.time(at)}. Entre em contato para alinhar o que fazer.`
    );
    return true;
  }

  /* ---------- GPS ---------- */
  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocalização não suportada neste navegador.')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        (err) => reject(err),
        { enableHighAccuracy: cfg.location.gpsHighAccuracy, timeout: cfg.location.gpsTimeoutMs, maximumAge: cfg.location.gpsMaxAgeMs }
      );
    });
  }

  function startWatch() {
    if (!navigator.geolocation) return;
    if (state.watchId != null) navigator.geolocation.clearWatch(state.watchId);
    state.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        state.van = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        syncGpsProgress();
        updateDerived();
        if (!state.paused) checkPickups();
        emit('move');
      },
      (err) => {
        if (state.lastError !== err.code) {
          state.lastError = err.code;
          K.toast('Sinal de GPS instável', 'Verifique a permissão de localização. Você pode confirmar embarques manualmente.', 'warn');
        }
      },
      { enableHighAccuracy: cfg.location.gpsHighAccuracy, timeout: cfg.location.gpsTimeoutMs, maximumAge: cfg.location.gpsMaxAgeMs }
    );
  }

  function stopWatch() {
    if (state.watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(state.watchId);
    }
    state.watchId = null;
  }

  /* ---------- Ações públicas ---------- */
  async function start() {
    await K.store.ready();
    if (state.active) {
      if (state.paused) return resume();
      K.toast('Rota em andamento', 'Pause ou finalize a rota atual antes de iniciar outra.', 'warn');
      return { ok: false, reason: 'running' };
    }
    const route = activeRoute();
    if (!route) { K.toast('Nenhuma rota ativa', 'Selecione uma rota antes de iniciar.', 'error'); return { ok: false }; }
    const list = routeStudents();
    if (!list.length) { K.toast('Rota sem alunos', 'Cadastre alunos e adicione-os à rota.', 'error'); return { ok: false }; }

    const afternoon = route.shift === 'afternoon';
    const s = settings();
    const mode = s.demoMode ? 'demo' : 'gps';
    const school = K.store.get().school;
    let origin = null;

    if (mode === 'demo') {
      origin = afternoon && school
        ? { lat: school.lat, lng: school.lng }
        : K.store.driver().base;
    } else {
      try {
        origin = await getPosition();
        K.toast('GPS conectado', `Precisão de ${Math.round(origin.accuracy || 0)} m.`, 'success');
      } catch (err) {
        K.toast('GPS indisponível', 'Permita o acesso à localização ou ative o modo de demonstração nas configurações.', 'error', { ttl: 7000 });
        return { ok: false, reason: 'gps' };
      }
    }

    K.store.clearTripStamps(route);
    list.forEach((st) => { st.status = 'waiting'; });
    if (!afternoon) list[0].status = 'next';
    K.store.save();

    const stops = list.map((st) => ({ lat: st.lat, lng: st.lng })).filter((p) => p.lat != null);
    const points = [origin].concat(stops);
    if (!afternoon && school) points.push({ lat: school.lat, lng: school.lng });

    const result = await K.services.fetchRoute(points);
    state.active = true;
    state.paused = false;
    state.mode = mode;
    state.routeId = route.id;
    state.geometry = result.coords;
    state.cum = buildCum(state.geometry);
    state.total = state.cum[state.cum.length - 1] || 0;
    state.traveledMeters = 0;
    state.traveledIndex = 0;
    state.van = state.geometry[0] || origin;
    state.approx = !!result.approx;
    state.startedAt = new Date().toISOString();
    state.picks = [];
    state.issues = [];
    state.drops = [];
    state.nearDropoffId = null;
    state.speedKmh = cfg.location.demoSpeedKmh;
    state.tickCount = 0;
    state.progress = 0;
    state.remainingMeters = state.total;
    state.etaMin = state.total / (state.speedKmh / 3.6) / 60;
    rebuildAlongs();

    route.status = 'running';
    route.startedAt = state.startedAt;
    route.finishedAt = null;
    K.store.save();
    persistLive();

    if (mode === 'demo') startLoop();
    else { startWatch(); startLoop(); }

    emit('start');
    if (afternoon) {
      K.toast(
        'Rota da tarde iniciada',
        'Confirme o embarque de cada aluno na escola e, depois, a entrega em cada residência.',
        mode === 'demo' ? 'warn' : 'success',
        { ttl: 6500 }
      );
    } else {
      K.toast(
        mode === 'demo' ? 'Rota iniciada · demonstração' : 'Rota iniciada com GPS',
        mode === 'demo'
          ? 'Localização simulada. Acompanhe o trajeto no mapa.'
          : 'A localização real da perua será usada para confirmar embarques.',
        mode === 'demo' ? 'warn' : 'success',
        { ttl: 5200 }
      );
    }
    if (result.approx) {
      K.toast('Rota aproximada', 'Não foi possível calcular o trajeto pelas ruas. Exibindo linha direta entre as paradas.', 'info', { ttl: 6000 });
    }
    return { ok: true };
  }

  function pause() {
    if (!state.active || state.paused) return;
    state.paused = true;
    const route = activeRoute();
    if (route) route.status = 'paused';
    K.store.save();
    persistLive();
    emit('pause');
    K.toast('Rota pausada', 'Os embarques automáticos estão suspensos.', 'warn');
  }

  function resume() {
    if (!state.active) return restore().then((ok) => (ok ? resume() : start()));
    if (!state.paused) return;
    state.paused = false;
    const route = activeRoute();
    if (route) route.status = 'running';
    K.store.save();
    state.lastTick = Date.now();
    startLoop();
    emit('resume');
    K.toast('Rota retomada', 'Acompanhamento reativado.', 'success');
  }

  function confirmPick() {
    const target = currentStudent();
    if (!target) {
      K.toast(
        isAfternoon() ? 'Nenhuma entrega pendente' : 'Nenhum aluno pendente',
        isAfternoon() ? 'Todas as entregas já foram confirmadas. Finalize a rota.' : 'Todos os alunos já foram confirmados. Siga para a escola.',
        'info'
      );
      return false;
    }
    if (isAfternoon() && target.status === 'picked') {
      K.toast('Aluno já embarcado', `Use "Confirmar entrega" para registrar a chegada de ${target.name} em casa.`, 'info');
      return false;
    }
    return pick(target.id, true);
  }

  function boardStudent(studentId) {
    return pick(studentId, true);
  }

  function skipCurrent() {
    const target = currentStudent();
    if (!target) return false;
    const afternoon = isAfternoon();
    if (afternoon && target.status === 'picked') return failDelivery(target.id);
    if (afternoon && target.status !== 'waiting' && target.status !== 'next') return false;
    K.store.setStatus(target.id, 'issue');
    state.issues = state.issues.filter((i) => i.id !== target.id).concat({ id: target.id, name: target.name, at: new Date().toISOString() });
    advanceTarget();
    persistLive();
    emit('status');
    K.toast(
      afternoon ? 'Não embarcou' : 'Coleta não realizada',
      afternoon ? `${target.name} não embarcou na van.` : `${target.name} marcado com problema na coleta.`,
      'warn'
    );
    K.store.notifyGuardianForStudent(
      target.id,
      'issue',
      afternoon
        ? `${String(target.name).split(' ')[0]} não embarcou`
        : `Ocorrência na coleta de ${String(target.name).split(' ')[0]}`,
      afternoon
        ? `${target.name} não embarcou na van da escola. Entre em contato com o motorista para alinhar o ocorrido.`
        : `O motorista não localizou ${target.name} no ponto combinado. Entre em contato para alinhar a próxima tentativa.`
    );
    return true;
  }

  function finish(by) {
    if (!state.active) return false;
    const route = activeRoute();
    const list = routeStudents();
    const afternoon = !!(route && route.shift === 'afternoon');
    const pending = list.filter((s) => !isFinalStatus(s.status, afternoon));
    if (afternoon && pending.length) {
      K.toast(
        'Ainda há entregas pendentes',
        `${pending.length} aluno(s) sem status final. Confirme a entrega ou registre a ocorrência antes de finalizar.`,
        'error',
        { ttl: 7000 }
      );
      return false;
    }

    stopLoop();
    stopWatch();
    const boarded = list.filter((s) => s.status === 'picked' || s.status === 'delivered' || s.status === 'no_delivery');
    const delivered = list.filter((s) => s.status === 'delivered');
    const noDelivery = list.filter((s) => s.status === 'no_delivery');
    const issues = list.filter((s) => s.status === 'issue');
    const started = new Date(state.startedAt || Date.now());
    const distanceKm = +(state.traveledMeters / 1000).toFixed(2);
    const estimatedMin = Math.max(1, Math.round((state.traveledMeters / (state.speedKmh / 3.6)) / 60));
    const elapsedMin = Math.max(1, Math.round((Date.now() - started.getTime()) / 60000));
    const durationMin = state.mode === 'demo' ? estimatedMin : elapsedMin;
    const finishedAt = state.mode === 'demo'
      ? new Date(started.getTime() + durationMin * 60000)
      : new Date();

    if (route) {
      route.status = 'done';
      route.finishedAt = finishedAt.toISOString();
      route.startedAt = started.toISOString();
      route.distanceKm = distanceKm;
    }

    K.store.addHistory({
      routeId: route ? route.id : state.routeId,
      routeName: route ? route.name : 'Rota',
      shift: afternoon ? 'afternoon' : 'morning',
      date: K.store.isoDay(started),
      startedAt: started.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMin,
      distanceKm,
      total: list.length,
      picked: afternoon ? boarded.length : boarded.length,
      delivered: delivered.length,
      noDelivery: noDelivery.length,
      issues: issues.length,
      stops: (afternoon ? boarded : list.filter((s) => s.status === 'picked')).map((s) => {
        const p = state.picks.find((x) => x.id === s.id);
        const d = (state.drops || []).find((x) => x.id === s.id);
        return {
          id: s.id,
          name: s.name,
          status: s.status,
          pickedAt: p ? p.at : s.boardedAt || null,
          deliveredAt: d ? d.at : s.deliveredAt || null,
          manual: p ? p.manual : false
        };
      }),
      simulated: state.mode === 'demo',
      finishedBy: by || 'manual'
    });

    /* Avisa os responsáveis sobre o destino final. Na rota da tarde cada
       entrega já foi notificada individualmente; evita aviso duplicado. */
    if (!afternoon) {
      K.store.notifyGuardiansRouteFinished(
        route,
        list.filter((s) => s.status === 'picked'),
        'school'
      );
    }

    state.active = false;
    state.paused = false;
    state.progress = 100;
    state.van = null;
    state.nearDropoffId = null;
    persistLive();
    K.store.save();
    emit('finish');

    K.toast(
      'Rota finalizada',
      afternoon
        ? `${delivered.length} entrega(s) confirmada(s) · ${noDelivery.length + issues.length} ocorrência(s) · ${K.fmt.km(distanceKm)}`
        : `${boarded.length} de ${list.length} alunos transportados · ${K.fmt.km(distanceKm)}`,
      'success',
      { ttl: 6000 }
    );
    if (issues.length || noDelivery.length) {
      K.toast(
        'Ocorrências registradas',
        afternoon
          ? `${issues.length} aluno(s) não embarcaram · ${noDelivery.length} entrega(s) não realizada(s).`
          : `${issues.length} aluno(s) com problema na coleta.`,
        'warn'
      );
    }
    return true;
  }

  async function restore() {
    await K.store.ready();
    if (state.active) return true;
    const db = K.store.get();
    const live = db && db.live;
    if (!live) return false;
    const route = K.store.route(live.routeId);
    if (!route) return false;
    if (route.status !== 'running' && route.status !== 'paused') return false;
    if (!live.geometry || live.geometry.length < 2) return false;

    state.active = true;
    state.paused = true;
    state.mode = live.mode || 'demo';
    state.routeId = live.routeId;
    state.geometry = live.geometry;
    state.cum = buildCum(state.geometry);
    state.total = state.cum[state.cum.length - 1] || 0;
    state.traveledMeters = live.traveledMeters || 0;
    state.traveledIndex = live.traveledIndex || 0;
    state.van = live.van || pointAt(state.traveledMeters);
    state.approx = !!live.approx;
    state.startedAt = live.startedAt;
    state.picks = live.picks || [];
    state.issues = live.issues || [];
    state.drops = live.drops || [];
    state.speedKmh = live.speedKmh || cfg.location.demoSpeedKmh;
    rebuildAlongs();
    updateDerived();
    route.status = 'paused';
    K.store.save();
    emit('restore');
    return true;
  }

  function reset() {
    stopLoop();
    stopWatch();
    const route = activeRoute();
    const afternoon = !!(route && route.shift === 'afternoon');
    if (route) {
      route.status = 'idle';
      route.startedAt = null;
      route.finishedAt = null;
      route.distanceKm = 0;
      K.store.clearTripStamps(route);
      const list = routeStudents();
      list.forEach((s, i) => { s.status = !afternoon && i === 0 ? 'next' : 'waiting'; });
    }
    state.active = false;
    state.paused = false;
    state.van = null;
    state.geometry = [];
    state.cum = [];
    state.total = 0;
    state.traveledMeters = 0;
    state.traveledIndex = 0;
    state.progress = 0;
    state.picks = [];
    state.issues = [];
    state.drops = [];
    state.nearDropoffId = null;
    const db = K.store.get();
    if (db) db.live = null;
    K.store.save();
    emit('reset');
  }

  function getState() {
    const route = activeRoute();
    const list = routeStudents();
    const afternoon = !!(route && route.shift === 'afternoon');
    const picked = list.filter((s) => s.status === 'picked').length;
    const delivered = list.filter((s) => s.status === 'delivered').length;
    const noDelivery = list.filter((s) => s.status === 'no_delivery').length;
    const issues = list.filter((s) => s.status === 'issue').length;
    const waiting = list.filter((s) => s.status === 'waiting' || s.status === 'next').length;
    const target = currentStudent();
    const school = K.store.get() ? K.store.get().school : null;
    const done = afternoon ? delivered + noDelivery + issues : picked + issues;
    const allBoarded = !list.some((s) => s.status === 'waiting' || s.status === 'next');
    const allFinal = !remainingStudents().length;
    const allPicked = afternoon ? allBoarded : allFinal;
    return {
      active: state.active,
      paused: state.paused,
      mode: state.mode,
      shift: afternoon ? 'afternoon' : 'morning',
      routeId: state.routeId,
      route,
      van: state.van,
      geometry: state.geometry,
      traveled: traveledSlice(),
      traveledMeters: state.traveledMeters,
      totalMeters: state.total,
      progress: state.progress || 0,
      etaMin: state.etaMin,
      remainingMeters: state.remainingMeters,
      approx: state.approx,
      startedAt: state.startedAt,
      picks: state.picks.slice(),
      issues: state.issues.slice(),
      drops: (state.drops || []).slice(),
      next: target,
      allPicked,
      allBoarded,
      allFinal,
      school,
      stats: {
        total: list.length,
        picked,
        delivered,
        noDelivery,
        waiting,
        issues,
        onboard: picked,
        done,
        pendingDelivery: picked,
        progress: list.length ? Math.round((done / list.length) * 100) : 0
      }
    };
  }

  function mapData() {
    const s = getState();
    return {
      students: routeStudents(),
      school: s.school,
      van: s.van,
      route: s.geometry,
      traveled: s.traveled,
      nextId: s.next ? s.next.id : null,
      routeApprox: s.approx
    };
  }

  async function locate() {
    try {
      const pos = await getPosition();
      return pos;
    } catch (err) {
      K.toast('Localização indisponível', 'Permita o acesso ao GPS no navegador para usar este recurso.', 'warn');
      return null;
    }
  }

  K.engine = {
    subscribe, start, pause, resume, finish, confirmPick, skipCurrent, reset, restore,
    confirmDropOff, failDelivery, boardStudent,
    getState, mapData, locate, getPosition,
    isActive: () => state.active,
    isPaused: () => state.paused
  };
})(window.KT);
