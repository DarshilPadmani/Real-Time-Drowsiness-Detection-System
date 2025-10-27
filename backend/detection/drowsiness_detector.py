"""
Enhanced drowsiness detection module for web application integration.
Provides real-time drowsiness detection with callback support.
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

# Global variables for detection control
_detection_thread = None
_stop_event = threading.Event()
_current_driver_id = None
_alert_callback = None

def eye_aspect_ratio(eye):
    """Calculate the eye aspect ratio (EAR) for drowsiness detection"""
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])
    C = dist.euclidean(eye[0], eye[3])
    ear = (A + B) / (2.0 * C)
    return ear

def final_ear(shape):
    """Calculate the final EAR for both eyes"""
    (lStart, lEnd) = face_utils.FACIAL_LANDMARKS_IDXS["left_eye"]
    (rStart, rEnd) = face_utils.FACIAL_LANDMARKS_IDXS["right_eye"]
    
    leftEye = shape[lStart:lEnd]
    rightEye = shape[rStart:rEnd]
    
    leftEAR = eye_aspect_ratio(leftEye)
    rightEAR = eye_aspect_ratio(rightEye)
    
    ear = (leftEAR + rightEAR) / 2.0
    return (ear, leftEye, rightEye)

def lip_distance(shape):
    """Calculate lip distance for yawn detection"""
    top_lip = shape[50:53]
    top_lip = np.concatenate((top_lip, shape[61:64]))
    
    low_lip = shape[56:59]
    low_lip = np.concatenate((low_lip, shape[65:68]))
    
    top_mean = np.mean(top_lip, axis=0)
    low_mean = np.mean(low_lip, axis=0)
    
    distance = abs(top_mean[1] - low_mean[1])
    return distance

def _detection_loop(driver_id, alert_callback, webcam_index=0):
    """Main detection loop running in separate thread"""
    global _stop_event, _current_driver_id
    
    # Detection parameters
    EYE_AR_THRESH = 0.3
    EYE_AR_CONSEC_FRAMES = 30
    YAWN_THRESH = 20
    
    # State variables
    alarm_status = False
    alarm_status2 = False
    saying = False
    COUNTER = 0
    
    print(f'[DETECTOR] Loading predictor for driver {driver_id}...')
    
    # Load face detection and landmark prediction models
    try:
        detector = cv2.CascadeClassifier("haarcascade_frontalface_default.xml")
        predictor = dlib.shape_predictor('shape_predictor_68_face_landmarks.dat')
    except Exception as e:
        print(f'[DETECTOR] Error loading models: {e}')
        return
    
    print(f'[DETECTOR] Starting video stream for driver {driver_id}...')
    
    # Initialize video stream
    try:
        vs = VideoStream(src=webcam_index).start()
        time.sleep(1.0)  # Allow camera to warm up
    except Exception as e:
        print(f'[DETECTOR] Error starting video stream: {e}')
        return
    
    try:
        while not _stop_event.is_set():
            frame = vs.read()
            if frame is None:
                time.sleep(0.1)
                continue
            
            # Resize frame and convert to grayscale
            frame = imutils.resize(frame, width=450)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            rects = detector.detectMultiScale(gray, scaleFactor=1.1,
                                            minNeighbors=5, minSize=(30, 30),
                                            flags=cv2.CASCADE_SCALE_IMAGE)
            
            for (x, y, w, h) in rects:
                # Convert to dlib rectangle
                rect = dlib.rectangle(int(x), int(y), int(x + w), int(y + h))
                
                # Get facial landmarks
                shape = predictor(gray, rect)
                shape = face_utils.shape_to_np(shape)
                
                # Calculate eye aspect ratio
                eye = final_ear(shape)
                ear = eye[0]
                leftEye = eye[1]
                rightEye = eye[2]
                
                # Calculate lip distance for yawn detection
                distance = lip_distance(shape)
                
                # Draw contours on frame (optional, for debugging)
                leftEyeHull = cv2.convexHull(leftEye)
                rightEyeHull = cv2.convexHull(rightEye)
                cv2.drawContours(frame, [leftEyeHull], -1, (0, 255, 0), 1)
                cv2.drawContours(frame, [rightEyeHull], -1, (0, 255, 0), 1)
                
                lip = shape[48:60]
                cv2.drawContours(frame, [lip], -1, (0, 255, 0), 1)
                
                # Drowsiness detection based on eye aspect ratio
                if ear < EYE_AR_THRESH:
                    COUNTER += 1
                    
                    if COUNTER >= EYE_AR_CONSEC_FRAMES:
                        if not alarm_status:
                            alarm_status = True
                            print(f'[DETECTOR] Drowsiness detected for driver {driver_id}')
                            try:
                                alert_callback(driver_id)
                            except Exception as e:
                                print(f'[DETECTOR] Error in alert callback: {e}')
                        
                        # Draw alert text on frame
                        cv2.putText(frame, "DROWSINESS ALERT!", (10, 30),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                else:
                    COUNTER = 0
                    alarm_status = False
                
                # Yawn detection
                if distance > YAWN_THRESH:
                    cv2.putText(frame, "Yawn Alert", (10, 60),
                              cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    if not alarm_status2 and not saying:
                        alarm_status2 = True
                        print(f'[DETECTOR] Yawn detected for driver {driver_id}')
                        try:
                            alert_callback(driver_id)
                        except Exception as e:
                            print(f'[DETECTOR] Error in alert callback: {e}')
                else:
                    alarm_status2 = False
                
                # Display EAR and yawn values on frame
                cv2.putText(frame, "EAR: {:.2f}".format(ear), (300, 30),
                          cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                cv2.putText(frame, "YAWN: {:.2f}".format(distance), (300, 60),
                          cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
            # Display frame (optional, for debugging)
            # cv2.imshow(f"Driver {driver_id} - Drowsiness Detection", frame)
            
            # Small delay to prevent excessive CPU usage
            time.sleep(0.01)
            
    except Exception as e:
        print(f'[DETECTOR] Error in detection loop: {e}')
    finally:
        # Cleanup
        vs.stop()
        cv2.destroyAllWindows()
        print(f'[DETECTOR] Detection stopped for driver {driver_id}')

def start_detection(driver_id, alert_callback, webcam_index=0):
    """Start drowsiness detection for a specific driver"""
    global _detection_thread, _stop_event, _current_driver_id, _alert_callback
    
    if _detection_thread and _detection_thread.is_alive():
        print(f'[DETECTOR] Detection already running for driver {_current_driver_id}')
        return False
    
    _stop_event.clear()
    _current_driver_id = driver_id
    _alert_callback = alert_callback
    
    _detection_thread = Thread(
        target=_detection_loop,
        args=(driver_id, alert_callback, webcam_index),
        daemon=True
    )
    _detection_thread.start()
    
    print(f'[DETECTOR] Detection started for driver {driver_id}')
    return True

def stop_detection():
    """Stop drowsiness detection"""
    global _detection_thread, _stop_event, _current_driver_id
    
    if _detection_thread and _detection_thread.is_alive():
        print(f'[DETECTOR] Stopping detection for driver {_current_driver_id}')
        _stop_event.set()
        _detection_thread.join(timeout=5.0)
        
        if _detection_thread.is_alive():
            print('[DETECTOR] Warning: Detection thread did not stop gracefully')
        
        _detection_thread = None
        _current_driver_id = None
        print('[DETECTOR] Detection stopped')
    else:
        print('[DETECTOR] No active detection to stop')

def is_detection_running():
    """Check if detection is currently running"""
    return _detection_thread and _detection_thread.is_alive()

def get_current_driver():
    """Get the ID of the driver currently being monitored"""
    return _current_driver_id
