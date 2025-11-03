from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
from flask_socketio import SocketIO
from models import db, Alert


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

    @app.route("/dashboard")
    def dashboard():
        return render_template("dashboard.html")

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

        payload = {
            "id": alert.id,
            "driver_id": alert.driver_id,
            "latitude": alert.latitude,
            "longitude": alert.longitude,
            "status": alert.status,
            "timestamp": now.isoformat() + "Z",
        }

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

        payload = {
            "driver_id": str(data.get("driver_id")),
            "latitude": latitude,
            "longitude": longitude,
            "accuracy": data.get("accuracy"),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

        # emit a socket.io event so dashboard clients receive live location updates
        socketio.emit("location_update", payload)
        return jsonify({"success": True, "location": payload}), 200

    app.socketio = socketio  # type: ignore[attr-defined]
    return app


app = create_app()
socketio: SocketIO = app.socketio  # type: ignore[assignment]


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)


