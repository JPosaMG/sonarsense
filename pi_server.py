import asyncio
import time
import json
import lgpio as GPIO
from gpiozero import AngularServo
import websockets

# Set up servo on GPIO 14 (SG90)
servo = AngularServo(14, min_angle=0, max_angle=180, min_pulse_width=0.5/1000, max_pulse_width=2.5/1000)

# Set up ultrasonic sensor (HC-SR04) pins
TRIG = 23
ECHO = 24
# Open the GPIO chip and claim pins
h = GPIO.gpiochip_open(0)
GPIO.gpio_claim_output(h, TRIG)
GPIO.gpio_claim_input(h, ECHO)


def get_distance():
    """Measure the distance using the HC-SR04 sensor and return it in centimeters."""
    # Ensure trigger is low
    GPIO.gpio_write(h, TRIG, 0)
    time.sleep(0.05)

    # Send 10μs pulse to trigger
    GPIO.gpio_write(h, TRIG, 1)
    time.sleep(0.00001)
    GPIO.gpio_write(h, TRIG, 0)

    # Record the start time
    pulse_start = time.time()
    while GPIO.gpio_read(h, ECHO) == 0:
        pulse_start = time.time()

    # Record the arrival time
    pulse_end = time.time()
    while GPIO.gpio_read(h, ECHO) == 1:
        pulse_end = time.time()

    # Calculate pulse duration
    pulse_duration = pulse_end - pulse_start

    # Distance calculation (speed of sound 343 m/s -> 34,300 cm/s; divide by 2 for round trip)
    distance_cm = pulse_duration * 17150
    return round(distance_cm, 2)


async def sweep_sensor(websocket):
    """Sweep the servo back and forth while sending angle and distance readings to clients."""
    angle = 0
    step = 5  # degrees per step
    direction = 1  # 1 for forward, -1 for backward

    while True:
        # Set servo angle
        servo.angle = angle

        # Read distance from sensor
        dist = get_distance()

        # Send JSON data over WebSocket
        data = {"angle": angle, "distance": dist}
        await websocket.send(json.dumps(data))

        # Adjust angle for next step
        angle += step * direction
        if angle >= 180:
            angle = 180
            direction = -1  # reverse direction
        elif angle <= 0:
            angle = 0
            direction = 1

        # Delay between readings
        await asyncio.sleep(0.1)


async def handler(websocket, path):
    """Handle incoming WebSocket connections."""
    print("Client connected")
    try:
        await sweep_sensor(websocket)
    except websockets.ConnectionClosed:
        print("Client disconnected")


async def main():
    """Start the WebSocket server and run indefinitely."""
    async with websockets.serve(handler, "", 8765):
        print("WebSocket server listening on port 8765")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        # Cleanup: release GPIO resources on exit
        GPIO.gpiochip_close(h)
