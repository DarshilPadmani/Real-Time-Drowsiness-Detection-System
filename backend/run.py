#!/usr/bin/env python3
"""
Production runner for the drowsiness detection backend.
"""

import os
import sys
from app import app, socketio

if __name__ == '__main__':
    # Set production environment
    os.environ['FLASK_ENV'] = 'production'
    
    # Run the application
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=False,
        use_reloader=False
    )

