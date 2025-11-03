#python drowniness_yawn.py --webcam webcam_index

from scipy.spatial import distance as dist
from imutils.video import VideoStream
from imutils import face_utils
from threading import Thread
import numpy as np
import argparse
import imutils
import time
import dlib
import cv2
import playsound
import os
import requests
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from threading import Lock

# GPS globals
current_lat = None
current_lon = None
gps_lock = Lock()


def sound_alarm(path):
    global alarm_status
    global alarm_status2
    global saying

    while alarm_status:
        print('call')
        playsound.playsound(path)
    if alarm_status2:
        print('call')
        saying = True
        playsound.playsound(path)
        saying = False

def eye_aspect_ratio(eye):
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])

    C = dist.euclidean(eye[0], eye[3])

    ear = (A + B) / (2.0 * C)

    return ear

def final_ear(shape):
    (lStart, lEnd) = face_utils.FACIAL_LANDMARKS_IDXS["left_eye"]
    (rStart, rEnd) = face_utils.FACIAL_LANDMARKS_IDXS["right_eye"]

    leftEye = shape[lStart:lEnd]
    rightEye = shape[rStart:rEnd]

    leftEAR = eye_aspect_ratio(leftEye)
    rightEAR = eye_aspect_ratio(rightEye)

    ear = (leftEAR + rightEAR) / 2.0
    return (ear, leftEye, rightEye)

def lip_distance(shape):
    top_lip = shape[50:53]
    top_lip = np.concatenate((top_lip, shape[61:64]))

    low_lip = shape[56:59]
    low_lip = np.concatenate((low_lip, shape[65:68]))

    top_mean = np.mean(top_lip, axis=0)
    low_mean = np.mean(low_lip, axis=0)

    distance = abs(top_mean[1] - low_mean[1])
    return distance


ap = argparse.ArgumentParser()
ap.add_argument("-w", "--webcam", type=int, default=0, help="index of webcam on system")
ap.add_argument("-a", "--alarm", type=str, default="Alert.wav", help="path alarm .WAV file")
ap.add_argument("--shape-predictor", type=str, default="shape_predictor_68_face_landmarks.dat",
                help="path to dlib shape predictor file")
ap.add_argument("--server", type=str, default="http://localhost:5000/api/alert",
                help="backend server URL for storing alerts (expects driver_id, latitude, longitude, status)")
ap.add_argument("--driver-id", type=str, default="driver1", help="driver id to include in alert posts")
ap.add_argument("--lat", type=float, default=0.0, help="latitude to include with alerts (default 0.0)")
ap.add_argument("--lon", type=float, default=0.0, help="longitude to include with alerts (default 0.0)")
ap.add_argument("--gps-port", type=str, default=None, help="Serial port for GPS (e.g., COM3 or /dev/ttyUSB0)")
ap.add_argument("--gps-baud", type=int, default=4800, help="GPS serial baud rate (default 4800)")
ap.add_argument("--listen-port", type=int, default=5001, help="Local HTTP port to accept location POSTs")
args = vars(ap.parse_args())

EYE_AR_THRESH = 0.3
EYE_AR_CONSEC_FRAMES = 30
YAWN_THRESH = 20
alarm_status = False
alarm_status2 = False
saying = False
COUNTER = 0

print("-> Loading the predictor and detector...")
#detector = dlib.get_frontal_face_detector()
detector = cv2.CascadeClassifier("haarcascade_frontalface_default.xml")    #Faster but less accurate
predictor_path = args.get("shape_predictor") or 'shape_predictor_68_face_landmarks.dat'
if not os.path.exists(predictor_path):
    raise FileNotFoundError(f"Shape predictor file not found: {predictor_path}")
predictor = dlib.shape_predictor(predictor_path)


def send_alert_to_server(driver_id: str, lat: float, lon: float, status: str):
    url = args.get("server")
    # Ensure we have numeric latitude/longitude before sending.
    lat_final = lat
    lon_final = lon
    if lat_final is None or lon_final is None:
        # try to get dynamic location
        try:
            lat_g, lon_g = _get_current_location()
            if lat_g is not None and lon_g is not None:
                lat_final = lat_g
                lon_final = lon_g
        except Exception:
            pass

    # final fallback: try CLI args (if user passed --lat/--lon non-zero)
    if (lat_final is None or lon_final is None):
        try:
            lat_arg = float(args.get('lat') or 0.0)
            lon_arg = float(args.get('lon') or 0.0)
            if lat_arg != 0.0 or lon_arg != 0.0:
                lat_final = lat_arg
                lon_final = lon_arg
        except Exception:
            pass

    # If still missing or not numbers, skip sending and log
    try:
        lat_final = None if lat_final is None else float(lat_final)
        lon_final = None if lon_final is None else float(lon_final)
    except Exception:
        lat_final = None
        lon_final = None

    location_unknown = False
    if lat_final is None or lon_final is None:
        # Fallback: send 0.0/0.0 but mark location as unknown so dashboards can display the alert
        location_unknown = True
        lat_final = 0.0
        lon_final = 0.0

    payload = {
        "driver_id": driver_id,
        "latitude": lat_final,
        "longitude": lon_final,
        "location_unknown": location_unknown,
        "status": status,
    }
    try:
        resp = requests.post(url, json=payload, timeout=5)
        print(f"POST {url} -> {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"Failed to POST alert to {url}: {e}")


def _get_current_location():
    """Return current (lat, lon) preferring dynamic GPS/local updates, falling back to CLI args."""
    global current_lat, current_lon
    with gps_lock:
        if current_lat is not None and current_lon is not None:
            return float(current_lat), float(current_lon)
    # fallback to CLI args
    try:
        lat = float(args.get('lat') or 0.0)
        lon = float(args.get('lon') or 0.0)
        if lat != 0.0 or lon != 0.0:
            return lat, lon
    except Exception:
        pass
    return None, None


print("-> Starting Video Stream")
# Prefer explicit VideoCapture on Windows so we can select a working backend (DirectShow)
if os.name == 'nt':
    cap = cv2.VideoCapture(args["webcam"], cv2.CAP_DSHOW)
else:
    cap = cv2.VideoCapture(args["webcam"])

if not cap.isOpened():
    # fallback to imutils VideoStream if cv2 backend fails
    print("Warning: cv2.VideoCapture failed to open camera, falling back to imutils.VideoStream")
    vs = VideoStream(src=args["webcam"]).start()
    time.sleep(1.0)
    use_cap = False
else:
    use_cap = True
    time.sleep(1.0)


def _server_location_url(server_api_alert: str) -> str:
    # derive base server URL and append /api/location
    if server_api_alert.endswith('/api/alert'):
        return server_api_alert[:-len('/api/alert')] + '/api/location'
    # strip trailing slash if present
    if server_api_alert.endswith('/'):
        return server_api_alert + 'api/location'
    return server_api_alert + '/api/location'


def _periodic_location_sender(driver_id: str, lat: float, lon: float, server_api_alert: str, interval: float = 5.0):
    url = _server_location_url(server_api_alert)
    while True:
        # read dynamic location if available
        lat_now, lon_now = _get_current_location()
        payload = {
            'driver_id': driver_id,
            'latitude': (lat_now if lat_now is not None else lat),
            'longitude': (lon_now if lon_now is not None else lon),
        }
        try:
            resp = requests.post(url, json=payload, timeout=5)
            # print minimal status to avoid overwhelming stdout
            print(f"location -> {resp.status_code}", end='\r')
        except Exception as e:
            print(f"Failed to send location to {url}: {e}")
        time.sleep(interval)


# Start periodic location updates in background (will use dynamic GPS if available)
try:
    driver_id_arg = args.get('driver_id')
    lat_arg = float(args.get('lat') or 0.0)
    lon_arg = float(args.get('lon') or 0.0)
    server_arg = args.get('server')
    if driver_id_arg:
        tloc = Thread(target=_periodic_location_sender, args=(driver_id_arg, lat_arg, lon_arg, server_arg, 5.0), daemon=True)
        tloc.start()
except Exception:
    pass


# --- GPS serial reader (optional) ---
def _gps_serial_reader(port: str, baud: int):
    try:
        import serial
        import pynmea2
    except Exception:
        print("GPS serial support requires 'pyserial' and 'pynmea2' packages. Install with: pip install pyserial pynmea2")
        return

    global current_lat, current_lon
    try:
        ser = serial.Serial(port, baudrate=baud, timeout=1)
        print(f"Opened GPS serial on {port} @ {baud}")
    except Exception as e:
        print(f"Failed to open GPS serial port {port}: {e}")
        return

    while True:
        try:
            line = ser.readline().decode('ascii', errors='ignore').strip()
            if not line:
                continue
            if not line.startswith('$'):
                continue
            try:
                msg = pynmea2.parse(line)
            except Exception:
                continue
            # handle common sentence types that contain lat/lon
            lat = None
            lon = None
            if hasattr(msg, 'latitude') and hasattr(msg, 'longitude'):
                try:
                    lat = float(msg.latitude)
                    lon = float(msg.longitude)
                except Exception:
                    lat = None
                    lon = None
            if lat is not None and lon is not None and lat != 0.0 and lon != 0.0:
                with gps_lock:
                    current_lat = lat
                    current_lon = lon
                # debug
                print(f"GPS -> {lat:.6f},{lon:.6f}")
        except Exception as e:
            print(f"GPS reader error: {e}")
            time.sleep(1.0)


# Start GPS serial reader if user provided GPS port
try:
    gps_port = args.get('gps_port')
    gps_baud = int(args.get('gps_baud') or 4800)
    if gps_port:
        tgps = Thread(target=_gps_serial_reader, args=(gps_port, gps_baud), daemon=True)
        tgps.start()
except Exception:
    pass


# --- Local HTTP endpoint to accept location updates from other processes ---
class _LocationHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path not in ('/update_location', '/location'):
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body.decode('utf-8'))
        except Exception:
            self.send_response(400)
            self.end_headers()
            return
        lat = data.get('latitude') or data.get('lat')
        lon = data.get('longitude') or data.get('lon')
        if lat is None or lon is None:
            self.send_response(400)
            self.end_headers()
            return
        try:
            lat = float(lat)
            lon = float(lon)
            with gps_lock:
                global current_lat, current_lon
                current_lat = lat
                current_lon = lon
        except Exception:
            self.send_response(400)
            self.end_headers()
            return
        self.send_response(200)
        self.end_headers()


def _start_local_http_server(port: int):
    server = ThreadingHTTPServer(('127.0.0.1', port), _LocationHTTPRequestHandler)
    print(f"Local location HTTP server listening on http://127.0.0.1:{port}/update_location")
    try:
        server.serve_forever()
    except Exception:
        pass

# run local http server if listen-port provided
try:
    listen_port = int(args.get('listen_port') or 0)
    if listen_port:
        th = Thread(target=_start_local_http_server, args=(listen_port,), daemon=True)
        th.start()
except Exception:
    pass

while True:

    if use_cap:
        ret, frame = cap.read()
        if not ret or frame is None:
            # don't crash; loop and try again
            print("Warning: couldn't read frame from camera (ret=False). Retrying...")
            time.sleep(0.1)
            continue
    else:
        frame = vs.read()
        if frame is None:
            print("Warning: imutils VideoStream returned no frame. Retrying...")
            time.sleep(0.1)
            continue

    frame = imutils.resize(frame, width=450)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    #rects = detector(gray, 0)
    rects = detector.detectMultiScale(gray, scaleFactor=1.1,
		minNeighbors=5, minSize=(30, 30),
		flags=cv2.CASCADE_SCALE_IMAGE)

    #for rect in rects:
    for (x, y, w, h) in rects:
        rect = dlib.rectangle(int(x), int(y), int(x + w),int(y + h))

        shape = predictor(gray, rect)
        shape = face_utils.shape_to_np(shape)

        eye = final_ear(shape)
        ear = eye[0]
        leftEye = eye [1]
        rightEye = eye[2]

        distance = lip_distance(shape)

        leftEyeHull = cv2.convexHull(leftEye)
        rightEyeHull = cv2.convexHull(rightEye)
        cv2.drawContours(frame, [leftEyeHull], -1, (0, 255, 0), 1)
        cv2.drawContours(frame, [rightEyeHull], -1, (0, 255, 0), 1)

        lip = shape[48:60]
        cv2.drawContours(frame, [lip], -1, (0, 255, 0), 1)

        if ear < EYE_AR_THRESH:
            COUNTER += 1

            if COUNTER >= EYE_AR_CONSEC_FRAMES:
                if alarm_status == False:
                    alarm_status = True
                    if args["alarm"] != "":
                        t = Thread(target=sound_alarm,
                                   args=(args["alarm"],))
                    t.daemon = True
                    t.start()

                    # send drowsiness alert to backend using current location
                    try:
                        lat_now, lon_now = _get_current_location()
                        send_alert_to_server(args.get("driver_id"), lat_now, lon_now, "drowsiness")
                    except Exception:
                        pass

                cv2.putText(frame, "DROWSINESS ALERT!", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        else:
            COUNTER = 0
            alarm_status = False

        if (distance > YAWN_THRESH):
                cv2.putText(frame, "Yawn Alert", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                if alarm_status2 == False and saying == False:
                    alarm_status2 = True
                    if args["alarm"] != "":
                        t = Thread(target=sound_alarm,
                                   args=(args["alarm"],))
                    t.daemon = True
                    t.start()

                    # send yawn alert to backend using current location
                    try:
                        lat_now, lon_now = _get_current_location()
                        send_alert_to_server(args.get("driver_id"), lat_now, lon_now, "yawn")
                    except Exception:
                        pass
        else:
            alarm_status2 = False

        cv2.putText(frame, "EAR: {:.2f}".format(ear), (300, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        cv2.putText(frame, "YAWN: {:.2f}".format(distance), (300, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)


    try:
      cv2.imshow("Frame", frame)
      key = cv2.waitKey(1) & 0xFF
    except cv2.error as e:
      # Common cause: OpenCV was installed without GUI support (headless build)
      print("\nERROR: cv2.imshow is not available in this OpenCV build.\n" \
          "This usually means you have a headless OpenCV package installed (no GUI support)\n" \
          "or you're running in a headless environment (WSL without X server, remote session, etc.).\n")
      print("cv2 error details:", e)
      print("\nQuick fixes:")
      print("  1) If you're on Windows PowerShell and want a GUI, install the non-headless OpenCV package:\n"
          "     pip uninstall -y opencv-python-headless\n"
          "     pip install --upgrade --force-reinstall opencv-python\n")
      print("  2) If you're running under WSL or a headless server, either run the script using native Windows Python\n"
          "     or set up an X server / use a virtual display, or remove GUI calls and save frames to disk instead.\n")
      break

    if key == ord("q"):
        break

cv2.destroyAllWindows()
vs.stop()
