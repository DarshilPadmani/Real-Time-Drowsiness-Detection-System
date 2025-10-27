#!/usr/bin/env python3
"""
Test script to verify the drowsiness detection system setup.
"""

import sys
import os
import json
import requests
import time

def test_imports():
    """Test if all required modules can be imported"""
    print("🔍 Testing imports...")
    
    try:
        import cv2
        print("✅ OpenCV imported successfully")
    except ImportError as e:
        print(f"❌ OpenCV import failed: {e}")
        return False
    
    try:
        import dlib
        print("✅ dlib imported successfully")
    except ImportError as e:
        print(f"❌ dlib import failed: {e}")
        return False
    
    try:
        import flask
        print("✅ Flask imported successfully")
    except ImportError as e:
        print(f"❌ Flask import failed: {e}")
        return False
    
    try:
        import flask_socketio
        print("✅ Flask-SocketIO imported successfully")
    except ImportError as e:
        print(f"❌ Flask-SocketIO import failed: {e}")
        return False
    
    return True

def test_model_files():
    """Test if required model files exist"""
    print("\n🔍 Testing model files...")
    
    files_to_check = [
        "haarcascade_frontalface_default.xml",
        "shape_predictor_68_face_landmarks.dat"
    ]
    
    all_exist = True
    for file in files_to_check:
        if os.path.exists(file):
            print(f"✅ {file} found")
        else:
            print(f"❌ {file} not found")
            all_exist = False
    
    return all_exist

def test_tollbooth_data():
    """Test if tollbooth data file exists and is valid"""
    print("\n🔍 Testing tollbooth data...")
    
    tollbooth_file = "backend/data/tollbooths.json"
    if not os.path.exists(tollbooth_file):
        print(f"❌ {tollbooth_file} not found")
        return False
    
    try:
        with open(tollbooth_file, 'r') as f:
            data = json.load(f)
        print(f"✅ {tollbooth_file} loaded successfully ({len(data)} tollbooths)")
        return True
    except Exception as e:
        print(f"❌ Error loading {tollbooth_file}: {e}")
        return False

def test_backend_api():
    """Test if backend API is running"""
    print("\n🔍 Testing backend API...")
    
    try:
        response = requests.get("http://localhost:5000/api/drivers/active", timeout=5)
        if response.status_code == 200:
            print("✅ Backend API is running")
            return True
        else:
            print(f"❌ Backend API returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Backend API is not running (connection refused)")
        return False
    except Exception as e:
        print(f"❌ Error testing backend API: {e}")
        return False

def test_frontend():
    """Test if frontend is accessible"""
    print("\n🔍 Testing frontend...")
    
    try:
        response = requests.get("http://localhost:3000", timeout=5)
        if response.status_code == 200:
            print("✅ Frontend is running")
            return True
        else:
            print(f"❌ Frontend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Frontend is not running (connection refused)")
        return False
    except Exception as e:
        print(f"❌ Error testing frontend: {e}")
        return False

def main():
    """Run all tests"""
    print("🚗 Real-Time Drowsiness Detection System - Setup Test")
    print("=" * 60)
    
    tests = [
        ("Python Imports", test_imports),
        ("Model Files", test_model_files),
        ("Tollbooth Data", test_tollbooth_data),
        ("Backend API", test_backend_api),
        ("Frontend", test_frontend)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test failed with error: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary:")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:20} {status}")
        if result:
            passed += 1
    
    print("=" * 60)
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! System is ready to use.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the setup.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

