import json
import time
import threading
from queue import Queue
from math import radians, cos, sin, asin, sqrt
from flask import Flask, request, jsonify, Response, send_from_directory, redirect, url_for
from flask_socketio import SocketIO

import detect

app = Flask(__name__, static_url_path='', static_folder='static')

# Socket.IO server (allows the existing frontend socket.io-client to connect)
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory stores
drivers_location = {}  # driver_id -> {lat, lon, ts}
alerts = []
tollbooth_notifications = []

# Simple pubsub for SSE
clients = []


def haversine(lat1, lon1, lat2, lon2):
    # return distance in kilometers
    # convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return km


def find_nearest_toll(lat, lon):
    with open('tollbooths.json', 'r', encoding='utf-8') as f:
        tolls = json.load(f)
    best = None
    best_d = None
    for t in tolls:
        d = haversine(lat, lon, t['lat'], t['lon'])
        if best is None or d < best_d:
            best = t
            best_d = d
    return best, best_d


def publish_event(data):
    msg = f"data: {json.dumps(data)}\n\n"
    for q in list(clients):
        q.put(msg)
    # also emit over Socket.IO so frontend clients using socket.io-client receive events
    try:
        # if event is an alert, emit a drowsiness_alert event for compatibility with frontend
        if isinstance(data, dict) and data.get('type') == 'alert':
            # emit the alert payload under both channel names used by frontend
            alert = data.get('alert') or data.get('notification') or data
            socketio.emit('drowsiness_alert', alert)
            socketio.emit('driver_alert', alert)
        else:
            # generic event
            socketio.emit('server_event', data)
    except Exception:
        # don't let socket issues crash the server
        pass


@app.route('/')
def index():
    return redirect(url_for('driver'))


@app.route('/driver')
def driver():
    return send_from_directory('static', 'driver.html')


@app.route('/tollbooth')
def tollbooth():
    return send_from_directory('static', 'tollbooth.html')


@app.route('/driver/location', methods=['POST'])
def driver_location():
    data = request.json
    driver_id = data.get('driver_id')
    lat = data.get('lat')
    lon = data.get('lon')
    ts = data.get('ts') or time.time()
    if not driver_id:
        return jsonify({'error': 'missing driver_id'}), 400
    drivers_location[driver_id] = {'lat': lat, 'lon': lon, 'ts': ts}
    # notify socket.io clients about location updates
    try:
        socketio.emit('location_update', {
            'driver_id': driver_id,
            'lat': lat,
            'lon': lon,
            'timestamp': ts,
            'accuracy': data.get('accuracy')
        })
    except Exception:
        pass
    return jsonify({'status': 'ok'})


@app.route('/start_detection', methods=['POST'])
def start_detection():
    data = request.json or {}
    driver_id = data.get('driver_id')
    if not driver_id:
        return jsonify({'error': 'missing driver_id'}), 400
    # start detect thread bound to driver_id
    detect.start_detection(driver_id, on_alert)
    return jsonify({'status': 'started'})


@app.route('/stop_detection', methods=['POST'])
def stop_detection():
    detect.stop_detection()
    return jsonify({'status': 'stopped'})


@app.route('/alerts/stream')
def stream():
    def gen(q: Queue):
        try:
            while True:
                msg = q.get()
                yield msg
        except GeneratorExit:
            return

    q = Queue()
    clients.append(q)
    return Response(gen(q), mimetype='text/event-stream')


def on_alert(driver_id, lat=None, lon=None, ts=None, details=None):
    """
    Called when a drowsiness alert is received.
    Can be invoked by the local detector (callback with driver_id) or by a remote device posting an alert (with lat/lon).

    Parameters:
      driver_id: str
      lat, lon: optional floats (if provided by device)
      ts: optional timestamp (seconds since epoch)
      details: optional dict with extra metadata
    """
    # prefer explicit lat/lon if provided, otherwise use last-known browser location
    info = drivers_location.get(driver_id)
    if lat is None or lon is None:
        lat = info['lat'] if info else None
        lon = info['lon'] if info else None

    if ts is None:
        ts = time.time()

    nearest = None
    dist_km = None
    if lat is not None and lon is not None:
        nearest, dist_km = find_nearest_toll(lat, lon)

    alert = {
        'driver_id': driver_id,
        'lat': lat,
        'lon': lon,
        'ts': ts,
        'alert': True,
        'nearest_toll': nearest,
        'distance_km': dist_km,
        'details': details or {}
    }
    alerts.append(alert)

    # simulate sending notification to tollbooth endpoint
    if nearest:
        notif = {
            'toll_id': nearest.get('id'),
            'toll_name': nearest.get('name'),
            'driver_id': driver_id,
            'driver_location': {'lat': lat, 'lon': lon},
            'ts': ts,
            'message': f"Drowsiness detected for Driver {driver_id}, {dist_km:.2f} km away from Tollbooth {nearest.get('name')}"
        }
    else:
        notif = {
            'toll_id': None,
            'toll_name': None,
            'driver_id': driver_id,
            'driver_location': {'lat': lat, 'lon': lon},
            'ts': ts,
            'message': f"Drowsiness detected for Driver {driver_id}, location unknown"
        }
    tollbooth_notifications.append(notif)

    # publish to SSE clients
    publish_event({'type': 'alert', 'alert': alert, 'notification': notif})



@app.route('/alert', methods=['POST'])
def receive_alert():
    """Receive an alert POST from remote detector devices (IoT) or other clients.
    Expected JSON body: { driver_id, lat?, lon?, ts?, alert: true, details?: {...} }
    """
    data = request.json or {}
    driver_id = data.get('driver_id')
    if not driver_id:
        return jsonify({'error': 'missing driver_id'}), 400

    lat = data.get('lat')
    lon = data.get('lon')
    ts = data.get('ts')
    details = data.get('details')

    # call common alert handler
    try:
        on_alert(driver_id, lat=lat, lon=lon, ts=ts, details=details)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    # run Flask dev server via Socket.IO runner (supports websocket transport via eventlet/gevent)
    socketio.run(app, host='0.0.0.0', port=5000)
