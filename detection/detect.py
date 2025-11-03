import os
import time
from typing import Any, Dict
import requests


SERVER_URL = os.getenv("SERVER_URL", "http://127.0.0.1:5000/api/alert")


def send_alert(latitude: float, longitude: float, status: str, driver_id: str = "DRIVER001") -> Dict[str, Any]:
    payload = {
        "driver_id": driver_id,
        "latitude": latitude,
        "longitude": longitude,
        "status": status,
    }
    resp = requests.post(SERVER_URL, json=payload, timeout=5)
    resp.raise_for_status()
    return resp.json()


def simulate() -> None:
    # Example simulation of a few alerts near a location
    coords = [
        (23.2156, 72.6369),
        (23.2170, 72.6390),
        (23.2195, 72.6402),
    ]
    for idx, (lat, lon) in enumerate(coords, start=1):
        print(f"Sending alert {idx} -> ({lat}, {lon})")
        try:
            res = send_alert(lat, lon, "Drowsy", driver_id="DRIVER001")
            print("OK", res.get("alert", {}))
        except Exception as e:
            print("Failed:", e)
        time.sleep(1.2)


if __name__ == "__main__":
    simulate()



