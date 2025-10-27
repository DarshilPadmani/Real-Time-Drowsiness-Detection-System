"""
Lightweight wrapper around the project's drowsiness detection logic.
Provides start_detection(driver_id, callback) and stop_detection().
The callback is called as callback(driver_id) when drowsiness is detected.
"""
import threading
import time
from threading import Thread
from scipy.spatial import distance as dist
from imutils import face_utils
import numpy as np
import dlib
import cv2
import imutils
from imutils.video import VideoStream
import pygame

_thread = None
_stop = threading.Event()
_running_driver = None


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


def _run(driver_id, alert_callback, webcam_index=0, alarm_path='Alert.wav'):
    EYE_AR_THRESH = 0.3
    EYE_AR_CONSEC_FRAMES = 30
    YAWN_THRESH = 20
    alarm_status = False
    alarm_status2 = False
    saying = False
    COUNTER = 0

    print('Detector: loading predictor...')
    detector = cv2.CascadeClassifier("haarcascade_frontalface_default.xml")
    predictor = dlib.shape_predictor('shape_predictor_68_face_landmarks.dat')

    print('Detector: starting stream...')
    vs = VideoStream(src=webcam_index).start()
    time.sleep(1.0)

    try:
        while not _stop.is_set():
            frame = vs.read()
            if frame is None:
                time.sleep(0.1)
                continue
            frame = imutils.resize(frame, width=450)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            rects = detector.detectMultiScale(gray, scaleFactor=1.1,
                                             minNeighbors=5, minSize=(30, 30),
                                             flags=cv2.CASCADE_SCALE_IMAGE)
            for (x, y, w, h) in rects:
                rect = dlib.rectangle(int(x), int(y), int(x + w), int(y + h))
                shape = predictor(gray, rect)
                shape = face_utils.shape_to_np(shape)
                eye = final_ear(shape)
                ear = eye[0]
                distance = lip_distance(shape)

                if ear < EYE_AR_THRESH:
                    COUNTER += 1
                    if COUNTER >= EYE_AR_CONSEC_FRAMES:
                        if not alarm_status:
                            alarm_status = True
                            # notify
                            try:
                                alert_callback(driver_id)
                            except Exception:
                                pass
                else:
                    COUNTER = 0
                    alarm_status = False

                if distance > YAWN_THRESH:
                    if not alarm_status2 and not saying:
                        alarm_status2 = True
                        try:
                            alert_callback(driver_id)
                        except Exception:
                            pass
                else:
                    alarm_status2 = False

            # small sleep to yield
            time.sleep(0.01)

    finally:
        vs.stop()


def start_detection(driver_id, alert_callback, webcam_index=0):
    global _thread, _stop, _running_driver
    if _thread and _thread.is_alive():
        print('Detection already running')
        return
    _stop.clear()
    _running_driver = driver_id
    _thread = Thread(target=_run, args=(driver_id, alert_callback, webcam_index))
    _thread.daemon = True
    _thread.start()


def stop_detection():
    global _thread, _stop, _running_driver
    _stop.set()
    if _thread:
        _thread.join(timeout=2.0)
    _thread = None
    _running_driver = None
