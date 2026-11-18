/* ==========================================================================
   KombiTech — Camada de dados (localStorage)
   Em produção, substitua esta camada por chamadas autenticadas a uma API.
   A interface pública (KT.store.*) foi pensada para facilitar essa troca.
   ========================================================================== */
(function (K) {
  'use strict';

  const cfg = K.config;
  const DB_KEY = 'kombitech.db.v1';
  const SESSION_KEY = 'kombitech.session.v1';
  const ACTIVITY_KEY = 'kombitech.lastActivity.v1';
  const DB_VERSION = 2;

  let db = null;
  let readyPromise = null;

  const { storageGet, storageSet, storageRemove, hashPassword, uid } = K.util;

  /* ---------- Datas auxiliares ---------- */
  function atTime(date, h, m) {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
  }
  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }
  function isoDay(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  }

  /* ---------- Códigos de ativação / recuperação ---------- */
  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeCode(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  /* Código individual de uso único. Em produção ele deve ser enviado por
     e-mail/SMS e armazenado apenas como hash no servidor. */
  function generateActivationCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const block = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    return `KT-${block()}-${block()}`;
  }

  function generateRecoveryCode() {
    return 'KT-R-' + String(Math.floor(100000 + Math.random() * 900000));
  }

  /* ---------- Seed ---------- */
  const STUDENTS_SEED = [
    { name: 'Ana Beatriz Souza', address: 'Rua das Palmeiras', number: '128', district: 'Vila Clementino', city: 'São Paulo', school: 'EMEF Jardim das Acácias', guardian: 'Mariana Souza', phone: '(11) 98765-4321', lat: -23.5942, lng: -46.6372, note: 'Portão azul, lado direito da rua.' },
    { name: 'Lucas Ferreira Lima', address: 'Avenida Onze de Junho', number: '452', district: 'Vila Clementino', city: 'São Paulo', school: 'EMEF Jardim das Acácias', guardian: 'Patrícia Lima', phone: '(11) 97654-1122', lat: -23.5901, lng: -46.6401, note: '' },
    { name: 'Sofia Almeida Rocha', address: 'Rua Loefgren', number: '890', district: 'Vila Mariana', city: 'São Paulo', school: 'EMEF Jardim das Acácias', guardian: 'Rafael Rocha', phone: '(11) 96543-7788', lat: -23.5883, lng: -46.6352, note: 'Aguardar na portaria do prédio.' },
    { name: 'Miguel Santos Oliveira', address: 'Rua Domingos de Morais', number: '1340', district: 'Vila Mariana', city: 'São Paulo', school: 'EMEF Jardim das Acácias', guardian: 'Denise Oliveira', phone: '(11) 95432-9900', lat: -23.5918, lng: -46.6324, note: 'Cadeirante — usar rampa de acesso.' },
    { name: 'Heloísa Castro', address: 'Rua Joaquim Távora', number: '210', district: 'Vila Mariana', city: 'São Paulo', school: 'EMEF Jardim das Acácias', guardian: 'Bruno Castro', phone: '(11) 94321-6655', lat: -23.5856, lng: -46.6312, note: '' },
    { name: 'Pedro Henrique Nunes', address: 'Rua Sena Madureira', number: '75', district: 'Ipiranga', city: 'São Paulo', school: 'EMEF Jardim das Acácias', guardian: 'Camila Nunes', phone: '(11) 93210-4433', lat: -23.5902, lng: -46.6266, note: 'Tia busca em caso de ausência dos pais.' },
    { name: 'Laura Martins Dias', address: 'Rua Silva Bueno', number: '620', district: 'Ipiranga', city: 'São Paulo', school: 'EMEF Jardim das Acácias', guardian: 'Eduardo Dias', phone: '(11) 92109-3322', lat: -23.5947, lng: -46.6228, note: '' },
    { name: 'Gabriel Ribeiro', address: 'Rua Vergueiro', number: '2100', district: 'Vila Mariana', city: 'São Paulo', school: 'EMEF Jardim das Acácias', guardian: 'Simone Ribeiro', phone: '(11) 91098-2211', lat: -23.5872, lng: -46.6281, note: 'Alergia a amendoim — informar escola.' }
  ];

  const HISTORY_SEED = [
    { offset: 1, start: [7, 4], end: [7, 46], km: 14.2, total: 8, picked: 8, issues: 0 },
    { offset: 2, start: [7, 1], end: [7, 39], km: 13.6, total: 8, picked: 8, issues: 0 },
    { offset: 3, start: [7, 8], end: [7, 57], km: 15.1, total: 8, picked: 7, issues: 1 },
    { offset: 4, start: [7, 2], end: [7, 41], km: 13.9, total: 8, picked: 8, issues: 0 },
    { offset: 5, start: [7, 5], end: [7, 48], km: 14.4, total: 7, picked: 7, issues: 0 },
    { offset: 6, start: [7, 0], end: [7, 35], km: 13.2, total: 8, picked: 8, issues: 0 }
  ];

  const GUARDIANS_SEED = [
    { id: 'gua_1', name: 'Mariana Souza', email: cfg.security.guardianDemoCredentials.email, phone: '(11) 98765-4321', relation: 'Mãe', studentIds: ['stu_1'] },
    { id: 'gua_2', name: 'Patrícia Lima', email: 'patricia.lima@kombitech.app', phone: '(11) 97654-1122', relation: 'Mãe', studentIds: ['stu_2'] },
    { id: 'gua_3', name: 'Camila Nunes', email: 'camila.nunes@kombitech.app', phone: '(11) 93210-4433', relation: 'Mãe', studentIds: ['stu_6'] },
    /* Conta de demonstração para o fluxo de primeiro acesso: ainda sem senha,
       com código individual de ativação exibido ao motorista. */
    { id: 'gua_4', name: 'Rafael Rocha', email: 'rafael.rocha@kombitech.app', phone: '(11) 96543-7788', relation: 'Pai', studentIds: ['stu_3'], pendingActivation: true }
  ];

  const TRAFFIC_SEED = [
    { id: 'trf_1', title: 'Obra na Rua Loefgren', area: 'Vila Mariana', severity: 'high', delayMin: 12, description: 'Interdição parcial com desvio pela Rua Sena Madureira. Evite a faixa da direita.', lat: -23.5883, lng: -46.6352, active: true },
    { id: 'trf_2', title: 'Congestionamento na Av. Onze de Junho', area: 'Vila Clementino', severity: 'medium', delayMin: 8, description: 'Trânsito lento no sentido centro por excesso de veículos.', lat: -23.5901, lng: -46.6401, active: true },
    { id: 'trf_3', title: 'Semáforo intermitente', area: 'Rua Domingos de Morais', severity: 'low', delayMin: 4, description: 'Semáforo em amarelo intermitente. Reduza a velocidade no cruzamento.', lat: -23.5918, lng: -46.6324, active: true }
  ];

  async function buildSeed() {
    const today = new Date();
    const students = STUDENTS_SEED.map((s, i) => ({
      id: 'stu_' + (i + 1),
      name: s.name,
      address: s.address,
      number: s.number,
      district: s.district,
      city: s.city,
      school: s.school,
      guardian: s.guardian,
      phone: s.phone,
      lat: s.lat,
      lng: s.lng,
      note: s.note,
      status: 'waiting',
      geoApprox: false,
      createdAt: daysAgo(30 + i).toISOString(),
      consent: { granted: true, at: daysAgo(30 + i).toISOString() }
    }));

    const morningIds = students.map((s) => s.id);
    const afternoonIds = ['stu_1', 'stu_3', 'stu_4', 'stu_5', 'stu_6', 'stu_8'];

    /* Responsáveis e comunicação */
    const guardians = [];
    for (let i = 0; i < GUARDIANS_SEED.length; i++) {
      const g = GUARDIANS_SEED[i];
      const pending = !!g.pendingActivation;
      guardians.push({
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        relation: g.relation,
        studentIds: g.studentIds.slice(),
        auth: pending
          ? { hash: null, active: false, updatedAt: null }
          : {
              hash: await hashPassword(cfg.security.guardianDemoCredentials.password),
              active: true,
              updatedAt: new Date().toISOString()
            },
        activation: pending
          ? {
              code: 'KT-SOFIA-4821',
              expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
              usedAt: null,
              createdAt: new Date().toISOString()
            }
          : { code: null, expiresAt: null, usedAt: null },
        recovery: null,
        preferences: {
          notifyHome: true,
          notifySchool: true,
          notifyRoute: true,
          notifyHazard: true,
          notifyVan: true,
          notifyMessages: true
        },
        createdAt: daysAgo(60 + i).toISOString()
      });
    }

    const nowMs = Date.now();
    const ago = (minutes) => new Date(nowMs - minutes * 60000).toISOString();
    const conversations = guardians.map((g, i) => ({
      id: 'conv_' + (i + 1),
      guardianId: g.id,
      studentId: g.studentIds[0],
      updatedAt: ago([4, 35, 90][i] || 120),
      unreadDriver: i === 0 || i === 2 ? 1 : 0,
      unreadGuardian: 0
    }));

    const messages = [
      { id: 'msg_1', conversationId: 'conv_1', from: 'driver', text: 'Bom dia, Mariana! A Ana Beatriz embarcou às 06:52. Previsão de chegada à escola: 07:28.', at: ago(240), readByDriver: true, readByGuardian: true },
      { id: 'msg_2', conversationId: 'conv_1', from: 'guardian', text: 'Bom dia, Carlos! Obrigada pelo aviso. Ela levou a mochila com o lanche e a garrafinha.', at: ago(210), readByDriver: true, readByGuardian: true },
      { id: 'msg_3', conversationId: 'conv_1', from: 'driver', text: 'Perfeito. Qualquer imprevisto no trajeto eu aviso por aqui.', at: ago(180), readByDriver: true, readByGuardian: true },
      { id: 'msg_4', conversationId: 'conv_1', from: 'guardian', text: 'Combinado! Hoje ela sai um pouco mais cedo, às 17h. Consegue confirmar quando estiver chegando?', at: ago(4), readByDriver: false, readByGuardian: true },
      { id: 'msg_5', conversationId: 'conv_2', from: 'guardian', text: 'Carlos, o Lucas está com febre hoje. Ele não vai à escola.', at: ago(50), readByDriver: true, readByGuardian: true },
      { id: 'msg_6', conversationId: 'conv_2', from: 'driver', text: 'Entendido, Patrícia. Vou registrar a ausência e avisar a coordenação. Melhoras para ele!', at: ago(35), readByDriver: true, readByGuardian: true },
      { id: 'msg_7', conversationId: 'conv_3', from: 'driver', text: 'Camila, cheguei na Rua Sena Madureira. O Pedro já está no portão?', at: ago(110), readByDriver: true, readByGuardian: true },
      { id: 'msg_8', conversationId: 'conv_3', from: 'guardian', text: 'Está descendo agora, obrigada!', at: ago(90), readByDriver: false, readByGuardian: true }
    ];

    const guardianNotifications = [
      { id: 'gn_1', guardianId: 'gua_1', studentId: 'stu_1', type: 'school', title: 'Ana Beatriz chegou à escola', text: 'Chegada registrada às 07:28 na EMEF Jardim das Acácias.', at: atTime(daysAgo(1), 7, 28).toISOString(), read: false },
      { id: 'gn_2', guardianId: 'gua_1', studentId: 'stu_1', type: 'home', title: 'Ana Beatriz chegou em casa', text: 'Chegada registrada às 17:42 na Rua das Palmeiras, 128.', at: atTime(daysAgo(1), 17, 42).toISOString(), read: true },
      { id: 'gn_3', guardianId: 'gua_1', type: 'route', title: 'Ajuste na rota da manhã', text: 'A parada da Rua Loefgren foi antecipada em 5 minutos por causa de uma obra.', at: ago(45), read: false },
      { id: 'gn_4', guardianId: 'gua_1', type: 'hazard', title: 'Perigo na via', text: 'Obra na Rua Loefgren. O motorista fará um desvio seguro e pode atrasar 8 minutos.', at: ago(52), read: false },
      { id: 'gn_5', guardianId: 'gua_1', type: 'van', title: 'Van reserva confirmada', text: 'A van FKN-2A47 passou por manutenção preventiva. Hoje o atendimento será feito pela van reserva.', at: atTime(daysAgo(2), 18, 0).toISOString(), read: true },
      { id: 'gn_6', guardianId: 'gua_2', studentId: 'stu_2', type: 'school', title: 'Lucas chegou à escola', text: 'Chegada registrada às 07:31 na EMEF Jardim das Acácias.', at: atTime(daysAgo(1), 7, 31).toISOString(), read: true },
      { id: 'gn_7', guardianId: 'gua_2', type: 'message', title: 'Nova mensagem do motorista', text: 'Carlos respondeu sobre a ausência do Lucas.', at: ago(35), read: false },
      { id: 'gn_8', guardianId: 'gua_3', studentId: 'stu_6', type: 'home', title: 'Pedro chegou em casa', text: 'Chegada registrada às 17:38 na Rua Sena Madureira, 75.', at: atTime(daysAgo(1), 17, 38).toISOString(), read: true },
      { id: 'gn_9', guardianId: 'gua_3', type: 'message', title: 'Nova mensagem do motorista', text: 'Carlos está na portaria aguardando o Pedro.', at: ago(110), read: false }
    ];

    const calDate = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return isoDay(d);
    };
    const calendar = [
      { id: 'cal_1', date: calDate(0), title: 'Proclamação da República', type: 'holiday', time: '', description: 'Feriado nacional. Não haverá aula.', audience: 'all' },
      { id: 'cal_2', date: calDate(3), title: 'Reunião de pais e mestres', type: 'school', time: '19:00', description: 'Reunião na quadra da escola para alinhar o transporte do próximo bimestre.', audience: 'all' },
      { id: 'cal_3', date: calDate(5), title: 'Dia da Consciência Negra', type: 'holiday', time: '', description: 'Feriado nacional. Não haverá aula.', audience: 'all' },
      { id: 'cal_4', date: calDate(6), title: 'Feira de ciências', type: 'event', time: '08:30', description: 'Os alunos devem chegar 15 minutos mais cedo. A saída será às 12h.', audience: 'all' },
      { id: 'cal_5', date: calDate(12), title: 'Passeio ao zoológico', type: 'event', time: '09:00', description: 'Passeio da turma da manhã. Autorização assinada pelo responsável.', audience: 'all' },
      { id: 'cal_6', date: calDate(30), title: 'Natal', type: 'holiday', time: '', description: 'Feriado nacional. Recesso escolar.', audience: 'all' }
    ];

    const traffic = TRAFFIC_SEED.map((t) => Object.assign({}, t));

    const history = HISTORY_SEED.map((h, i) => {
      const day = daysAgo(h.offset);
      const start = atTime(day, h.start[0], h.start[1]);
      const end = atTime(day, h.end[0], h.end[1]);
      const pickedNames = students.slice(0, h.picked).map((s) => ({ id: s.id, name: s.name, pickedAt: atTime(day, 7, 10 + i).toISOString(), manual: false }));
      return {
        id: 'hist_' + (i + 1),
        routeId: 'route-morning',
        routeName: 'Rota da Manhã',
        date: isoDay(day),
        startedAt: start.toISOString(),
        finishedAt: end.toISOString(),
        durationMin: Math.round((end - start) / 60000),
        distanceKm: h.km,
        total: h.total,
        picked: h.picked,
        issues: h.issues,
        stops: pickedNames,
        finishedBy: 'auto'
      };
    });

    return {
      version: DB_VERSION,
      meta: { seededAt: new Date().toISOString(), demo: true },
      driver: {
        name: 'Carlos Menezes',
        email: cfg.security.demoCredentials.email,
        phone: '(11) 99876-5400',
        cnh: '04589213310',
        role: 'Motorista',
        since: '2021',
        van: { model: 'Volkswagen Kombi', year: 2012, plate: 'FKN-2A47', capacity: 12, color: 'Branca' },
        base: { lat: -23.5985, lng: -46.6435, label: 'Garagem · Rua Sargento Aquino, 45' }
      },
      auth: {
        email: cfg.security.demoCredentials.email,
        hash: await hashPassword(cfg.security.demoCredentials.password),
        role: 'driver',
        updatedAt: new Date().toISOString()
      },
      guardians,
      conversations,
      messages,
      guardianNotifications,
      calendar,
      traffic,
      school: {
        name: 'EMEF Jardim das Acácias',
        address: 'Rua Abílio Soares, 1000',
        district: 'Paraíso',
        city: 'São Paulo',
        lat: -23.5805,
        lng: -46.6395
      },
      students,
      routes: [
        {
          id: 'route-morning',
          name: 'Rota da Manhã',
          shift: 'morning',
          time: '06:40',
          studentIds: morningIds,
          status: 'idle',
          startedAt: null,
          finishedAt: null,
          distanceKm: 0
        },
        {
          id: 'route-afternoon',
          name: 'Rota da Tarde',
          shift: 'afternoon',
          time: '17:20',
          studentIds: afternoonIds,
          status: 'idle',
          startedAt: null,
          finishedAt: null,
          distanceKm: 0
        }
      ],
      activeRouteId: 'route-morning',
      history,
      notifications: [
        { id: 'ntf_1', type: 'success', title: 'Rota da manhã concluída', text: '8 alunos transportados em 42 min.', at: atTime(daysAgo(1), 7, 46).toISOString(), read: false },
        { id: 'ntf_2', type: 'warn', title: 'Contato para revisão', text: 'O telefone do responsável de Laura Martins Dias precisa ser confirmado.', at: atTime(daysAgo(1), 9, 12).toISOString(), read: false },
        { id: 'ntf_3', type: 'info', title: 'Privacidade e LGPD', text: 'Revisão trimestral dos consentimentos de dados agendada.', at: atTime(daysAgo(2), 15, 30).toISOString(), read: true }
      ],
      settings: {
        proximity: cfg.defaults.proximityMeters,
        autoAdvance: cfg.defaults.autoAdvance,
        autoFinish: cfg.defaults.autoFinishAtSchool,
        maskContacts: cfg.defaults.maskContacts,
        demoMode: true,
        sessionTtlMinutes: cfg.defaults.sessionTtlMinutes,
        lockAfterMinutes: cfg.defaults.lockAfterMinutes,
        retentionDays: cfg.defaults.dataRetentionDays,
        notifications: { pickup: true, issues: true, summary: true },
        integrations: { googleKey: cfg.maps.google.apiKey || '', osrmUrl: cfg.maps.routing.osrmBaseUrl, tileUrl: cfg.maps.osm.tileUrl },
        privacy: { consentAt: null, hideAddresses: false, shareWithSchool: false }
      },
      live: null
    };
  }

  /* ---------- Persistência ---------- */
  function save() {
    if (!db) return false;
    const ok = storageSet(DB_KEY, db);
    if (!ok) K.toast('Armazenamento cheio', 'Não foi possível salvar os dados localmente.', 'error');
    return ok;
  }

  async function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const stored = storageGet(DB_KEY, null);
      if (stored && stored.students && stored.routes) {
        db = stored;
        db.version = DB_VERSION;
        // garante campos novos sem perder dados do usuário
        const seeded = await buildSeed();
        db.settings = Object.assign({}, seeded.settings, db.settings || {});
        db.settings.notifications = Object.assign({}, seeded.settings.notifications, (db.settings || {}).notifications || {});
        db.settings.integrations = Object.assign({}, seeded.settings.integrations, (db.settings || {}).integrations || {});
        db.settings.privacy = Object.assign({}, seeded.settings.privacy, (db.settings || {}).privacy || {});
        db.notifications = (db.notifications || seeded.notifications).map((n) => Object.assign({ audience: 'driver' }, n));
        db.history = db.history || seeded.history;
        db.guardians = db.guardians || seeded.guardians;
        db.conversations = db.conversations || seeded.conversations;
        db.messages = db.messages || seeded.messages;
        db.guardianNotifications = db.guardianNotifications || seeded.guardianNotifications;
        db.calendar = db.calendar || seeded.calendar;
        db.traffic = db.traffic || seeded.traffic;
        db.auth.role = 'driver';
        db.guardians.forEach((g) => {
          if (!g.auth || !g.auth.hash) {
            const match = seeded.guardians.find((x) => x.id === g.id);
            if (match && match.auth && match.auth.hash) g.auth = match.auth;
          }
          if (!g.auth) g.auth = { hash: null, active: false, updatedAt: null };
          if (typeof g.auth.active !== 'boolean') g.auth.active = !!g.auth.hash;
          if (!g.activation) g.activation = { code: null, expiresAt: null, usedAt: null };
          if (g.recovery === undefined) g.recovery = null;
          g.preferences = Object.assign({}, (seeded.guardians[0] || {}).preferences, g.preferences || {});
        });
        /* Conta de demonstração de primeiro acesso: adiciona apenas se o aluno
           ainda não tiver um responsável vinculado. */
        if (!db.guardians.some((g) => g.id === 'gua_4') && !db.guardians.some((g) => (g.studentIds || []).includes('stu_3'))) {
          const demoGuardian = seeded.guardians.find((g) => g.id === 'gua_4');
          if (demoGuardian) db.guardians.push(demoGuardian);
        }
        if (db.live && !Array.isArray(db.live.drops)) db.live.drops = [];
      } else {
        db = await buildSeed();
        save();
      }
      return db;
    })();
    return readyPromise;
  }

  function get() { return db; }

  /* ---------- Sessão / autenticação ---------- */
  function session() {
    const s = storageGet(SESSION_KEY, null);
    if (!s) return null;
    if (!s.expiresAt || new Date(s.expiresAt).getTime() < Date.now()) {
      storageRemove(SESSION_KEY);
      return null;
    }
    return s;
  }

  function touch() {
    storageSet(ACTIVITY_KEY, Date.now());
  }

  function isLocked() {
    const last = storageGet(ACTIVITY_KEY, 0) || 0;
    const limit = ((db && db.settings.lockAfterMinutes) || cfg.defaults.lockAfterMinutes) * 60000;
    return last > 0 && Date.now() - last > limit;
  }

  async function login(email, password, remember, role) {
    await ready();
    const normalized = String(email || '').trim().toLowerCase();
    const requested = role === 'guardian' ? 'guardian' : 'driver';
    if (!normalized) return { ok: false, error: 'Informe seu e-mail ou usuário.' };
    if (!password) return { ok: false, error: 'Informe sua senha.' };

    let account = null;
    let base = null;

    if (requested === 'guardian') {
      account = (db.guardians || []).find((g) => String(g.email || '').toLowerCase() === normalized) || null;
      if (!account) {
        if (normalized === String(db.auth.email || '').toLowerCase()) {
          return { ok: false, error: 'Esta conta é de motorista. Selecione "Sou motorista" para entrar.' };
        }
        return { ok: false, error: 'Responsável não encontrado. Verifique o e-mail informado.' };
      }
      const hash = await hashPassword(password);
      if (account.auth && account.auth.active === false) {
        return { ok: false, error: 'Conta ainda não ativada. Use "Primeiro acesso? Ative sua conta".' };
      }
      if (!account.auth || hash !== account.auth.hash) {
        return { ok: false, error: 'Senha incorreta. Tente novamente.' };
      }
      base = {
        email: account.email,
        name: account.name,
        role: 'guardian',
        guardianId: account.id,
        studentIds: (account.studentIds || []).slice()
      };
    } else {
      if (normalized !== String(db.auth.email || '').toLowerCase()) {
        const guardian = (db.guardians || []).find((g) => String(g.email || '').toLowerCase() === normalized);
        if (guardian) {
          return { ok: false, error: 'Esta conta é de responsável. Selecione "Sou responsável" para entrar.' };
        }
        return { ok: false, error: 'Usuário não encontrado. Verifique o e-mail informado.' };
      }
      const hash = await hashPassword(password);
      if (hash !== db.auth.hash) {
        return { ok: false, error: 'Senha incorreta. Tente novamente.' };
      }
      base = {
        email: db.auth.email,
        name: db.driver.name,
        role: 'driver'
      };
    }

    const ttl = (db.settings.sessionTtlMinutes || cfg.defaults.sessionTtlMinutes) * 60000;
    const s = Object.assign({}, base, {
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl).toISOString(),
      remember: !!remember
    });
    storageSet(SESSION_KEY, s);
    storageSet(ACTIVITY_KEY, Date.now());
    return { ok: true, session: s };
  }

  function logout() {
    storageRemove(SESSION_KEY);
    storageRemove(ACTIVITY_KEY);
  }

  async function changePassword(current, next) {
    await ready();
    const currentHash = await hashPassword(current);
    if (currentHash !== db.auth.hash) return { ok: false, error: 'Senha atual incorreta.' };
    if (!next || next.length < 8) return { ok: false, error: 'A nova senha deve ter ao menos 8 caracteres.' };
    db.auth.hash = await hashPassword(next);
    db.auth.updatedAt = new Date().toISOString();
    save();
    return { ok: true };
  }

  /* ---------- Alunos ---------- */
  function students() { return db ? db.students.slice() : []; }

  function student(id) { return db ? db.students.find((s) => s.id === id) || null : null; }

  function fullAddress(s) {
    if (!s) return '';
    return `${s.address}, ${s.number} — ${s.district}, ${s.city}`;
  }

  function guardianByEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized || !db) return null;
    return (db.guardians || []).find((g) => normalizeEmail(g.email) === normalized) || null;
  }

  function createGuardianForStudent(student, email) {
    const now = new Date();
    const g = {
      id: uid('gua'),
      name: student.guardian,
      email: normalizeEmail(email),
      phone: student.phone,
      relation: 'Responsável',
      studentIds: [student.id],
      auth: { hash: null, active: false, updatedAt: null },
      activation: {
        code: generateActivationCode(),
        expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
        usedAt: null,
        createdAt: now.toISOString()
      },
      recovery: null,
      preferences: {
        notifyHome: true, notifySchool: true, notifyRoute: true,
        notifyHazard: true, notifyVan: true, notifyMessages: true
      },
      createdAt: now.toISOString()
    };
    db.guardians = db.guardians || [];
    db.guardians.push(g);
    db.conversations = db.conversations || [];
    if (!db.conversations.some((c) => c.guardianId === g.id)) {
      db.conversations.push({
        id: uid('conv'), guardianId: g.id, studentId: student.id,
        updatedAt: now.toISOString(), unreadDriver: 0, unreadGuardian: 0
      });
    }
    return g;
  }

  /* Vincula o aluno a um responsável pelo e-mail. Se ainda não existir conta,
     cria uma conta inativa com código individual de ativação. */
  function attachGuardian(student, email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return guardianForStudent(student.id);
    let g = guardianByEmail(normalized);
    if (!g) g = createGuardianForStudent(student, normalized);
    g.studentIds = g.studentIds || [];
    if (!g.studentIds.includes(student.id)) g.studentIds.push(student.id);
    if (student.guardian) g.name = student.guardian;
    if (student.phone) g.phone = student.phone;
    return g;
  }

  function saveStudent(data) {
    if (!db) return null;
    const clean = {
      name: String(data.name || '').trim(),
      address: String(data.address || '').trim(),
      number: String(data.number || '').trim(),
      district: String(data.district || '').trim(),
      city: String(data.city || '').trim(),
      school: String(data.school || '').trim(),
      guardian: String(data.guardian || '').trim(),
      phone: String(data.phone || '').trim(),
      note: String(data.note || '').trim(),
      lat: Number(data.lat) || null,
      lng: Number(data.lng) || null,
      geoApprox: !!data.geoApprox
    };
    if (data.id) {
      const existing = student(data.id);
      if (!existing) return null;
      Object.assign(existing, clean, { updatedAt: new Date().toISOString() });
      if (data.guardianEmail) {
        const normalized = normalizeEmail(data.guardianEmail);
        /* Ao trocar o e-mail, desvincula o aluno das contas anteriores para
           não manter acesso de uma família que não é mais responsável. */
        (db.guardians || []).forEach((g) => {
          if (normalizeEmail(g.email) !== normalized) {
            g.studentIds = (g.studentIds || []).filter((sid) => sid !== existing.id);
          }
        });
        attachGuardian(existing, normalized);
      } else {
        const linked = guardianForStudent(existing.id);
        if (linked) { linked.name = clean.guardian; linked.phone = clean.phone; }
      }
      save();
      return existing;
    }
    const created = Object.assign({}, clean, {
      id: uid('stu'),
      status: 'waiting',
      boardedAt: null,
      deliveredAt: null,
      noDeliveryAt: null,
      createdAt: new Date().toISOString(),
      consent: { granted: true, at: new Date().toISOString() }
    });
    db.students.push(created);
    const morning = db.routes.find((r) => r.shift === 'morning');
    if (morning && !morning.studentIds.includes(created.id)) {
      morning.studentIds.push(created.id);
    }
    if (data.guardianEmail) attachGuardian(created, data.guardianEmail);
    save();
    return created;
  }

  function deleteStudent(id) {
    if (!db) return false;
    const idx = db.students.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    db.students.splice(idx, 1);
    db.routes.forEach((r) => { r.studentIds = r.studentIds.filter((sid) => sid !== id); });
    (db.guardians || []).forEach((g) => {
      g.studentIds = (g.studentIds || []).filter((sid) => sid !== id);
    });
    if (db.live && db.live.nextId === id) db.live = null;
    save();
    return true;
  }

  function setStatus(id, status) {
    const s = student(id);
    if (!s) return;
    const at = new Date().toISOString();
    s.status = status;
    if (status === 'picked') {
      s.boardedAt = at;
      s.deliveredAt = null;
      s.noDeliveryAt = null;
    } else if (status === 'delivered') {
      s.deliveredAt = at;
    } else if (status === 'no_delivery') {
      s.noDeliveryAt = at;
    }
    save();
  }

  function clearTripStamps(routeObj) {
    routeStudents(routeObj).forEach((s) => {
      s.boardedAt = null;
      s.deliveredAt = null;
      s.noDeliveryAt = null;
    });
  }

  /* ---------- Rotas ---------- */
  function routes() { return db ? db.routes.slice() : []; }
  function route(id) { return db ? db.routes.find((r) => r.id === id) || null : null; }

  function activeRoute() {
    if (!db) return null;
    return route(db.activeRouteId) || db.routes[0] || null;
  }

  function routeStudents(r) {
    if (!db || !r) return [];
    return r.studentIds.map((id) => student(id)).filter(Boolean);
  }

  function routeStats(r) {
    const list = routeStudents(r);
    const afternoon = !!(r && r.shift === 'afternoon');
    const picked = list.filter((s) => s.status === 'picked').length;
    const delivered = list.filter((s) => s.status === 'delivered').length;
    const issues = list.filter((s) => s.status === 'issue').length;
    const noDelivery = list.filter((s) => s.status === 'no_delivery').length;
    const waiting = list.filter((s) => s.status === 'waiting' || s.status === 'next').length;
    const next = list.find((s) => s.status === 'next') || null;
    const total = list.length;
    const done = afternoon ? delivered + issues + noDelivery : picked + issues;
    return {
      total, picked, delivered, issues, noDelivery, waiting, next,
      onboard: picked,
      done,
      shift: afternoon ? 'afternoon' : 'morning',
      progress: total ? Math.round((done / total) * 100) : 0
    };
  }

  function estimateDistance(r) {
    const list = routeStudents(r);
    const afternoon = !!(r && r.shift === 'afternoon');
    const start = afternoon
      ? (db && db.school)
      : ((db && db.driver.base) || { lat: -23.5985, lng: -46.6435 });
    if (!start) return 0;
    const pts = [start].concat(list);
    if (!afternoon && db && db.school) pts.push(db.school);
    return K.geo.pathDistance(pts) / 1000;
  }

  function activateRoute(id) {
    if (!db) return false;
    const r = route(id);
    if (!r) return false;
    if (db.live) return false;
    db.activeRouteId = id;
    db.routes.forEach((rt) => {
      rt.status = rt.id === id ? 'idle' : 'idle';
      rt.startedAt = null;
      rt.finishedAt = null;
    });
    const list = routeStudents(r);
    const afternoon = r.shift === 'afternoon';
    clearTripStamps(r);
    list.forEach((s, i) => { s.status = !afternoon && i === 0 ? 'next' : 'waiting'; });
    save();
    return true;
  }

  function setRouteOrder(id, ids) {
    const r = route(id);
    if (!r) return;
    r.studentIds = ids.slice();
    save();
  }

  function addStudentToRoute(routeId, studentId) {
    const r = route(routeId);
    if (!r || r.studentIds.includes(studentId)) return false;
    r.studentIds.push(studentId);
    const s = student(studentId);
    if (s && r.id === db.activeRouteId && !r.startedAt) s.status = 'waiting';
    save();
    return true;
  }

  function removeStudentFromRoute(routeId, studentId) {
    const r = route(routeId);
    if (!r) return false;
    r.studentIds = r.studentIds.filter((id) => id !== studentId);
    save();
    return true;
  }

  function addHistory(record) {
    if (!db) return null;
    const entry = Object.assign({ id: uid('hist'), createdAt: new Date().toISOString() }, record);
    db.history.unshift(entry);
    save();
    return entry;
  }

  function history() {
    if (!db) return [];
    return db.history.slice().sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }

  /* ---------- Configurações / motorista ---------- */
  function settings() { return db ? db.settings : null; }

  function updateSettings(patch) {
    if (!db) return null;
    Object.keys(patch || {}).forEach((key) => {
      if (patch[key] && typeof patch[key] === 'object' && !Array.isArray(patch[key])) {
        db.settings[key] = Object.assign({}, db.settings[key], patch[key]);
      } else {
        db.settings[key] = patch[key];
      }
    });
    save();
    return db.settings;
  }

  function driver() { return db ? db.driver : null; }

  function updateDriver(patch) {
    if (!db) return null;
    Object.assign(db.driver, patch || {});
    if (patch && patch.van) db.driver.van = Object.assign({}, db.driver.van, patch.van);
    if (patch && patch.base) db.driver.base = Object.assign({}, db.driver.base, patch.base);
    save();
    return db.driver;
  }

  /* ---------- Responsáveis ---------- */
  function guardians() { return db ? (db.guardians || []).slice() : []; }

  function guardian(id) {
    return db ? (db.guardians || []).find((g) => g.id === id) || null : null;
  }

  function guardianForStudent(studentId) {
    return db ? (db.guardians || []).find((g) => (g.studentIds || []).includes(studentId)) || null : null;
  }

  function guardianChildren(g) {
    if (!g) return [];
    return (g.studentIds || []).map((id) => student(id)).filter(Boolean);
  }

  function updateGuardian(id, patch) {
    const g = guardian(id);
    if (!g) return null;
    Object.assign(g, patch || {});
    if (patch && patch.preferences) {
      g.preferences = Object.assign({}, g.preferences, patch.preferences);
    }
    g.updatedAt = new Date().toISOString();
    save();
    return g;
  }

  async function changeGuardianPassword(id, current, next) {
    const g = guardian(id);
    if (!g) return { ok: false, error: 'Responsável não encontrado.' };
    const currentHash = await hashPassword(current);
    if (!g.auth || currentHash !== g.auth.hash) return { ok: false, error: 'Senha atual incorreta.' };
    if (!next || next.length < 8) return { ok: false, error: 'A nova senha deve ter ao menos 8 caracteres.' };
    g.auth.hash = await hashPassword(next);
    g.auth.active = true;
    g.auth.updatedAt = new Date().toISOString();
    save();
    return { ok: true };
  }

  /* ---------- Primeiro acesso do responsável ---------- */
  async function validateGuardianActivation(email, code) {
    await ready();
    const g = guardianByEmail(email);
    const generic = {
      ok: false,
      error: 'E-mail ou código inválido. Confira os dados ou solicite um novo código ao motorista.'
    };
    if (!g) return generic;
    if (g.auth && g.auth.active) {
      return { ok: false, error: 'Esta conta já está ativa. Use a tela de login com sua senha.' };
    }
    const a = g.activation || {};
    if (!a.code || a.usedAt) {
      return { ok: false, error: 'Código inválido ou já utilizado. Solicite um novo código ao motorista.' };
    }
    if (a.expiresAt && new Date(a.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: 'Código expirado. Solicite um novo código ao motorista.' };
    }
    if (normalizeCode(code) !== normalizeCode(a.code)) return generic;
    return { ok: true, guardianId: g.id, name: g.name, email: g.email };
  }

  async function activateGuardian(email, code, password) {
    const check = await validateGuardianActivation(email, code);
    if (!check.ok) return check;
    if (!password || password.length < 8) {
      return { ok: false, error: 'A senha deve ter ao menos 8 caracteres.' };
    }
    const g = guardian(check.guardianId);
    g.auth = { hash: await hashPassword(password), active: true, updatedAt: new Date().toISOString() };
    g.activation = Object.assign({}, g.activation, {
      code: null,
      usedAt: new Date().toISOString()
    });
    save();
    return { ok: true, guardianId: g.id, name: g.name, email: g.email };
  }

  /* ---------- Recuperação de senha do responsável ---------- */
  async function requestGuardianRecovery(email) {
    await ready();
    const g = guardianByEmail(email);
    /* Não revela se a conta existe: a resposta pública é sempre neutra. */
    if (!g) return { ok: true };
    const code = generateRecoveryCode();
    const expiresAt = new Date(Date.now() + 30 * 60000).toISOString();
    g.recovery = { code, expiresAt, usedAt: null, requestedAt: new Date().toISOString() };
    save();
    return { ok: true, demoCode: code, expiresAt };
  }

  async function resetGuardianPassword(email, code, password) {
    await ready();
    const generic = { ok: false, error: 'Código inválido ou expirado. Solicite um novo código.' };
    const g = guardianByEmail(email);
    if (!g || !g.recovery) return generic;
    const r = g.recovery;
    if (!r.code || r.usedAt) return generic;
    if (r.expiresAt && new Date(r.expiresAt).getTime() < Date.now()) return generic;
    if (normalizeCode(code) !== normalizeCode(r.code)) return generic;
    if (!password || password.length < 8) {
      return { ok: false, error: 'A nova senha deve ter ao menos 8 caracteres.' };
    }
    g.auth = { hash: await hashPassword(password), active: true, updatedAt: new Date().toISOString() };
    g.recovery = {
      code: null,
      usedAt: new Date().toISOString(),
      expiresAt: r.expiresAt,
      requestedAt: r.requestedAt
    };
    save();
    return { ok: true, guardianId: g.id };
  }

  function regenerateGuardianActivation(guardianId) {
    const g = guardian(guardianId);
    if (!g) return null;
    g.activation = {
      code: generateActivationCode(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      usedAt: null,
      createdAt: new Date().toISOString()
    };
    save();
    return g.activation;
  }

  function guardianAuthStatus(guardianId) {
    const g = guardian(guardianId);
    if (!g) return null;
    const active = !!(g.auth && g.auth.active && g.auth.hash);
    const a = g.activation || {};
    const expired = !!(a.expiresAt && new Date(a.expiresAt).getTime() < Date.now());
    return {
      active,
      code: active ? null : (a.code || null),
      expiresAt: a.expiresAt || null,
      expired,
      used: !!a.usedAt,
      email: g.email,
      name: g.name,
      guardianId: g.id
    };
  }

  /* ---------- Conversas ---------- */
  function conversations() {
    if (!db) return [];
    return (db.conversations || []).slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function conversation(id) {
    return db ? (db.conversations || []).find((c) => c.id === id) || null : null;
  }

  function conversationForGuardian(guardianId) {
    return db ? (db.conversations || []).find((c) => c.guardianId === guardianId) || null : null;
  }

  function messages(conversationId) {
    if (!db) return [];
    return (db.messages || [])
      .filter((m) => m.conversationId === conversationId)
      .slice()
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  function lastMessage(conversationId) {
    const list = messages(conversationId);
    return list.length ? list[list.length - 1] : null;
  }

  function sendMessage(conversationId, from, text) {
    const c = conversation(conversationId);
    if (!c) return null;
    const clean = String(text || '').trim().slice(0, 2000);
    if (!clean) return null;
    const sender = from === 'guardian' ? 'guardian' : 'driver';
    const msg = {
      id: uid('msg'),
      conversationId,
      from: sender,
      text: clean,
      at: new Date().toISOString(),
      readByDriver: sender === 'driver',
      readByGuardian: sender === 'guardian'
    };
    db.messages.push(msg);
    c.updatedAt = msg.at;
    if (sender === 'guardian') {
      c.unreadDriver = (c.unreadDriver || 0) + 1;
      const g = guardian(c.guardianId);
      pushNotification({
        audience: 'driver',
        type: 'info',
        title: 'Nova mensagem de responsável',
        text: `${g ? g.name : 'Responsável'}: ${clean.slice(0, 90)}`
      });
    } else {
      c.unreadGuardian = (c.unreadGuardian || 0) + 1;
      const g = guardian(c.guardianId);
      if (g && (!g.preferences || g.preferences.notifyMessages !== false)) {
        pushNotification({
          audience: 'guardian',
          guardianId: c.guardianId,
          type: 'message',
          title: 'Nova mensagem do motorista',
          text: clean.slice(0, 120)
        });
      }
    }
    save();
    return msg;
  }

  function markConversationRead(conversationId, role) {
    const c = conversation(conversationId);
    if (!c) return;
    if (role === 'guardian') c.unreadGuardian = 0;
    else c.unreadDriver = 0;
    (db.messages || []).forEach((m) => {
      if (m.conversationId !== conversationId) return;
      if (role === 'guardian') m.readByGuardian = true;
      else m.readByDriver = true;
    });
    save();
  }

  function unreadMessages(role, guardianId) {
    if (!db) return 0;
    if (role === 'guardian') {
      const c = conversationForGuardian(guardianId);
      return c ? (c.unreadGuardian || 0) : 0;
    }
    return (db.conversations || []).reduce((n, c) => n + (c.unreadDriver || 0), 0);
  }

  /* ---------- Notificações por perfil ---------- */
  function pushNotification(data) {
    if (!db) return null;
    const n = Object.assign({ id: uid('ntf'), at: new Date().toISOString(), read: false }, data);
    if (n.audience === 'guardian') {
      if (!n.guardianId) return null;
      db.guardianNotifications = db.guardianNotifications || [];
      db.guardianNotifications.unshift(n);
    } else {
      n.audience = 'driver';
      delete n.guardianId;
      db.notifications.unshift(n);
    }
    save();
    return n;
  }

  function notificationsFor(role, guardianId) {
    if (!db) return [];
    if (role === 'guardian') {
      return (db.guardianNotifications || [])
        .filter((n) => n.guardianId === guardianId)
        .slice()
        .sort((a, b) => new Date(b.at) - new Date(a.at));
    }
    return db.notifications
      .filter((n) => !n.audience || n.audience === 'driver')
      .slice()
      .sort((a, b) => new Date(b.at) - new Date(a.at));
  }

  function markNotificationsRead(role, guardianId) {
    if (!db) return;
    if (role === 'guardian') {
      (db.guardianNotifications || []).forEach((n) => { if (n.guardianId === guardianId) n.read = true; });
    } else {
      db.notifications.forEach((n) => { n.read = true; });
    }
    save();
  }

  function notifyGuardianForStudent(studentId, type, title, text) {
    const g = guardianForStudent(studentId);
    if (!g) return null;
    const prefs = g.preferences || {};
    if ((type === 'home' || type === 'delivery') && prefs.notifyHome === false) return null;
    if (type === 'school' && prefs.notifySchool === false) return null;
    if (type === 'route' && prefs.notifyRoute === false) return null;
    if (type === 'hazard' && prefs.notifyHazard === false) return null;
    if (type === 'van' && prefs.notifyVan === false) return null;
    if (type === 'no_delivery' && prefs.notifyHome === false) return null;
    return pushNotification({ audience: 'guardian', guardianId: g.id, studentId, type, title, text });
  }

  function notifyGuardiansRouteFinished(route, list, kind) {
    const type = kind === 'home' ? 'home' : 'school';
    (list || []).forEach((s) => {
      const firstName = String(s.name || '').split(' ')[0];
      const destination = kind === 'home' ? 'chegou em casa' : 'chegou à escola';
      notifyGuardianForStudent(
        s.id,
        type,
        `${firstName} ${destination}`,
        kind === 'home'
          ? `Chegada registrada às ${K.fmt.time(new Date().toISOString())} no endereço residencial.`
          : `Chegada registrada às ${K.fmt.time(new Date().toISOString())} na ${db.school.name}.`
      );
    });
  }

  /* ---------- Calendário e trânsito ---------- */
  function calendarEvents() {
    if (!db) return [];
    return (db.calendar || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function addCalendarEvent(data) {
    if (!db) return null;
    const event = {
      id: uid('cal'),
      date: String(data.date || '').slice(0, 10),
      title: String(data.title || '').trim(),
      type: data.type || 'event',
      time: String(data.time || '').trim(),
      description: String(data.description || '').trim(),
      audience: 'all'
    };
    if (!event.date || !event.title) return null;
    db.calendar = db.calendar || [];
    db.calendar.push(event);
    save();
    return event;
  }

  function removeCalendarEvent(id) {
    if (!db) return false;
    const before = (db.calendar || []).length;
    db.calendar = (db.calendar || []).filter((e) => e.id !== id);
    save();
    return db.calendar.length < before;
  }

  function trafficIncidents() {
    if (!db) return [];
    return (db.traffic || []).filter((t) => t.active !== false);
  }

  function resolveTrafficIncident(id, guardianIds) {
    if (!db) return null;
    const t = (db.traffic || []).find((x) => x.id === id);
    if (!t) return null;
    t.active = false;
    t.resolvedAt = new Date().toISOString();
    const allowed = Array.isArray(guardianIds) ? new Set(guardianIds) : null;
    (db.guardians || []).forEach((g) => {
      if (allowed && !allowed.has(g.id)) return;
      if (!g.preferences || g.preferences.notifyRoute !== false) {
        pushNotification({
          audience: 'guardian',
          guardianId: g.id,
          type: 'route',
          title: 'Rota ajustada',
          text: `O motorista desviou de ${t.title}. O novo trajeto já está em andamento.`
        });
      }
    });
    save();
    return t;
  }

  function notifications(role, guardianId) {
    return notificationsFor(role || 'driver', guardianId);
  }

  /* ---------- Relatórios ---------- */
  function reportSummary() {
    if (!db) return null;
    const hist = history();
    const now = new Date();
    const monthHist = hist.filter((h) => {
      const d = new Date(h.startedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const todayKey = isoDay(now);
    const todayHist = hist.filter((h) => h.date === todayKey);

    const sum = (arr, key) => arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
    const avg = (arr, key) => (arr.length ? sum(arr, key) / arr.length : 0);

    const active = activeRoute();
    const stats = routeStats(active);

    // últimos 7 dias (inclui hoje)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const key = isoDay(d);
      const entry = hist.find((h) => h.date === key);
      days.push({
        key,
        label: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getDay()],
        date: d,
        students: entry ? entry.picked : 0,
        km: entry ? entry.distanceKm : 0,
        duration: entry ? entry.durationMin : 0,
        done: !!entry
      });
    }

    const statusCounts = {
      picked: db.students.filter((s) => s.status === 'picked').length,
      next: db.students.filter((s) => s.status === 'next').length,
      waiting: db.students.filter((s) => s.status === 'waiting').length,
      issue: db.students.filter((s) => s.status === 'issue').length,
      delivered: db.students.filter((s) => s.status === 'delivered').length,
      noDelivery: db.students.filter((s) => s.status === 'no_delivery').length
    };

    return {
      totalStudents: db.students.length,
      monthStudents: sum(monthHist, 'picked'),
      monthRoutes: monthHist.length,
      monthKm: sum(monthHist, 'distanceKm'),
      avgDuration: avg(monthHist, 'durationMin'),
      monthIssues: sum(monthHist, 'issues'),
      todayStudents: sum(todayHist, 'picked'),
      todayRoutes: todayHist.length,
      completed: monthHist.length,
      pending: active && active.status !== 'done' ? 1 : 0,
      activeStats: stats,
      days,
      statusCounts,
      history: hist
    };
  }

  /* ---------- Manutenção ---------- */
  function exportData() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'KombiTech', data: db }, null, 2);
  }

  async function resetDemo() {
    storageRemove(DB_KEY);
    storageRemove(SESSION_KEY);
    storageRemove(ACTIVITY_KEY);
    db = null;
    readyPromise = null;
    await ready();
    return db;
  }

  function clearHistory() {
    if (!db) return;
    db.history = [];
    save();
  }

  function wipeStudents() {
    if (!db) return;
    db.students = [];
    db.routes.forEach((r) => { r.studentIds = []; });
    db.live = null;
    save();
  }

  K.store = {
    ready, get, save,
    session, touch, isLocked, login, logout, changePassword,
    students, student, fullAddress, saveStudent, deleteStudent, setStatus,
    routes, route, activeRoute, routeStudents, routeStats, estimateDistance,
    activateRoute, setRouteOrder, addStudentToRoute, removeStudentFromRoute,
    addHistory, history,
    settings, updateSettings, driver, updateDriver,
    guardians, guardian, guardianForStudent, guardianChildren, updateGuardian, changeGuardianPassword,
    guardianByEmail, validateGuardianActivation, activateGuardian,
    requestGuardianRecovery, resetGuardianPassword, regenerateGuardianActivation, guardianAuthStatus,
    clearTripStamps,
    conversations, conversation, conversationForGuardian, messages, lastMessage,
    sendMessage, markConversationRead, unreadMessages,
    pushNotification, notificationsFor, notifications, markNotificationsRead,
    notifyGuardianForStudent, notifyGuardiansRouteFinished,
    calendarEvents, addCalendarEvent, removeCalendarEvent,
    trafficIncidents, resolveTrafficIncident,
    reportSummary, exportData, resetDemo, clearHistory, wipeStudents,
    isoDay, daysAgo
  };
})(window.KT);
