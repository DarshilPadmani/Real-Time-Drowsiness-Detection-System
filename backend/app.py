from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_login import LoginManager, current_user, login_required, login_user, logout_user
from flask_socketio import SocketIO, join_room
from flask_sqlalchemy import SQLAlchemy

# Local modules
from .models import Alert, TollBooth, db, init_db, verify_password
from .utils.distance import haversine_km


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # Basic config
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    db_path = os.environ.get("DATABASE_URL", "sqlite:///database.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = db_path
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Initialize extensions
    db.init_app(app)

    # SocketIO
    socketio = SocketIO(app, cors_allowed_origins="*")

    # Login manager
    login_manager = LoginManager()
    login_manager.login_view = "login"
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id: str) -> Optional[TollBooth]:
        return TollBooth.query.get(int(user_id))

    # Create tables and seed data
    with app.app_context():
        init_db()

    # Routes
    @app.route("/")
    def index():
        if current_user.is_authenticated:
            return redirect(url_for("dashboard"))
        return redirect(url_for("login"))

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            booth = TollBooth.query.filter_by(username=username).first()
            if booth and verify_password(booth.password_hash, password):
                login_user(booth)
                return redirect(url_for("dashboard"))
            return render_template("login.html", error="Invalid credentials")
        return render_template("login.html")

    @app.route("/logout")
    @login_required
    def logout():
        logout_user()
        session.clear()
        return redirect(url_for("login"))

    @app.route("/dashboard")
    @login_required
    def dashboard():
        return render_template("dashboard.html", booth=current_user)

    # API: Tollbooths
    @app.route("/api/tollbooths", methods=["GET", "POST"])
    def api_tollbooths():
        if request.method == "GET":
            booths = TollBooth.query.all()
            return jsonify([
                {
                    "id": b.id,
                    "name": b.name,
                    "latitude": b.latitude,
                    "longitude": b.longitude,
                    "username": b.username,
                }
                for b in booths
            ])

        data = request.get_json(silent=True) or {}
        name = data.get("name")
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        username = data.get("username")
        password = data.get("password")

        if not all([name, latitude, longitude, username, password]):
            return jsonify({"error": "Missing required fields"}), 400

        if TollBooth.query.filter_by(username=username).first():
            return jsonify({"error": "Username already exists"}), 409

        booth = TollBooth.create(name=name, latitude=latitude, longitude=longitude, username=username, password=password)
        db.session.add(booth)
        db.session.commit()
        return jsonify({"id": booth.id}), 201

    # API: Alert from edge device
    @app.route("/api/alert", methods=["POST"])
    def api_alert():
        payload = request.get_json(silent=True) or {}
        driver_id = (payload.get("driver_id") or "").strip()
        latitude = payload.get("latitude")
        longitude = payload.get("longitude")

        if not driver_id or latitude is None or longitude is None:
            return jsonify({"error": "driver_id, latitude, longitude are required"}), 400

        booths = TollBooth.query.all()
        if not booths:
            return jsonify({"error": "No tollbooths configured"}), 503

        # Find nearest booth by Haversine
        min_dist = float("inf")
        nearest: Optional[TollBooth] = None
        for booth in booths:
            d = haversine_km(float(latitude), float(longitude), booth.latitude, booth.longitude)
            if d < min_dist:
                min_dist = d
                nearest = booth

        if nearest is None:
            return jsonify({"error": "Nearest booth not found"}), 500

        # Store alert
        alert = Alert(
            driver_id=driver_id,
            latitude=float(latitude),
            longitude=float(longitude),
            tollbooth_id=nearest.id,
            timestamp=datetime.utcnow(),
        )
        db.session.add(alert)
        db.session.commit()

        # Emit socket event to the booth room
        room = f"booth_{nearest.id}"
        socketio.emit(
            "drowsiness_alert",
            {
                "alert_id": alert.id,
                "driver_id": driver_id,
                "latitude": alert.latitude,
                "longitude": alert.longitude,
                "tollbooth_id": nearest.id,
                "tollbooth_name": nearest.name,
                "timestamp": alert.timestamp.isoformat() + "Z",
                "distance_km": round(min_dist, 3),
            },
            room=room,
        )

        return jsonify({"status": "ok", "tollbooth_id": nearest.id, "distance_km": min_dist}), 201

    # Socket.IO events
    @socketio.on("connect")
    def on_connect():
        # If the user is a logged-in tollbooth, join their room
        if current_user.is_authenticated:
            room = f"booth_{current_user.id}"
            join_room(room)

    # Utility route to fetch recent alerts for the logged-in booth
    @app.route("/api/my_alerts")
    @login_required
    def my_alerts():
        alerts = (
            Alert.query.filter_by(tollbooth_id=current_user.id)
            .order_by(Alert.timestamp.desc())
            .limit(50)
            .all()
        )
        return jsonify([
            {
                "id": a.id,
                "driver_id": a.driver_id,
                "latitude": a.latitude,
                "longitude": a.longitude,
                "timestamp": a.timestamp.isoformat() + "Z",
            }
            for a in alerts
        ])

    # Health check
    @app.route("/health")
    def health():
        return jsonify({"status": "healthy"})

    # Expose socketio for external run
    app.socketio = socketio  # type: ignore[attr-defined]
    return app


def main() -> None:
    app = create_app()
    # Use SocketIO runner
    app.socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))  # type: ignore[attr-defined]


if __name__ == "__main__":
    main()


