from __future__ import annotations

import argparse
import random
import time
from typing import Tuple

import requests


def simulate_gps(center_lat: float, center_lon: float, jitter_m: float = 500.0) -> Tuple[float, float]:
    """Return a random lat/lon around a center point within ~jitter_m meters.

    Rough conversion: 1 degree latitude ~ 111,111 meters. Longitude scaled by cos(latitude).
    """
    deg_per_meter = 1.0 / 111_111.0
    lat_offset = (random.random() - 0.5) * 2.0 * jitter_m * deg_per_meter
    lon_scale = max(0.000001, abs(__import__("math").cos(__import__("math").radians(center_lat))))
    lon_offset = (random.random() - 0.5) * 2.0 * jitter_m * deg_per_meter / lon_scale
    return center_lat + lat_offset, center_lon + lon_offset


def send_alert(base_url: str, driver_id: str, lat: float, lon: float, timeout: float = 5.0) -> None:
    url = base_url.rstrip("/") + "/api/alert"
    payload = {"driver_id": driver_id, "latitude": lat, "longitude": lon}
    r = requests.post(url, json=payload, timeout=timeout)
    r.raise_for_status()
    print(f"Sent alert -> booth_id={r.json().get('tollbooth_id')} distance_km={r.json().get('distance_km'):.3f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Edge device drowsiness alert simulator")
    parser.add_argument("--server", default="http://127.0.0.1:5000", help="Backend base URL")
    parser.add_argument("--driver-id", default="DRIVER123", help="Driver identifier")
    parser.add_argument("--lat", type=float, default=23.0396, help="Center latitude")
    parser.add_argument("--lon", type=float, default=72.5660, help="Center longitude")
    parser.add_argument("--count", type=int, default=1, help="Number of alerts to send")
    parser.add_argument("--interval", type=float, default=2.0, help="Seconds between alerts")
    args = parser.parse_args()

    for i in range(args.count):
        lat, lon = simulate_gps(args.lat, args.lon)
        try:
            send_alert(args.server, args.driver_id, lat, lon)
        except Exception as e:
            print("Failed to send alert:", e)
        if i < args.count - 1:
            time.sleep(args.interval)


if __name__ == "__main__":
    main()


