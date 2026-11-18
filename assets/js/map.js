/* ==========================================================================
   KombiTech — Mapa
   Backend principal: Google Maps JavaScript API (chave em config.js).
   Alternativa: Leaflet + OpenStreetMap quando configurado.
   Fallback: mapa esquemático em SVG quando não há internet/API disponível.
   ========================================================================== */
(function (K) {
  'use strict';

  const cfg = K.config;
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  let leafletPromise = null;
  let googlePromise = null;

  function loadGoogle() {
    if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
    if (googlePromise) return googlePromise;
    googlePromise = new Promise((resolve, reject) => {
      /* A chave pode ser trocada em Configurações; o config.js é o padrão. */
      const db = K.store && K.store.get ? K.store.get() : null;
      const stored = db && db.settings && db.settings.integrations && db.settings.integrations.googleKey;
      const key = stored || (cfg.maps.google && cfg.maps.google.apiKey);
      if (!key) { reject(new Error('missing-key')); return; }
      if (!navigator.onLine) { reject(new Error('offline')); return; }

      const callbackName = '__ktGoogleMapsReady_' + Date.now();
      const script = document.createElement('script');
      let timer = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        try { delete window[callbackName]; } catch (e) { window[callbackName] = undefined; }
      };

      window[callbackName] = () => {
        cleanup();
        if (window.google && window.google.maps) resolve(window.google.maps);
        else reject(new Error('google-unavailable'));
      };

      script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) +
        '&libraries=' + encodeURIComponent((cfg.maps.google && cfg.maps.google.libraries) || 'places,geometry') +
        '&callback=' + callbackName + '&loading=async';
      script.async = true;
      script.defer = true;
      script.onerror = () => { cleanup(); reject(new Error('load-error')); };
      timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 12000);
      document.head.appendChild(script);
    }).catch((err) => { googlePromise = null; throw err; });
    return googlePromise;
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!navigator.onLine) { reject(new Error('offline')); return; }
      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS;
        link.setAttribute('data-leaflet', '1');
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.crossOrigin = 'anonymous';
      const timer = setTimeout(() => { script.remove(); reject(new Error('timeout')); }, 9000);
      script.onload = () => { clearTimeout(timer); resolve(window.L); };
      script.onerror = () => { clearTimeout(timer); reject(new Error('load-error')); };
      document.head.appendChild(script);
    }).catch((err) => { leafletPromise = null; throw err; });
    return leafletPromise;
  }

  /* Normaliza um ponto geográfico. Retorna null quando não há coordenada
     válida, evitando que o Leaflet receba valores nulos ou fora do planeta. */
  function coord(p) {
    if (!p || p.lat == null || p.lng == null || p.lat === '' || p.lng === '') return null;
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  }

  function latLngsOf(list) {
    const out = [];
    (list || []).forEach((p) => {
      const c = coord(p);
      if (c) out.push(c);
    });
    return out;
  }

  function popupHtml(s, index) {
    const st = K.STATUS[s.status] || K.STATUS.waiting;
    return `
      <div class="kt-pop">
        <div class="kt-pop-top">
          <span class="badge ${st.cls}">${K.icon(st.icon)}${st.short}</span>
          <span class="tiny muted">#${index + 1}</span>
        </div>
        <div class="kt-pop-name">${K.esc(s.name)}</div>
        <div class="kt-pop-addr">${K.esc(s.address)}, ${K.esc(s.number)} — ${K.esc(s.district)}</div>
        <div class="kt-pop-meta">
          <span class="badge b-gray">${K.icon('phone')}${K.esc(K.fmt.maskPhone(s.phone))}</span>
          <span class="badge b-gray">${K.icon('school')}${K.esc(s.school)}</span>
        </div>
      </div>`;
  }

  class MapView {
    constructor(container, options) {
      this.el = container;
      this.opts = options || {};
      this.backend = null;
      this.map = null;
      this.layers = {};
      this.markers = {};
      this.data = { students: [], school: null, van: null, route: [], traveled: [], nextId: null, fit: true };
      this.destroyed = false;
      this.warnedTiles = false;
      this.initPromise = this.init();
    }

    async init() {
      const provider = (cfg.maps && cfg.maps.provider) || 'openstreetmap';
      if (provider === 'google') {
        try {
          const G = await loadGoogle();
          if (this.destroyed) return;
          this.setupGoogle(G);
          return;
        } catch (e) {
          if (this.destroyed) return;
          /* Sem Google Maps, o SVG é mais seguro do que tentar tiles OSM
             que podem estar bloqueados por política de uso. */
          this.setupSvg();
          return;
        }
      }
      try {
        const L = await loadLeaflet();
        if (this.destroyed) return;
        this.setupLeaflet(L);
      } catch (e) {
        if (this.destroyed) return;
        this.setupSvg();
      }
    }

    /* ---------- Leaflet ---------- */
    setupLeaflet(L) {
      this.L = L;
      this.backend = 'leaflet';
      this.map = L.map(this.el, {
        zoomControl: true,
        attributionControl: true,
        preferCanvas: true,
        scrollWheelZoom: true
      }).setView([-23.589, -46.634], 13);

      const tiles = L.tileLayer((cfg.maps.osm && cfg.maps.osm.tileUrl) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: cfg.maps.osm.attribution
      });
      tiles.on('tileerror', () => {
        this.tileErrors = (this.tileErrors || 0) + 1;
        if (this.tileErrors === 8 && !this.warnedTiles) {
          this.warnedTiles = true;
          this.showOfflineNote();
        }
      });
      tiles.addTo(this.map);

      this.layers.routeHalo = L.layerGroup().addTo(this.map);
      this.layers.route = L.layerGroup().addTo(this.map);
      this.layers.traveled = L.layerGroup().addTo(this.map);
      this.layers.students = L.layerGroup().addTo(this.map);
      this.layers.school = L.layerGroup().addTo(this.map);
      this.layers.van = L.layerGroup().addTo(this.map);

      this.el.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-map-student]');
        if (btn && this.opts.onStudentClick) this.opts.onStudentClick(btn.getAttribute('data-map-student'));
      });

      this.applyData();
    }

    showOfflineNote() {
      if (!this.el || this.el.querySelector('.svgmap-note')) return;
      const note = document.createElement('div');
      note.className = 'svgmap-note';
      note.innerHTML = '<span class="map-chip">Sem conexão com os mapas · rotas continuam ativas</span>';
      this.el.appendChild(note);
    }

    /* ---------- Google Maps ---------- */
    setupGoogle(G) {
      this.google = G;
      this.backend = 'google';
      this.map = new G.Map(this.el, {
        center: { lat: -23.589, lng: -46.634 },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: 'greedy',
        backgroundColor: '#E9EFF7'
      });
      this.gInfo = new G.InfoWindow();
      this.gRouteHalo = null;
      this.gRoute = null;
      this.gTraveled = null;
      this.gSchool = null;
      this.gVan = null;

      window.gm_authFailure = () => {
        if (this.destroyed) return;
        K.toast('Google Maps indisponível', 'Verifique a chave e as APIs habilitadas no Google Cloud. Exibindo mapa esquemático.', 'warn', { ttl: 8000 });
        this.fallbackToSvg();
      };

      this.applyData();
    }

    fallbackToSvg() {
      if (this.destroyed) return;
      try {
        Object.keys(this.markers).forEach((id) => {
          const m = this.markers[id];
          if (m && m.setMap) m.setMap(null);
        });
        [this.gRoute, this.gRouteHalo, this.gTraveled, this.gSchool, this.gVan].forEach((l) => {
          if (l && l.setMap) l.setMap(null);
        });
        if (this.gInfo) this.gInfo.close();
      } catch (e) { /* ignore */ }
      this.markers = {};
      this.gRoute = this.gRouteHalo = this.gTraveled = this.gSchool = this.gVan = null;
      this.gInfo = null;
      this.google = null;
      this.map = null;
      this.backend = null;
      if (this.el) this.el.innerHTML = '';
      this.setupSvg();
    }

    gIcon(kind, label, color) {
      const G = this.google;
      const size = kind === 'van' ? 44 : kind === 'school' ? 38 : 34;
      let inner;
      if (kind === 'van') {
        inner = `<rect x="5" y="9" width="24" height="17" rx="5" fill="${color}" stroke="#fff" stroke-width="3"/><rect x="9" y="13" width="16" height="6" rx="1.5" fill="#fff" opacity=".95"/><circle cx="10" cy="27" r="2.4" fill="#071629"/><circle cx="24" cy="27" r="2.4" fill="#071629"/>`;
      } else if (kind === 'school') {
        inner = `<rect x="3" y="3" width="28" height="28" rx="9" fill="${color}" stroke="#fff" stroke-width="3"/><path d="M9 22V14l8-5 8 5v8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 22v-4.5h8V22" fill="none" stroke="#fff" stroke-width="2"/>`;
      } else {
        inner = `<path d="M17 1C9.8 1 4 6.8 4 14c0 9.5 13 19 13 19s13-9.5 13-19C30 6.8 24.2 1 17 1z" fill="${color}" stroke="#fff" stroke-width="2.5"/><text x="17" y="18.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#fff">${label}</text>`;
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 34 34">${inner}</svg>`;
      return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new G.Size(size, size),
        anchor: new G.Point(size / 2, kind === 'van' ? size / 2 : size)
      };
    }

    schoolPopup() {
      const s = this.data.school;
      if (!s) return '';
      return `
        <div class="kt-pop-school">${K.icon('school')}<div><b>${K.esc(s.name)}</b><span>${K.esc(s.address)} · ${K.esc(s.district)}</span></div></div>
        <div class="kt-pop"><div class="kt-pop-addr">Destino final da rota. Os alunos são entregues na portaria principal.</div></div>`;
    }

    applyGoogle() {
      const G = this.google;
      const map = this.map;
      if (!G || !map) return;
      const d = this.data;

      /* Rota planejada */
      const route = latLngsOf(d.route).map((p) => ({ lat: p[0], lng: p[1] }));
      if (route.length > 1) {
        if (!this.gRouteHalo) {
          this.gRouteHalo = new G.Polyline({
            map, path: route, strokeColor: '#ffffff', strokeOpacity: 0.9,
            strokeWeight: 10, zIndex: 1, clickable: false
          });
          this.gRoute = new G.Polyline({
            map, path: route, strokeColor: '#1265E8', strokeOpacity: 0.95,
            strokeWeight: 5, zIndex: 2, clickable: false
          });
        } else {
          this.gRouteHalo.setPath(route);
          this.gRoute.setPath(route);
          this.gRouteHalo.setMap(map);
          this.gRoute.setMap(map);
        }
      } else if (this.gRouteHalo) {
        this.gRouteHalo.setMap(null);
        this.gRoute.setMap(null);
        this.gRouteHalo = null;
        this.gRoute = null;
      }

      /* Trecho percorrido */
      const traveled = latLngsOf(d.traveled).map((p) => ({ lat: p[0], lng: p[1] }));
      if (traveled.length > 1) {
        if (!this.gTraveled) {
          this.gTraveled = new G.Polyline({
            map, path: traveled, strokeColor: '#159B5B', strokeOpacity: 1,
            strokeWeight: 5, zIndex: 3, clickable: false
          });
        } else {
          this.gTraveled.setPath(traveled);
          this.gTraveled.setMap(map);
        }
      } else if (this.gTraveled) {
        this.gTraveled.setMap(null);
        this.gTraveled = null;
      }

      /* Alunos */
      const seen = {};
      (d.students || []).forEach((s, index) => {
        const p = coord(s);
        if (!p) return;
        seen[s.id] = true;
        const isNext = s.status === 'next' || s.id === d.nextId;
        const color = s.status === 'picked' ? '#159B5B' : s.status === 'issue' ? '#E5484D' : isNext ? '#1265E8' : '#93A0B3';
        const icon = this.gIcon('student', index + 1, color);
        const pos = { lat: p[0], lng: p[1] };
        let marker = this.markers[s.id];
        if (!marker) {
          marker = new G.Marker({
            position: pos, map, icon, title: s.name,
            zIndex: isNext ? 500 : 100, optimized: false
          });
          marker.addListener('click', () => {
            if (this.opts.onStudentClick) this.opts.onStudentClick(s.id);
            this.openStudent(s.id);
          });
          this.markers[s.id] = marker;
        } else {
          marker.setPosition(pos);
          marker.setIcon(icon);
          marker.setTitle(s.name);
          marker.setZIndex(isNext ? 500 : 100);
          marker.setMap(map);
        }
        marker.__ktHtml = popupHtml(s, index);
      });
      Object.keys(this.markers).forEach((id) => {
        if (!seen[id]) {
          this.markers[id].setMap(null);
          delete this.markers[id];
        }
      });

      /* Escola */
      const schoolPoint = coord(d.school);
      if (schoolPoint) {
        const pos = { lat: schoolPoint[0], lng: schoolPoint[1] };
        if (!this.gSchool) {
          this.gSchool = new G.Marker({
            position: pos, map, icon: this.gIcon('school', '', '#071629'),
            title: d.school.name, zIndex: 300, optimized: false
          });
          this.gSchool.addListener('click', () => this.openSchool());
        } else {
          this.gSchool.setPosition(pos);
          this.gSchool.setMap(map);
        }
        this.gSchool.__ktHtml = this.schoolPopup();
      } else if (this.gSchool) {
        this.gSchool.setMap(null);
        this.gSchool = null;
      }

      /* Perua */
      const vanPoint = coord(d.van);
      if (vanPoint) {
        const pos = { lat: vanPoint[0], lng: vanPoint[1] };
        if (!this.gVan) {
          this.gVan = new G.Marker({
            position: pos, map, icon: this.gIcon('van', '', '#1265E8'),
            title: 'Perua escolar', zIndex: 900, clickable: false, optimized: false
          });
        } else {
          this.gVan.setPosition(pos);
          this.gVan.setMap(map);
        }
      } else if (this.gVan) {
        this.gVan.setMap(null);
        this.gVan = null;
      }

      if (d.fit) {
        this.fit();
        this.data.fit = false;
      }
    }

    openSchool() {
      if (this.backend !== 'google' || !this.gSchool || !this.gInfo) return;
      this.gInfo.setContent(this.gSchool.__ktHtml || '');
      this.gInfo.open({ anchor: this.gSchool, map: this.map });
    }

    studentIcon(s, index, isNext) {
      const L = this.L;
      const status = isNext ? 'next' : s.status;
      const cls = status === 'picked' ? 'picked' : status === 'issue' ? 'issue' : status === 'next' ? 'next' : 'waiting';
      return L.divIcon({
        className: 'kt-marker',
        html: `<div class="kt-pin ${cls}"><span>${index + 1}</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 30],
        popupAnchor: [0, -28]
      });
    }

    schoolIcon() {
      const L = this.L;
      return L.divIcon({
        className: 'kt-marker',
        html: `<div class="kt-pin school-pin"><span>${K.icon('school')}</span></div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 34],
        popupAnchor: [0, -32]
      });
    }

    vanIcon() {
      const L = this.L;
      return L.divIcon({
        className: 'kt-marker',
        html: `<div class="kt-van">${K.icon('van')}</div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
    }

    /* Sincroniza dados -> mapa */
    applyData() {
      if (this.backend === 'google') this.applyGoogle();
      else if (this.backend === 'leaflet') this.applyLeaflet();
      else if (this.backend === 'svg') this.applySvg();
    }

    applyLeaflet() {
      const L = this.L;
      const map = this.map;
      if (!map) return;
      const d = this.data;

      /* Rota planejada */
      this.layers.routeHalo.clearLayers();
      this.layers.route.clearLayers();
      const routeLatLngs = latLngsOf(d.route);
      if (routeLatLngs.length > 1) {
        L.polyline(routeLatLngs, { color: '#ffffff', weight: 10, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(this.layers.routeHalo);
        L.polyline(routeLatLngs, {
          color: '#1265E8', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round',
          dashArray: d.routeApprox ? '1 8' : null
        }).addTo(this.layers.route);
      }

      /* Trecho percorrido */
      this.layers.traveled.clearLayers();
      const traveledLatLngs = latLngsOf(d.traveled);
      if (traveledLatLngs.length > 1) {
        L.polyline(traveledLatLngs, {
          color: '#159B5B', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round'
        }).addTo(this.layers.traveled);
      }

      /* Alunos */
      const seen = {};
      (d.students || []).forEach((s, index) => {
        if (!s || s.lat == null || s.lng == null) return;
        seen[s.id] = true;
        const isNext = s.status === 'next' || s.id === d.nextId;
        let marker = this.markers[s.id];
        if (!marker) {
          marker = L.marker([s.lat, s.lng], {
            icon: this.studentIcon(s, index, isNext),
            riseOnHover: true,
            title: s.name
          }).addTo(this.layers.students);
          marker.bindPopup(popupHtml(s, index), { closeButton: true, offset: [0, 0] });
          this.markers[s.id] = marker;
        } else {
          marker.setLatLng([s.lat, s.lng]);
          marker.setIcon(this.studentIcon(s, index, isNext));
          marker.setPopupContent(popupHtml(s, index));
        }
        marker.setZIndexOffset(isNext ? 500 : 0);
      });
      Object.keys(this.markers).forEach((id) => {
        if (!seen[id]) { this.map.removeLayer(this.markers[id]); delete this.markers[id]; }
      });

      /* Escola */
      this.layers.school.clearLayers();
      const schoolPoint = coord(d.school);
      if (schoolPoint) {
        const marker = L.marker(schoolPoint, {
          icon: this.schoolIcon(), title: d.school.name, zIndexOffset: 300
        }).addTo(this.layers.school);
        marker.bindPopup(`
          <div class="kt-pop-school">${K.icon('school')}<div><b>${K.esc(d.school.name)}</b><span>${K.esc(d.school.address)} · ${K.esc(d.school.district)}</span></div></div>
          <div class="kt-pop"><div class="kt-pop-addr">Destino final da rota. Os alunos são entregues na portaria principal.</div></div>
        `);
      }

      /* Perua */
      this.layers.van.clearLayers();
      const vanPoint = coord(d.van);
      if (vanPoint) {
        const marker = L.marker(vanPoint, {
          icon: this.vanIcon(), zIndexOffset: 900, title: 'Perua escolar', interactive: false
        }).addTo(this.layers.van);
        this.vanMarker = marker;
      }

      if (d.fit) {
        this.fit();
        this.data.fit = false;
      }
    }

    fit() {
      if (!this.map) return;
      const pts = [];
      (this.data.route || []).forEach((p) => { const c = coord(p); if (c) pts.push(c); });
      (this.data.students || []).forEach((s) => { const c = coord(s); if (c) pts.push(c); });
      const schoolPt = coord(this.data.school);
      if (schoolPt) pts.push(schoolPt);
      const vanPt = coord(this.data.van);
      if (vanPt) pts.push(vanPt);
      if (!pts.length) return;

      if (this.backend === 'google') {
        const G = this.google;
        if (!G) return;
        try {
          if (pts.length === 1) {
            this.map.setCenter({ lat: pts[0][0], lng: pts[0][1] });
            this.map.setZoom(15);
          } else {
            const bounds = new G.LatLngBounds();
            pts.forEach((p) => bounds.extend({ lat: p[0], lng: p[1] }));
            this.map.fitBounds(bounds, { top: 42, right: 42, bottom: 42, left: 42 });
            const map = this.map;
            G.event.addListenerOnce(map, 'bounds_changed', () => {
              if (!this.destroyed && this.map === map && map.getZoom() > 16) map.setZoom(16);
            });
          }
        } catch (e) { /* ignore */ }
        return;
      }

      if (this.backend !== 'leaflet') return;
      try {
        if (pts.length === 1) this.map.setView(pts[0], 15);
        else this.map.fitBounds(pts, { padding: [42, 42], maxZoom: 16 });
      } catch (e) { /* ignore */ }
    }

    /* ---------- SVG fallback ---------- */
    setupSvg() {
      this.backend = 'svg';
      this.el.innerHTML = '';
      this.svgWrap = document.createElement('div');
      this.svgWrap.className = 'svgmap';
      this.el.appendChild(this.svgWrap);
      this.applySvg();
    }

    applySvg() {
      if (!this.svgWrap) return;
      const d = this.data;
      const W = 1000;
      const H = 700;
      const valid = (p) => !!coord(p);
      const route = (d.route || []).filter(valid);
      const traveled = (d.traveled || []).filter(valid);
      const pts = route.slice();
      (d.students || []).forEach((s) => { if (valid(s)) pts.push(s); });
      if (valid(d.school)) pts.push(d.school);
      if (valid(d.van)) pts.push(d.van);
      if (!pts.length) { this.svgWrap.innerHTML = ''; return; }

      const lats = pts.map((p) => p.lat);
      const lngs = pts.map((p) => p.lng);
      let minLat = Math.min.apply(null, lats);
      let maxLat = Math.max.apply(null, lats);
      let minLng = Math.min.apply(null, lngs);
      let maxLng = Math.max.apply(null, lngs);
      const padLat = Math.max((maxLat - minLat) * 0.22, 0.004);
      const padLng = Math.max((maxLng - minLng) * 0.22, 0.004);
      minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;

      const midLat = (minLat + maxLat) / 2;
      const cos = Math.cos((midLat * Math.PI) / 180);
      const xSpan = (maxLng - minLng) * cos;
      const ySpan = maxLat - minLat;
      const scale = Math.min(W / xSpan, H / ySpan);
      const offX = (W - xSpan * scale) / 2;
      const offY = (H - ySpan * scale) / 2;
      const project = (p) => ({
        x: offX + (p.lng - minLng) * cos * scale,
        y: offY + (maxLat - p.lat) * scale
      });

      const pathOf = (list) => list.map((p, i) => {
        const q = project(p);
        return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
      }).join(' ');

      const routeD = route.length > 1 ? pathOf(route) : '';
      const traveledD = traveled.length > 1 ? pathOf(traveled) : '';

      const grid = [];
      for (let x = 40; x < W; x += 80) grid.push(`<line class="grid-line" x1="${x}" y1="0" x2="${x}" y2="${H}"/>`);
      for (let y = 40; y < H; y += 80) grid.push(`<line class="grid-line" x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);

      const streets = [
        `<path class="road" d="M-20 210 C 180 180, 300 260, 520 240 S 820 180, 1020 220"/>`,
        `<path class="road" d="M-20 520 C 220 500, 380 560, 640 520 S 880 470, 1020 500"/>`,
        `<path class="road" d="M250 -20 C 270 180, 220 320, 300 500 S 360 640, 340 720"/>`,
        `<path class="road" d="M720 -20 C 700 160, 760 300, 700 480 S 650 640, 690 720"/>`,
        `<path class="road-thin" d="M0 360 C 240 340, 420 400, 620 370 S 860 330, 1000 360"/>`,
        `<path class="road-thin" d="M480 -10 C 470 200, 520 420, 500 710"/>`
      ].join('');

      const markerNodes = [];
      (d.students || []).forEach((s, index) => {
        if (!valid(s)) return;
        const p = project(s);
        const isNext = s.status === 'next' || s.id === d.nextId;
        const fill = s.status === 'picked' ? '#159B5B' : s.status === 'issue' ? '#E5484D' : isNext ? '#1265E8' : '#93A0B3';
        const r = isNext ? 19 : 16;
        markerNodes.push(`
          <g class="svg-student" data-student="${s.id}" style="cursor:pointer">
            ${isNext ? `<circle cx="${p.x}" cy="${p.y}" r="${r + 9}" fill="#1265E8" opacity=".16"/>` : ''}
            <circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="3"/>
            <text x="${p.x}" y="${p.y + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans, sans-serif">${index + 1}</text>
            ${isNext ? `<text class="m-label" x="${p.x}" y="${p.y - r - 10}" text-anchor="middle">${K.esc(K.fmt.firstName(s.name))}</text>` : ''}
          </g>`);
      });

      let schoolNode = '';
      if (valid(d.school)) {
        const p = project(d.school);
        schoolNode = `
          <g>
            <rect x="${p.x - 20}" y="${p.y - 20}" width="40" height="40" rx="13" fill="#071629" stroke="#fff" stroke-width="3"/>
            <text x="${p.x}" y="${p.y + 6}" text-anchor="middle" font-size="18" fill="#fff">🏫</text>
            <text class="m-label" x="${p.x}" y="${p.y + 36}" text-anchor="middle">${K.esc(d.school.name)}</text>
          </g>`;
      }

      let vanNode = '';
      if (valid(d.van)) {
        const p = project(d.van);
        vanNode = `
          <g>
            <circle cx="${p.x}" cy="${p.y}" r="26" fill="#1265E8" opacity=".16"/>
            <rect x="${p.x - 19}" y="${p.y - 19}" width="38" height="38" rx="12" fill="#1265E8" stroke="#fff" stroke-width="3"/>
            <text x="${p.x}" y="${p.y + 7}" text-anchor="middle" font-size="18" fill="#fff">🚐</text>
          </g>`;
      }

      this.svgWrap.innerHTML = `
        <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%">
          <rect width="${W}" height="${H}" fill="#EAF0F8"/>
          <g>${grid.join('')}</g>
          <g>${streets}</g>
          ${routeD ? `<path class="route-halo" d="${routeD}"/><path class="route-line" d="${routeD}" ${d.routeApprox ? 'stroke-dasharray="2 10"' : ''}/>` : ''}
          ${traveledD ? `<path class="route-done" d="${traveledD}"/>` : ''}
          ${schoolNode}
          ${markerNodes.join('')}
          ${vanNode}
        </svg>
        <div class="svgmap-note"><span class="map-chip">${K.icon('map')}Mapa esquemático · sem conexão com o serviço de mapas</span></div>`;

      this.svgWrap.querySelectorAll('.svg-student').forEach((node) => {
        node.addEventListener('click', () => {
          if (this.opts.onStudentClick) this.opts.onStudentClick(node.getAttribute('data-student'));
        });
      });
    }

    /* ---------- API pública ---------- */
    async setData(data) {
      await this.initPromise;
      if (this.destroyed) return;
      this.data = Object.assign({}, this.data, data || {});
      this.applyData();
    }

    async setVan(van) {
      if (this.destroyed) return;
      this.data.van = van;
      if (this.backend === 'google' && this.map) {
        const point = coord(van);
        if (this.gVan && point) this.gVan.setPosition({ lat: point[0], lng: point[1] });
        else this.applyGoogle();
      } else if (this.backend === 'leaflet' && this.map) {
        const point = coord(van);
        if (this.vanMarker && point) this.vanMarker.setLatLng(point);
        else this.applyLeaflet();
      } else if (this.backend === 'svg') {
        this.applySvg();
      }
    }

    async setTraveled(traveled) {
      if (this.destroyed) return;
      this.data.traveled = traveled || [];
      if (this.backend === 'google' && this.map) {
        const traveledLatLngs = latLngsOf(this.data.traveled).map((p) => ({ lat: p[0], lng: p[1] }));
        if (traveledLatLngs.length > 1) {
          if (!this.gTraveled) {
            this.gTraveled = new this.google.Polyline({
              map: this.map, path: traveledLatLngs, strokeColor: '#159B5B',
              strokeOpacity: 1, strokeWeight: 5, zIndex: 3, clickable: false
            });
          } else {
            this.gTraveled.setPath(traveledLatLngs);
            this.gTraveled.setMap(this.map);
          }
        } else if (this.gTraveled) {
          this.gTraveled.setMap(null);
          this.gTraveled = null;
        }
      } else if (this.backend === 'leaflet' && this.map) {
        this.layers.traveled.clearLayers();
        const traveledLatLngs = latLngsOf(this.data.traveled);
        if (traveledLatLngs.length > 1) {
          this.L.polyline(traveledLatLngs, {
            color: '#159B5B', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round'
          }).addTo(this.layers.traveled);
        }
      } else if (this.backend === 'svg') {
        this.applySvg();
      }
    }

    async setFit(flag) {
      if (this.destroyed) return;
      this.data.fit = !!flag;
      if (this.data.fit) this.fit();
    }

    fitNow() { if (!this.destroyed) this.fit(); }

    openStudent(id) {
      if (this.destroyed) return;
      if (this.backend === 'google' && this.map && this.markers[id]) {
        const marker = this.markers[id];
        const pos = marker.getPosition();
        if (pos) {
          this.map.setCenter(pos);
          if (this.map.getZoom() < 15) this.map.setZoom(15);
        }
        if (this.gInfo) {
          this.gInfo.setContent(marker.__ktHtml || '');
          this.gInfo.open({ anchor: marker, map: this.map });
        }
      } else if (this.backend === 'leaflet' && this.map && this.markers[id]) {
        const marker = this.markers[id];
        this.map.setView(marker.getLatLng(), Math.max(this.map.getZoom(), 15), { animate: true });
        marker.openPopup();
      } else if (this.backend === 'svg' && this.opts.onStudentClick) {
        this.opts.onStudentClick(id);
      }
    }

    invalidate() {
      if (this.destroyed) return;
      if (this.backend === 'google' && this.map && this.google) {
        try { this.google.event.trigger(this.map, 'resize'); } catch (e) { /* ignore */ }
      } else if (this.backend === 'leaflet' && this.map) {
        const map = this.map;
        setTimeout(() => {
          if (!this.destroyed && this.map === map) {
            try { map.invalidateSize(); } catch (e) { /* ignore */ }
          }
        }, 120);
      } else if (this.backend === 'svg') this.applySvg();
    }

    destroy() {
      this.destroyed = true;
      if (this.backend === 'google') {
        try {
          Object.keys(this.markers).forEach((id) => {
            const m = this.markers[id];
            if (m && m.setMap) m.setMap(null);
          });
          [this.gRoute, this.gRouteHalo, this.gTraveled, this.gSchool, this.gVan].forEach((l) => {
            if (l && l.setMap) l.setMap(null);
          });
          if (this.gInfo) this.gInfo.close();
        } catch (e) { /* ignore */ }
        this.gRoute = this.gRouteHalo = this.gTraveled = this.gSchool = this.gVan = null;
        this.gInfo = null;
        this.google = null;
        this.map = null;
      }
      if (this.backend === 'leaflet' && this.map) {
        try {
          /* Evita que o callback de transição de zoom do Leaflet dispare
             depois que o mapa foi removido do DOM (erro _leaflet_pos). */
          this.map._animatingZoom = false;
          if (this.map._panAnim) this.map._panAnim.stop();
          this.map.remove();
        } catch (e) { /* ignore */ }
        this.map = null;
      }
      this.vanMarker = null;
      this.markers = {};
      this.layers = {};
      if (this.el) this.el.innerHTML = '';
    }
  }

  K.MapView = MapView;
  K.loadLeaflet = loadLeaflet;
})(window.KT);
