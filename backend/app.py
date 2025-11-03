from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
from flask_socketio import SocketIO
from models import db, Alert, Location, User, Tollbooth
from werkzeug.security import generate_password_hash, check_password_hash
from flask import session


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")

    app.config["SECRET_KEY"] = "change-this-secret"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///alerts.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    CORS(app)
    db.init_app(app)

    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

    # Ensure DB exists
    with app.app_context():
        db.create_all()

    @app.route("/")
    def index():
        return redirect(url_for("dashboard"))

    @app.post('/signup')
    def signup():
        # support JSON API and form POST from HTML
        if request.is_json:
            try:
                data = request.get_json(force=True) or {}
            except Exception:
                return jsonify({'error': 'invalid json'}), 400
            username = data.get('username')
            password = data.get('password')
        else:
            username = request.form.get('username')
            password = request.form.get('password')
        if not username or not password:
            if request.is_json:
                return jsonify({'error': 'username and password required'}), 400
            return render_template('signup.html', error='username and password required')
        # check existing user
        if db.session.query(User).filter_by(username=username).first():
            if request.is_json:
                return jsonify({'error': 'username exists'}), 400
            return render_template('signup.html', error='username exists')
        u = User(username=username, password_hash=generate_password_hash(password))
        db.session.add(u)
        db.session.commit()
        session['user_id'] = u.id
        if request.is_json:
            return jsonify({'success': True, 'username': u.username}), 201
        # form submission -> redirect to dashboard
        return redirect(url_for('dashboard'))

    @app.post('/login')
    def login():
        # support JSON API and form POST
        if request.is_json:
            try:
                data = request.get_json(force=True) or {}
            except Exception:
                return jsonify({'error': 'invalid json'}), 400
            username = data.get('username')
            password = data.get('password')
        else:
            username = request.form.get('username')
            password = request.form.get('password')
        if not username or not password:
            if request.is_json:
                return jsonify({'error': 'username and password required'}), 400
            return render_template('login.html', error='username and password required')
        user = db.session.query(User).filter_by(username=username).first()
        if not user or not check_password_hash(user.password_hash, password):
            if request.is_json:
                return jsonify({'error': 'invalid credentials'}), 401
            return render_template('login.html', error='invalid credentials')
        session['user_id'] = user.id
        if request.is_json:
            return jsonify({'success': True, 'username': user.username}), 200
        return redirect(url_for('dashboard'))

    @app.get('/logout')
    def logout():
        session.pop('user_id', None)
        return redirect(url_for('dashboard'))

    @app.get('/me')
    def me():
        uid = session.get('user_id')
        if not uid:
            return jsonify({'authenticated': False}), 200
        user = db.session.get(User, uid)
        if not user:
            return jsonify({'authenticated': False}), 200
        return jsonify({'authenticated': True, 'username': user.username}), 200

    # simple login required decorator
    from functools import wraps

    def login_required(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not session.get('user_id'):
                return redirect(url_for('login', next=request.path))
            return f(*args, **kwargs)
        return wrapper

    @app.route("/dashboard")
    def dashboard():
        return render_template("dashboard.html")

    @app.route('/login', methods=['GET'])
    def login_page():
        # render login form
        return render_template('login.html')

    @app.route('/signup', methods=['GET'])
    def signup_page():
        return render_template('signup.html')

    @app.get('/register')
    def register_redirect():
        return redirect(url_for('signup_page'))

    @app.route('/tollbooth')
    def tollbooth():
        # Make the tollbooth registration page publicly viewable so
        # "Create an account" from the login page navigates directly here
        # instead of being redirected to the login page with a next= param.
        # Note: the API endpoint that actually registers a tollbooth
        # (`/api/tollbooth`) remains protected and will require an
        # authenticated session to POST.
        return render_template('tollbooth.html')

    @app.post("/api/alert")
    def receive_alert():
        try:
            data = request.get_json(force=True) or {}
        except Exception:
            return jsonify({"error": "Invalid JSON"}), 400

        required = ["driver_id", "latitude", "longitude", "status"]
        missing = [k for k in required if k not in data]
        if missing:
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        try:
            latitude = float(data["latitude"])  # type: ignore[arg-type]
            longitude = float(data["longitude"])  # type: ignore[arg-type]
        except Exception:
            return jsonify({"error": "latitude/longitude must be numbers"}), 400

        now = datetime.utcnow()
        alert = Alert(
            driver_id=str(data["driver_id"]),
            latitude=latitude,
            longitude=longitude,
            status=str(data["status"]),
            timestamp=now,
        )
        db.session.add(alert)
        db.session.commit()

        # build payload and attempt to attach nearest tollbooth info
        payload = {
            "id": alert.id,
            "driver_id": alert.driver_id,
            "latitude": alert.latitude,
            "longitude": alert.longitude,
            "status": alert.status,
            "timestamp": now.isoformat() + "Z",
        }

        # compute nearest tollbooth (if any)
        try:
            def haversine_km(lat1, lon1, lat2, lon2):
                from math import radians, sin, cos, sqrt, atan2
                R = 6371.0
                dlat = radians(lat2 - lat1)
                dlon = radians(lon2 - lon1)
                a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
                c = 2 * atan2(sqrt(a), sqrt(1-a))
                return R * c

            tolls = Tollbooth.query.all()
            best = None
            best_dist = None
            for t in tolls:
                try:
                    dkm = haversine_km(alert.latitude, alert.longitude, t.latitude, t.longitude)
                except Exception:
                    continue
                if best is None or dkm < best_dist:
                    best = t
                    best_dist = dkm
            if best is not None:
                payload['nearest_toll'] = {'id': best.id, 'name': best.name, 'latitude': best.latitude, 'longitude': best.longitude, 'address': best.address}
                payload['distance_km'] = float(best_dist)
        except Exception:
            # non-fatal: still emit without nearest toll info
            pass

        socketio.emit("drowsiness_alert", payload)
        return jsonify({"success": True, "alert": payload}), 201

    @app.post("/api/location")
    def receive_location():
        try:
            data = request.get_json(force=True) or {}
        except Exception:
            return jsonify({"error": "Invalid JSON"}), 400

        required = ["driver_id", "latitude", "longitude"]
        missing = [k for k in required if k not in data]
        if missing:
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        try:
            latitude = float(data["latitude"])  # type: ignore[arg-type]
            longitude = float(data["longitude"])  # type: ignore[arg-type]
        except Exception:
            return jsonify({"error": "latitude/longitude must be numbers"}), 400

        # persist location to DB
        loc = Location(
            driver_id=str(data.get("driver_id")),
            latitude=latitude,
            longitude=longitude,
            accuracy=(float(data.get("accuracy")) if data.get("accuracy") is not None else None),
            timestamp=datetime.utcnow(),
        )
        db.session.add(loc)
        db.session.commit()

        payload = {
            "id": loc.id,
            "driver_id": loc.driver_id,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "accuracy": loc.accuracy,
            "timestamp": loc.timestamp.isoformat() + "Z",
        }

        # emit a socket.io event so dashboard clients receive live location updates
        socketio.emit("location_update", payload)
        return jsonify({"success": True, "location": payload}), 200

    @app.post('/api/tollbooth')
    @login_required
    def register_tollbooth():
        """Register a tollbooth (protected). Accepts JSON or form data.

        Fields: name (required), latitude (required), longitude (required), address (optional)
        """
        if request.is_json:
            try:
                data = request.get_json(force=True) or {}
            except Exception:
                return jsonify({'error': 'Invalid JSON'}), 400
            name = data.get('name')
            lat = data.get('latitude')
            lon = data.get('longitude')
            address = data.get('address')
        else:
            name = request.form.get('name')
            lat = request.form.get('latitude')
            lon = request.form.get('longitude')
            address = request.form.get('address')

        if not name or lat is None or lon is None:
            return jsonify({'error': 'name, latitude and longitude are required'}), 400

        try:
            latitude = float(lat)
            longitude = float(lon)
        except Exception:
            return jsonify({'error': 'latitude/longitude must be numbers'}), 400

        owner_id = session.get('user_id')
        tb = Tollbooth(name=str(name), latitude=latitude, longitude=longitude, address=(address or None), owner_id=owner_id)
        db.session.add(tb)
        db.session.commit()

        payload = tb.to_dict()
        # notify connected dashboards so they can update in real-time
        socketio.emit('tollbooth_added', payload)
        return jsonify({'success': True, 'tollbooth': payload}), 201

    @app.get('/api/tollbooths')
    def list_tollbooths():
        rows = Tollbooth.query.order_by(Tollbooth.created_at.desc()).all()
        out = [r.to_dict() for r in rows]
        return jsonify({'tollbooths': out}), 200

    @app.get('/api/locations')
    def get_locations():
        """Return recent locations for a driver. Query params: driver_id (required), limit (optional, default 100)"""
        driver_id = request.args.get('driver_id')
        if not driver_id:
            return jsonify({'error': 'missing driver_id'}), 400
        try:
            limit = int(request.args.get('limit') or 100)
        except Exception:
            limit = 100

        # fetch most recent locations for driver
        rows = (
            Location.query.filter_by(driver_id=str(driver_id)).order_by(Location.timestamp.desc()).limit(limit).all()
        )
        # return in chronological order
        rows = list(reversed(rows))
        out = []
        for r in rows:
            out.append({
                'id': r.id,
                'driver_id': r.driver_id,
                'latitude': r.latitude,
                'longitude': r.longitude,
                'accuracy': r.accuracy,
                'timestamp': r.timestamp.isoformat() + 'Z',
            })
        return jsonify({'locations': out}), 200

    app.socketio = socketio  # type: ignore[attr-defined]
    return app


app = create_app()
socketio: SocketIO = app.socketio  # type: ignore[assignment]


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)


