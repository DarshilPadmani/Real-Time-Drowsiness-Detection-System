/* global L, io */

// Socket connection
const socket = io();

// State
let totalAlerts = 0;
let todayAlerts = 0;
const activeDriverIds = new Set();
const driverMarkers = new Map(); // driver_id -> marker
const driverTracks = new Map(); // driver_id -> polyline

// Helpers: DOM
const totalEl = document.getElementById('total-count');
const todayEl = document.getElementById('today-count');
const activeEl = document.getElementById('active-count');
const alertListEl = document.getElementById('alert-list');

function isToday(isoString) {
  const now = new Date();
  const dt = new Date(isoString);
  return (
    dt.getUTCFullYear() === now.getUTCFullYear() &&
    dt.getUTCMonth() === now.getUTCMonth() &&
    dt.getUTCDate() === now.getUTCDate()
  );
}

function updateCounters(payload) {
  totalAlerts += 1;
  if (isToday(payload.timestamp)) {
    todayAlerts += 1;
  }
  activeDriverIds.add(payload.driver_id);

  totalEl.textContent = String(totalAlerts);
  todayEl.textContent = String(todayAlerts);
  activeEl.textContent = String(activeDriverIds.size);
}

function addNotification(payload) {
  const li = document.createElement('li');
  li.className = 'alert-item';

  // build details block
  const details = [];
  if (payload.nearest_toll) details.push(`<div><strong>Nearest Toll:</strong> ${payload.nearest_toll.name} (${(payload.distance_km || 0).toFixed(2)} km)</div>`);
  if (payload.details && Object.keys(payload.details).length) details.push(`<div><strong>Details:</strong> ${JSON.stringify(payload.details)}</div>`);

  const statusClass = (payload.status || '').toString().toLowerCase();
  // format timestamp
  function fmt(ts) { try { return new Date(ts).toLocaleString(); } catch (e) { return ts || ''; } }
  const tsText = payload.timestamp ? fmt(payload.timestamp) : fmt(new Date().toISOString());
  // Build nearest toll block if available
  let tollHtml = '';
  if (payload.nearest_toll) {
    tollHtml = `<div class="nearest-toll">Nearest: <strong>${payload.nearest_toll.name}</strong> ${payload.distance_km ? '(' + payload.distance_km.toFixed(2) + ' km)' : ''}</div>`;
  }

  // determine location display (treat 0,0 or location_unknown as unknown)
  let locDisplay = 'unknown';
  try {
    const latNum = parseFloat(payload.latitude);
    const lonNum = parseFloat(payload.longitude);
    if (!payload.location_unknown && Number.isFinite(latNum) && Number.isFinite(lonNum) && !(latNum === 0 && lonNum === 0)) {
      locDisplay = `${latNum.toFixed(6)}, ${lonNum.toFixed(6)}`;
    }
  } catch (e) { }

  li.innerHTML = `
    <div class="alert-row">
      <div class="alert-badge ${statusClass}">${payload.status || 'ALERT'}</div>
      <div class="alert-body">
        <div class="alert-driver"><strong>Driver:</strong> ${payload.driver_id}</div>
        <div class="alert-loc"><strong>Location:</strong> ${locDisplay}</div>
        <div class="alert-time">${tsText}</div>
        ${tollHtml}
        ${payload.confidence ? `<div class="alert-confidence">Confidence: <strong>${(payload.confidence * 100).toFixed(0)}%</strong></div>` : ''}
        ${details.join('')}
      </div>
    </div>
    <div class="alert-actions">
      <button class="btn locate-btn">Locate</button>
      <button class="btn copy-coords">Copy</button>
    </div>
  `;
  alertListEl.prepend(li);

  // animation: entry
  li.classList.add('alert-enter');
  setTimeout(() => li.classList.remove('alert-enter'), 900);

  // play a sound briefly (if available)
  try {
    // try a few known locations for an alert sound
    const candidates = ['/static/audio/alert_short.mp3', '/Alert.wav', '/static/Alert.wav'];
    (async () => {
      for (const src of candidates) {
        try {
          const a = new Audio(src);
          await a.play();
          break;
        } catch (e) { /* try next */ }
      }
    })();
  } catch (e) { }
}

// Map setup
const map = L.map('map', { zoomControl: true }).setView([20.5937, 78.9629], 5);
const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// layer groups
const driverLayer = L.markerClusterGroup({ chunkedLoading: true });
const alertLayer = L.layerGroup();
const tollLayer = L.layerGroup();
map.addLayer(driverLayer);
map.addLayer(tollLayer);
map.addLayer(alertLayer);

// Fetch tollbooths from backend API and render them
const tollIcon = L.divIcon({ className: 'toll-marker', html: '<div class="toll"></div>', iconSize: [16, 16] });
function loadTollbooths() {
  fetch('/api/tollbooths').then(r => r.json()).then(js => {
    if (!js || !Array.isArray(js.tollbooths)) return;
    js.tollbooths.forEach(tb => {
      try {
        const coords = [parseFloat(tb.latitude), parseFloat(tb.longitude)];
        const m = L.marker(coords, { icon: tollIcon }).addTo(tollLayer).bindPopup(`<b>${tb.name}</b><br/>${tb.address || ''}`);
        // attach id if needed later
        m.tollboothId = tb.id;
      } catch (e) { /* skip invalid */ }
    });
  }).catch(err => {
    console.warn('Failed to load tollbooths', err);
  });
}

// initial load
loadTollbooths();

// layer control
const overlays = {
  'Drivers': driverLayer,
  'Tollbooths': tollLayer,
  'Alerts': alertLayer,
};
L.control.layers(null, overlays, { collapsed: false }).addTo(map);

// Driver alert marker icon (blinking red)
function createBlinkingIcon() {
  return L.divIcon({ className: 'blink-marker', html: '<div class="blink"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
}

// dedicated alert icon (red pulsing dot)
function createAlertIcon() {
  return L.divIcon({ className: 'alert-marker', html: '<div class="alert-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
}

function focusMap(lat, lng) {
  map.setView([lat, lng], Math.max(map.getZoom(), 13), { animate: true });
}

function updateMap(payload) {
  const { driver_id, latitude, longitude } = payload;
  const existing = driverMarkers.get(driver_id);
  if (existing) {
    existing.setLatLng([latitude, longitude]);
    // update popup content if nearest toll present
    try {
      const nt = payload.nearest_toll ? `<br/><small>Nearest: ${payload.nearest_toll.name}${payload.distance_km ? (' (' + payload.distance_km.toFixed(2) + ' km)') : ''}</small>` : '';
      existing.bindPopup(`<b>${driver_id}</b><br/>${payload.status || ''} ${nt}`);
    } catch (e) { }
  } else {
    const marker = L.marker([latitude, longitude], { icon: createBlinkingIcon() })
      .bindPopup(`<b>${driver_id}</b><br/>${payload.status}${payload.nearest_toll ? ('<br/><small>Nearest: ' + payload.nearest_toll.name + '</small>') : ''}`);
    marker.on('click', () => {
      // fetch and draw track history for this driver
      fetch(`/api/locations?driver_id=${encodeURIComponent(driver_id)}&limit=200`).then(r => r.json()).then(js => {
        if (!js.locations) return;
        const coords = js.locations.map(l => [l.latitude, l.longitude]);
        // remove existing polyline for driver
        const existingLine = driverTracks.get(driver_id);
        if (existingLine) {
          map.removeLayer(existingLine);
        }
        if (coords.length > 0) {
          const poly = L.polyline(coords, { color: 'blue' }).addTo(map);
          driverTracks.set(driver_id, poly);
          map.fitBounds(poly.getBounds(), { maxZoom: 16 });
        }
      }).catch(console.error);
    });
    driverMarkers.set(driver_id, marker);
    driverLayer.addLayer(marker);
  }
  focusMap(latitude, longitude);
}

// Socket handlers
socket.on('connect', () => {
  document.querySelector('.status-dot').classList.add('online');
});

socket.on('disconnect', () => {
  document.querySelector('.status-dot').classList.remove('online');
});

// When a new tollbooth is added, render it on the map
socket.on('tollbooth_added', tb => {
  try {
    const coords = [parseFloat(tb.latitude), parseFloat(tb.longitude)];
    const m = L.marker(coords, { icon: tollIcon }).addTo(tollLayer).bindPopup(`<b>${tb.name}</b><br/>${tb.address || ''}`);
    // give the new toll marker a short highlight animation
    try {
      const el = m.getElement && m.getElement();
      if (el) {
        el.classList.add('toll-highlight');
        setTimeout(() => el.classList.remove('toll-highlight'), 2200);
      }
    } catch (e) { }
  } catch (e) { console.warn('invalid tollbooth', e); }
});

socket.on('drowsiness_alert', data => {
  // populate list and counters
  addNotification(data);
  updateCounters(data);

  // update or create driver marker only if we have a real numeric location
  const hasLocation = !(data.location_unknown) && Number.isFinite(parseFloat(data.latitude)) && Number.isFinite(parseFloat(data.longitude)) && !(parseFloat(data.latitude) === 0 && parseFloat(data.longitude) === 0);
  if (hasLocation) {
    updateMap(data);
  }

  // add transient alert marker to alertLayer with a detailed popup
  try {
    const lat = parseFloat(data.latitude);
    const lon = parseFloat(data.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon) && !(data.location_unknown) && !(lat === 0 && lon === 0)) {
      const am = L.marker([lat, lon], { icon: createAlertIcon() }).addTo(alertLayer);
      const pretty = `<div style="min-width:220px"><b>${data.driver_id}</b><br/><em>${data.status || ''}</em><br/><small>${data.timestamp ? new Date(data.timestamp).toLocaleString() : ''}</small><br/>${lat.toFixed(6)}, ${lon.toFixed(6)}${data.nearest_toll ? ('<br/><small>Nearest: ' + data.nearest_toll.name + '</small>') : ''}<pre style="white-space:pre-wrap;word-break:break-word;font-size:11px;margin-top:6px">${JSON.stringify(data.details || {}, null, 2)}</pre></div>`;
      am.bindPopup(pretty);
      // briefly open popup to draw attention
      try { am.openPopup(); setTimeout(() => am.closePopup(), 2200); } catch (e) { }
      // auto remove after 5 minutes
      setTimeout(() => { try { alertLayer.removeLayer(am); } catch (e) { } }, 5 * 60 * 1000);
    }
  } catch (e) { console.error('failed to add alert marker', e); }
});

// delegate locate button clicks from alert list
document.getElementById('alert-list').addEventListener('click', (ev) => {
  const locateBtn = ev.target.closest && ev.target.closest('.locate-btn');
  const copyBtn = ev.target.closest && ev.target.closest('.copy-coords');
  if (!locateBtn && !copyBtn) return;
  const li = (locateBtn || copyBtn).closest('.alert-item');
  if (!li) return;

  // extract driver id from content
  const driverMatch = li.querySelector('.alert-driver');
  const locMatch = li.querySelector('.alert-loc');
  if (!driverMatch) return;
  const txt = driverMatch.textContent || '';
  const driver = txt.replace('Driver:', '').trim();

  if (locateBtn) {
    const marker = driverMarkers.get(driver);
    if (marker) {
      const latlng = marker.getLatLng();
      focusMap(latlng.lat, latlng.lng);
      try { marker.openPopup(); } catch (e) { }
      // add bounce class to marker element
      try {
        const el = marker.getElement && marker.getElement();
        if (el) { el.classList.add('marker-bounce'); setTimeout(() => el.classList.remove('marker-bounce'), 1000); }
      } catch (e) { }
    } else {
      // no live marker yet: try to parse coords from alert item
      if (locMatch) {
        const coordsText = locMatch.textContent || '';
        const m = coordsText.match(/([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/);
        if (m) {
          const lat = parseFloat(m[1]); const lon = parseFloat(m[2]);
          focusMap(lat, lon);
        } else {
          resultToast('Location unknown');
        }
      } else {
        resultToast('Location unknown');
      }
    }
  }

  if (copyBtn) {
    // copy coords (if present) to clipboard
    if (locMatch) {
      const coordsText = locMatch.textContent || '';
      // extract only the numbers portion
      const m = coordsText.match(/([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/);
      if (m) {
        const coords = `${m[1]}, ${m[2]}`;
        try { navigator.clipboard.writeText(coords); resultToast('Coordinates copied'); } catch (e) { resultToast('Copied to clipboard failed'); }
      } else {
        resultToast('No coordinates to copy');
      }
    } else {
      resultToast('No coordinates to copy');
    }
  }
});

// tiny toast for small feedback
function resultToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg; t.style.position = 'fixed'; t.style.right = '18px'; t.style.bottom = '24px'; t.style.background = '#111'; t.style.color = 'white'; t.style.padding = '8px 12px'; t.style.border = '1px solid #333'; t.style.borderRadius = '6px'; t.style.zIndex = 9999; t.style.opacity = '0'; t.style.transition = 'opacity .2s ease, transform .2s ease'; document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(-4px)'; });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(0)'; setTimeout(() => t.remove(), 250); }, 1800);
}

// Handle live location updates (periodic location posts)
socket.on('location_update', data => {
  try {
    // data may not contain a 'status' field (it's a pure location update)
    // adapt it to the same shape used by updateMap
    const payload = {
      driver_id: data.driver_id || data.driver_id,
      latitude: data.latitude,
      longitude: data.longitude,
      status: data.status || 'LOCATION',
      timestamp: data.timestamp || new Date().toISOString(),
    };
    updateMap(payload);
    // mark driver as active
    activeDriverIds.add(payload.driver_id);
    activeEl.textContent = String(activeDriverIds.size);
  } catch (err) {
    console.error('location_update handler error', err);
  }
});



