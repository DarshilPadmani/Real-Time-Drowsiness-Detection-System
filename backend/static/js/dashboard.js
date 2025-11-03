/* global L, io */

// Socket connection
const socket = io();

// State
let totalAlerts = 0;
let todayAlerts = 0;
const activeDriverIds = new Set();
const driverMarkers = new Map(); // driver_id -> marker

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
  li.innerHTML = `
    <div class="alert-row">
      <div class="alert-badge ${payload.status.toLowerCase()}">${payload.status}</div>
      <div class="alert-body">
        <div><strong>Driver:</strong> ${payload.driver_id}</div>
        <div><strong>Location:</strong> ${payload.latitude.toFixed(5)}, ${payload.longitude.toFixed(5)}</div>
      </div>
      <div class="alert-time">${new Date(payload.timestamp).toLocaleString()}</div>
    </div>
  `;
  alertListEl.prepend(li);
}

// Map setup
const map = L.map('map', { zoomControl: true }).setView([20.5937, 78.9629], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// Tollbooth sample markers (replace with API later if needed)
const tollbooths = [
  { name: 'Toll 1', coords: [23.2156, 72.6369] },
  { name: 'Toll 2', coords: [19.076, 72.8777] },
];
const tollIcon = L.divIcon({ className: 'toll-marker', html: '<div class="toll"></div>', iconSize: [16, 16] });
tollbooths.forEach(tb => {
  L.marker(tb.coords, { icon: tollIcon }).addTo(map).bindPopup(`<b>${tb.name}</b>`);
});

// Driver alert marker icon (blinking red)
function createBlinkingIcon() {
  return L.divIcon({ className: 'blink-marker', html: '<div class="blink"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
}

function focusMap(lat, lng) {
  map.setView([lat, lng], Math.max(map.getZoom(), 13), { animate: true });
}

function updateMap(payload) {
  const { driver_id, latitude, longitude } = payload;
  const existing = driverMarkers.get(driver_id);
  if (existing) {
    existing.setLatLng([latitude, longitude]);
  } else {
    const marker = L.marker([latitude, longitude], { icon: createBlinkingIcon() })
      .addTo(map)
      .bindPopup(`<b>${driver_id}</b><br/>${payload.status}`);
    driverMarkers.set(driver_id, marker);
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

socket.on('drowsiness_alert', data => {
  addNotification(data);
  updateMap(data);
  updateCounters(data);
});



