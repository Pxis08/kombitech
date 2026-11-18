/* ==========================================================================
   KombiTech — Serviços externos (geocodificação e roteirização)
   Todas as chamadas falham de forma silenciosa e retornam fallback local,
   para que o modo de demonstração continue funcionando sem internet.
   ========================================================================== */
(function (K) {
  'use strict';

  const cfg = K.config;

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }

  /* ---------- Geocodificação (Nominatim / OpenStreetMap) ---------- */
  async function geocode(query) {
    if (!cfg.maps.geocoding.enabled || !query || !navigator.onLine) return null;
    const url = `${cfg.maps.geocoding.nominatimUrl}/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
    try {
      const res = await withTimeout(fetch(url, { headers: { Accept: 'application/json' } }), cfg.maps.geocoding.timeoutMs);
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return null;
      const hit = data[0];
      return {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        label: hit.display_name,
        approx: false
      };
    } catch (e) {
      return null;
    }
  }

  /* Fallback determinístico: posiciona o aluno próximo ao centro da cidade
     para que a demonstração continue utilizável sem internet. */
  function fallbackPoint(seed, center) {
    const base = center || { lat: -23.5886, lng: -46.6345 };
    let hash = 0;
    const str = String(seed || 'kombi');
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    const rnd = (n) => {
      const x = Math.sin(hash * (n + 1) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      lat: +(base.lat + (rnd(1) - 0.5) * 0.026).toFixed(6),
      lng: +(base.lng + (rnd(2) - 0.5) * 0.03).toFixed(6),
      approx: true
    };
  }

  /* ---------- Roteirização (OSRM) ---------- */
  async function fetchRoute(points) {
    if (!Array.isArray(points) || points.length < 2) {
      return { ok: false, coords: points || [], distance: 0, duration: 0, approx: true };
    }
    const fallback = {
      ok: false,
      coords: points.map((p) => ({ lat: p.lat, lng: p.lng })),
      distance: K.geo.pathDistance(points),
      duration: 0,
      approx: true
    };
    if (!cfg.maps.routing.enabled || !navigator.onLine) return fallback;

    const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const db = K.store && K.store.get ? K.store.get() : null;
    const stored = db && db.settings && db.settings.integrations && db.settings.integrations.osrmUrl;
    const baseUrl = String(stored || cfg.maps.routing.osrmBaseUrl || '').replace(/\/+$/, '');
    const url = `${baseUrl}/route/v1/${cfg.maps.routing.profile}/${coords}?overview=full&geometries=geojson&steps=false`;
    try {
      const res = await withTimeout(fetch(url), cfg.maps.routing.timeoutMs);
      if (!res.ok) return fallback;
      const data = await res.json();
      if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) return fallback;
      const route = data.routes[0];
      const geometry = route.geometry.coordinates.map((c) => ({ lat: c[1], lng: c[0] }));
      if (geometry.length < 2) return fallback;
      return {
        ok: true,
        coords: geometry,
        distance: route.distance || K.geo.pathDistance(geometry),
        duration: route.duration || 0,
        approx: false
      };
    } catch (e) {
      return fallback;
    }
  }

  /* Ordena paradas com heurística do vizinho mais próximo.
     start = posição atual da perua / garagem. */
  function optimizeOrder(start, stops) {
    const remaining = stops.slice();
    const ordered = [];
    let current = start || (remaining[0] ? { lat: remaining[0].lat, lng: remaining[0].lng } : null);
    while (remaining.length) {
      let bestIndex = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = K.geo.haversine(current, remaining[i]);
        if (d < bestDist) { bestDist = d; bestIndex = i; }
      }
      const next = remaining.splice(bestIndex, 1)[0];
      ordered.push(next);
      current = next;
    }
    return ordered;
  }

  K.services = { geocode, fetchRoute, optimizeOrder, fallbackPoint, withTimeout };
})(window.KT);
