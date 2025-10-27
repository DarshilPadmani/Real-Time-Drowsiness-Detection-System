"""
Example IoT/device client that posts drowsiness alerts to the server.
This can run on a Raspberry Pi / Jetson / other edge device.

It shows two modes:
 - REST mode: POST to http://<server>:5000/alert
 - MQTT mode: publish to an MQTT topic (if your backend uses MQTT)

For a real device, replace the `detect_and_notify()` stub with the actual detection loop
that calls notify_alert() when drowsiness is detected.
"""
import time
import json
import requests
import random

# Configuration
SERVER_URL = 'http://localhost:5000'  # change to your server address
ALERT_ENDPOINT = f'{SERVER_URL}/alert'


def notify_alert_rest(driver_id, lat=None, lon=None, ts=None, details=None):
    payload = {
        'driver_id': driver_id,
        'lat': lat,
        'lon': lon,
        'ts': ts or time.time(),
        'alert': True,
        'type': 'drowsiness',
        'details': details or {}
    }
    try:
        r = requests.post(ALERT_ENDPOINT, json=payload, timeout=5)
        r.raise_for_status()
        print('Alert posted:', r.json())
    except Exception as e:
        print('Failed to post alert:', e)


def detect_and_notify_demo(driver_id):
    """Demo loop: simulate detection events every 20-60 seconds.
    Replace this with real detection integration on the device.
    """
    print('Starting demo detector for', driver_id)
    try:
        while True:
            wait = random.randint(20, 60)
            print(f'Waiting {wait}s...')
            time.sleep(wait)
            # Simulate a detection and sample location (replace with GPS or other module data)
            lat = 28.7041 + random.uniform(-0.01, 0.01)
            lon = 77.1025 + random.uniform(-0.01, 0.01)
            details = {'sim': True, 'confidence': random.random()}
            notify_alert_rest(driver_id, lat=lat, lon=lon, details=details)
    except KeyboardInterrupt:
        print('Stopped')


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--driver', '-d', default='driver_demo')
    p.add_argument('--mode', choices=['rest'], default='rest')
    args = p.parse_args()

    if args.mode == 'rest':
        detect_and_notify_demo(args.driver)
