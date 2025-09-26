# SonarSense

This repository contains a Raspberry Pi server and a static web interface for a servo-driven HC-SR04 radar.

- `pi_server.py`: runs on the Pi, controls the SG90 servo on GPIO14 and the HC-SR04 ultrasonic sensor on GPIO23/24, and publishes angle/distance measurements over a WebSocket server on port 8765.
- `index.html`, `style.css`, `radar.js`: static web files that render a half-circle radar display and connect to the Pi via WebSockets.

To get started, wire your Pi as described in the project documentation, run `pi_server.py` on the Pi, then open `index.html` (or deploy it via GitHub/Cloudflare Pages) and connect to `ws://<your-pi-ip>:8765`.
