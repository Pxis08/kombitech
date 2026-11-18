/* ==========================================================================
   KombiTech — Configuração de integrações
   --------------------------------------------------------------------------
   Este arquivo centraliza tudo que depende de serviços externos.
   Nenhuma chave é obrigatória para o modo de demonstração funcionar.

   PRODUÇÃO
   - Nunca coloque chaves secretas no front-end. As chaves abaixo existem
     apenas para desenvolvimento local. Em produção, crie um backend
     (Node/Express, NestJS, Supabase, Firebase, etc.) e exponha endpoints
     autenticados que falem com os provedores.
   - Variáveis de ambiente sugeridas (.env do backend):
       MAPS_PROVIDER=google|openstreetmap
       GOOGLE_MAPS_API_KEY=...
       OSRM_BASE_URL=https://router.project-osrm.org
       NOMINATIM_URL=https://nominatim.openstreetmap.org
       DATABASE_URL=postgres://...
       JWT_SECRET=...
       SESSION_TTL_MINUTES=480
   ========================================================================== */
window.KT = window.KT || {};

window.KT.config = {
  app: {
    name: 'KombiTech',
    tagline: 'Rastreamento inteligente, do primeiro aluno até a escola.',
    version: '1.0.0-demo'
  },

  /* Provedor de mapas: 'google' (padrão, chave configurada abaixo) ou
     'openstreetmap' (sem chave, sujeito à política de uso dos servidores
     voluntários do OSM). O Google Maps carrega a API JS sob demanda. */
  maps: {
    provider: 'google',
    osm: {
      tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19
    },
    google: {
      apiKey: 'AIzaSyAbT2csP1WgpJJuzKGF9aRRwBfVVrMxqrE', // chave fornecida para desenvolvimento
      libraries: 'places,geometry'
    },
    /* Roteirização: OSRM público serve para demonstração.
       Em produção use um servidor OSRM próprio ou Google Directions. */
    routing: {
      enabled: true,
      osrmBaseUrl: 'https://router.project-osrm.org',
      profile: 'driving',
      timeoutMs: 9000
    },
    geocoding: {
      enabled: true,
      nominatimUrl: 'https://nominatim.openstreetmap.org',
      timeoutMs: 8000
    }
  },

  /* Localização da perua.
     demo: simulação controlada, sempre sinalizada na interface.
     gps:  geolocalização real do navegador (HTTPS ou localhost). */
  location: {
    mode: 'demo',
    demoSpeedKmh: 38,
    demoTimeScale: 12,      // 12x mais rápido que o tempo real
    gpsHighAccuracy: true,
    gpsTimeoutMs: 12000,
    gpsMaxAgeMs: 5000
  },

  defaults: {
    proximityMeters: 120,   // raio para confirmar embarque automaticamente
    autoAdvance: true,
    autoFinishAtSchool: true,
    maskContacts: true,
    sessionTtlMinutes: 480,
    lockAfterMinutes: 30,
    dataRetentionDays: 180
  },

  security: {
    demoCredentials: {
      email: 'motorista@kombitech.app',
      password: 'kombi1234'
    },
    guardianDemoCredentials: {
      email: 'responsavel@kombitech.app',
      password: 'kombi1234'
    },
    /* Aviso exibido na tela de configurações */
    note: 'Demonstração local: os dados ficam no navegador (localStorage). Em produção, use autenticação no servidor, senhas com bcrypt/argon2, HTTPS, criptografia em repouso e controle de acesso por perfil.'
  }
};
