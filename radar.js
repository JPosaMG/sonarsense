/*
 * radar.js – client‑side logic for the SonarSense radar display.
 *
 * This script connects to a WebSocket server running on the Raspberry Pi
 * (provided in pi_server.py) and draws a half‑circle radar on a HTML5
 * canvas.  Each message received from the server should be a JSON
 * object with `angle` and `distance` fields.  The angle is in degrees
 * (0–180) and the distance is in centimetres.  Points fade over time
 * to emulate the look of a radar display.
 */

(function () {
  const wsUrlInput = document.getElementById('wsUrl');
  const connectBtn = document.getElementById('connectBtn');
  const statusSpan = document.getElementById('status');
  const angleDisplay = document.getElementById('angleDisplay');
  const distanceDisplay = document.getElementById('distanceDisplay');
  const canvas = document.getElementById('radarCanvas');
  const ctx = canvas.getContext('2d');

  // Collection of points {angle, distance, timestamp}
  const scanPoints = [];
  const maxPoints = 360; // keep roughly one full sweep of points
  const maxDistance = 400; // max measurable distance (cm)
  let currentAngle = null;
  let currentDistance = null;

  let socket = null;

  // Resize canvas based on computed CSS size
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    drawRadar();
  }

  window.addEventListener('resize', resizeCanvas);

  // Convert polar coordinates to canvas coordinates
  function polarToCanvas(angleDeg, distance) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const radius = Math.min(canvas.width / 2, canvas.height);
    const scaledDist = Math.min(distance / maxDistance, 1) * (radius - 20);
    // Canvas origin at bottom centre
    const cx = canvas.width / 2;
    const cy = canvas.height;
    const x = cx + scaledDist * Math.cos(angleRad);
    const y = cy - scaledDist * Math.sin(angleRad);
    return { x, y };
  }

  // Draw background arcs and grid lines
  function drawBackground() {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h;
    const radius = Math.min(w / 2, h) - 5;
    ctx.clearRect(0, 0, w, h);

    // Draw concentric rings every 25% of max distance
    ctx.strokeStyle = 'rgba(0, 255, 128, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const r = (radius * i) / 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 0);
      ctx.stroke();
    }

    // Draw angle lines every 30°
    for (let a = 0; a <= 180; a += 30) {
      const p = polarToCanvas(a, maxDistance);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(0, 255, 128, 0.1)';
      ctx.stroke();
    }
  }

  // Draw the current frame: background, fading points and sweep line
  function drawRadar() {
    drawBackground();
    const now = Date.now();
    const cx = canvas.width / 2;
    const cy = canvas.height;
    const radius = Math.min(canvas.width / 2, canvas.height) - 5;

    // Draw fading points
    scanPoints.forEach((pt) => {
      const age = now - pt.timestamp;
      const alpha = Math.max(0, 1 - age / 4000); // fade out after 4 seconds
      if (alpha <= 0) return;
      ctx.fillStyle = `rgba(0, 255, 128, ${alpha})`;
      const pos = polarToCanvas(pt.angle, pt.distance);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw sweeping line for current angle
    if (currentAngle !== null) {
      const pos = polarToCanvas(currentAngle, maxDistance);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = 'rgba(0, 255, 128, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Update data when a new reading arrives
  function updateData(angle, distance) {
    currentAngle = angle;
    currentDistance = distance;
    angleDisplay.textContent = angle.toFixed(0);
    if (distance >= 0) {
      distanceDisplay.textContent = distance.toFixed(2);
    } else {
      distanceDisplay.textContent = '--';
    }
    scanPoints.push({ angle, distance, timestamp: Date.now() });
    if (scanPoints.length > maxPoints) {
      scanPoints.splice(0, scanPoints.length - maxPoints);
    }
    drawRadar();
  }

  // Connect to the WebSocket server
  function connectWebSocket() {
    const url = wsUrlInput.value.trim();
    if (!url) return;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
    statusSpan.textContent = 'Connecting…';
    statusSpan.style.color = '#ffaa00';
    try {
      socket = new WebSocket(url);
    } catch (err) {
      statusSpan.textContent = 'Invalid URL';
      statusSpan.style.color = '#e74c3c';
      return;
    }
    socket.onopen = () => {
      statusSpan.textContent = 'Connected';
      statusSpan.style.color = '#2ecc71';
    };
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.angle === 'number' && typeof data.distance === 'number') {
          updateData(data.angle, data.distance);
        }
      } catch (e) {
        console.error('Invalid message:', event.data);
      }
    };
    socket.onclose = () => {
      statusSpan.textContent = 'Disconnected';
      statusSpan.style.color = '#e74c3c';
    };
    socket.onerror = () => {
      statusSpan.textContent = 'Error';
      statusSpan.style.color = '#e74c3c';
    };
  }

  // Attach event handlers
  connectBtn.addEventListener('click', () => {
    connectWebSocket();
  });

  // Initialize canvas size on load
  resizeCanvas();
  drawRadar();
})();
