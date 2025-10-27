import json
import time
import threading
from math import radians, cos, sin, asin, sqrt
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import os
import sys

# Add the parent directory to the path to import detect module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from detect import start_detection, stop_detection

app = Flask(__name__, static_folder='../frontend/build', static_url_path='')
app.config['SECRET_KEY'] = 'drowsiness_detection_secret_key'
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory stores
drivers_location = {}  # driver_id -> {lat, lon, ts}
alerts = []
tollbooth_notifications = []
active_drivers = set()

def haversine(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance between two points on Earth (in kilometers)"""
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c  # Radius of earth in kilometers
    return km

def find_nearest_tollbooth(lat, lon):
    """Find the nearest tollbooth to given coordinates"""
    try:
        with open('data/tollbooths.json', 'r', encoding='utf-8') as f:
            tollbooths = json.load(f)
    except FileNotFoundError:
        # Fallback to default tollbooths if file doesn't exist
        tollbooths = [
            {"id": 1, "name": "Tollbooth A", "lat": 28.7041, "lon": 77.1025, "contact_endpoint": "http://tollbooth-a.example.com/alert"},
            {"id": 2, "name": "Tollbooth B", "lat": 28.5355, "lon": 77.3910, "contact_endpoint": "http://tollbooth-b.example.com/alert"},
            {"id": 3, "name": "Tollbooth C", "lat": 28.4595, "lon": 77.0266, "contact_endpoint": "http://tollbooth-c.example.com/alert"}
        ]
    
    best_tollbooth = None
    best_distance = float('inf')
    
    for tollbooth in tollbooths:
        distance = haversine(lat, lon, tollbooth['lat'], tollbooth['lon'])
        if distance < best_distance:
            best_distance = distance
            best_tollbooth = tollbooth
    
    return best_tollbooth, best_distance

def on_drowsiness_detected(driver_id):
    """Callback function when drowsiness is detected"""
    print(f"Drowsiness detected for driver {driver_id}")
    
    # Get driver's current location
    driver_location = drivers_location.get(driver_id)
    lat = driver_location['lat'] if driver_location else None
    lon = driver_location['lon'] if driver_location else None
    timestamp = time.time()
    
    # Find nearest tollbooth
    nearest_tollbooth = None
    distance_km = None
    
    if lat is not None and lon is not None:
        nearest_tollbooth, distance_km = find_nearest_tollbooth(lat, lon)
    
    # Create alert data
    alert_data = {
        'driver_id': driver_id,
        'timestamp': timestamp,
        'location': {
            'lat': lat,
            'lon': lon
        },
        'nearest_tollbooth': nearest_tollbooth,
        'distance_km': distance_km,
        'alert_type': 'drowsiness_detected'
    }
    
    # Store alert
    alerts.append(alert_data)
    
    # Create tollbooth notification
    if nearest_tollbooth:
        notification = {
            'tollbooth_id': nearest_tollbooth['id'],
            'tollbooth_name': nearest_tollbooth['name'],
            'driver_id': driver_id,
            'driver_location': {'lat': lat, 'lon': lon},
            'timestamp': timestamp,
            'distance_km': distance_km,
            'message': f"Drowsiness detected for Driver {driver_id} at {lat:.6f}, {lon:.6f}. Distance: {distance_km:.2f} km from {nearest_tollbooth['name']}"
        }
        tollbooth_notifications.append(notification)
        
        # Simulate sending notification to tollbooth endpoint
        print(f"ALERT SENT TO TOLLBOOTH: {nearest_tollbooth['name']}")
        print(f"Message: {notification['message']}")
    
    # Emit real-time alert to all connected clients
    socketio.emit('drowsiness_alert', alert_data)
    
    # Emit specific alert to driver
    socketio.emit('driver_alert', alert_data, room=f'driver_{driver_id}')

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('connected', {'message': 'Connected to drowsiness detection system'})

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join_driver_room')
def handle_join_driver_room(data):
    driver_id = data.get('driver_id')
    if driver_id:
        active_drivers.add(driver_id)
        join_room(f'driver_{driver_id}')
        emit('joined_room', {'driver_id': driver_id})

@socketio.on('leave_driver_room')
def handle_leave_driver_room(data):
    driver_id = data.get('driver_id')
    if driver_id:
        active_drivers.discard(driver_id)
        leave_room(f'driver_{driver_id}')
        emit('left_room', {'driver_id': driver_id})

# REST API endpoints
@app.route('/')
def serve_react_app():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/location/update', methods=['POST'])
def update_location():
    """Update driver's location"""
    data = request.json
    driver_id = data.get('driver_id')
    lat = data.get('lat')
    lon = data.get('lon')
    timestamp = data.get('timestamp', time.time())
    
    if not driver_id or lat is None or lon is None:
        return jsonify({'error': 'Missing required fields: driver_id, lat, lon'}), 400
    
    drivers_location[driver_id] = {
        'lat': lat,
        'lon': lon,
        'timestamp': timestamp
    }
    
    # Emit location update to all clients
    socketio.emit('location_update', {
        'driver_id': driver_id,
        'lat': lat,
        'lon': lon,
        'timestamp': timestamp
    })
    
    return jsonify({'status': 'success', 'message': 'Location updated'})

@app.route('/api/detection/start', methods=['POST'])
def start_drowsiness_detection():
    """Start drowsiness detection for a driver"""
    data = request.json
    driver_id = data.get('driver_id')
    webcam_index = data.get('webcam_index', 0)
    
    if not driver_id:
        return jsonify({'error': 'Missing driver_id'}), 400
    
    try:
        start_detection(driver_id, on_drowsiness_detected, webcam_index)
        active_drivers.add(driver_id)
        return jsonify({'status': 'success', 'message': f'Detection started for driver {driver_id}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/detection/stop', methods=['POST'])
def stop_drowsiness_detection():
    """Stop drowsiness detection"""
    try:
        stop_detection()
        active_drivers.clear()
        return jsonify({'status': 'success', 'message': 'Detection stopped'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tollbooth/nearest', methods=['POST'])
def get_nearest_tollbooth():
    """Get nearest tollbooth to given coordinates"""
    data = request.json
    lat = data.get('lat')
    lon = data.get('lon')
    
    if lat is None or lon is None:
        return jsonify({'error': 'Missing lat or lon'}), 400
    
    tollbooth, distance = find_nearest_tollbooth(lat, lon)
    
    return jsonify({
        'tollbooth': tollbooth,
        'distance_km': distance
    })

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Get all alerts"""
    return jsonify({'alerts': alerts})

@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    """Get all tollbooth notifications"""
    return jsonify({'notifications': tollbooth_notifications})

@app.route('/api/drivers/active', methods=['GET'])
def get_active_drivers():
    """Get list of active drivers"""
    return jsonify({'active_drivers': list(active_drivers)})

@app.route('/api/test/alert', methods=['POST'])
def test_alert():
    """Test alert functionality"""
    data = request.json
    driver_id = data.get('driver_id', 'test_driver')
    
    # Simulate drowsiness detection
    on_drowsiness_detected(driver_id)
    
    return jsonify({'status': 'success', 'message': 'Test alert triggered'})

if __name__ == '__main__':
    # Create data directory if it doesn't exist
    os.makedirs('data', exist_ok=True)
    
    # Run the application
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

