#!/usr/bin/env python3
"""Simple server startup script."""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import main

if __name__ == "__main__":
    print("=" * 60)
    print("Drowsiness Detection System - Backend Server")
    print("=" * 60)
    print(f"Starting server on http://127.0.0.1:5000")
    print(f"Press Ctrl+C to stop the server")
    print("=" * 60)
    print()
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nServer stopped by user.")
    except Exception as e:
        print(f"\n\nError starting server: {e}")
        import traceback
        traceback.print_exc()



