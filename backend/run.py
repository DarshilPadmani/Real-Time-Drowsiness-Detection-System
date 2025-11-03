#!/usr/bin/env python3
"""Run script for the Flask backend server.

The previous version attempted to import `main` from `app` but `app.py`
exposes a factory `create_app()` and attaches a `socketio` instance to
the created app. Importing `main` fails and prevents the backend from
starting. This script now creates the app and runs the attached SocketIO
server when available.
"""
import os
from app import create_app


def main(debug: bool = True) -> None:
    app = create_app()
    # `app.socketio` is attached inside `create_app()` in `app.py`.
    socketio = getattr(app, "socketio", None)

    port = int(os.environ.get("PORT", "5000"))
    if socketio:
        # socketio.run handles the Flask app serving as well
        socketio.run(app, host="0.0.0.0", port=port, debug=debug)
    else:
        # Fallback to Flask's built-in server (development only)
        app.run(host="0.0.0.0", port=port, debug=debug)


if __name__ == "__main__":
    # Default to debug=False for predictable single-process logs when
    # diagnosing runtime errors (avoids the reloader spawning child
    # processes which can make terminal output noisy).
    main(debug=False)



