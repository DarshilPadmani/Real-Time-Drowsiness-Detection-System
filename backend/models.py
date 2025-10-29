from __future__ import annotations

from datetime import datetime
from typing import Optional

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash


db = SQLAlchemy()


class TollBooth(UserMixin, db.Model):
    __tablename__ = "TollBooths"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    username = db.Column(db.String, unique=True, nullable=False)
    password_hash = db.Column(db.String, nullable=False)

    alerts = db.relationship("Alert", backref="tollbooth", lazy=True)

    def get_id(self) -> str:  # for Flask-Login
        return str(self.id)

    @classmethod
    def create(
        cls,
        *,
        name: str,
        latitude: float,
        longitude: float,
        username: str,
        password: str,
    ) -> "TollBooth":
        booth = cls(
            name=name,
            latitude=float(latitude),
            longitude=float(longitude),
            username=username,
            password_hash=generate_password_hash(password),
        )
        return booth


class Alert(db.Model):
    __tablename__ = "Alerts"

    id = db.Column(db.Integer, primary_key=True)
    driver_id = db.Column(db.String, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    tollbooth_id = db.Column(db.Integer, db.ForeignKey("TollBooths.id"), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


def verify_password(stored_hash: str, password: str) -> bool:
    return check_password_hash(stored_hash, password)


def init_db() -> None:
    """Create tables and seed initial tollbooths if none exist."""
    db.create_all()

    if TollBooth.query.count() == 0:
        # Seed a few sample tollbooths (India coordinates as examples)
        sample = [
            ("Ahmedabad Toll Plaza", 23.0396, 72.5660, "ahd_booth", "password123"),
            ("Vadodara Toll Plaza", 22.3072, 73.1812, "brd_booth", "password123"),
            ("Surat Toll Plaza", 21.1702, 72.8311, "sur_booth", "password123"),
        ]
        for name, lat, lon, username, password in sample:
            db.session.add(TollBooth.create(name=name, latitude=lat, longitude=lon, username=username, password=password))
        db.session.commit()


