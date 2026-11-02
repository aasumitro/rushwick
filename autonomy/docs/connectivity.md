# Rushwick Autonomy: connectivity and remote access

How people, the laptop, a phone and Rushwick reach the vehicle computer (Raspberry Pi 5 or Jetson Orin Nano), and which transport carries what. The goal is the fastest setup with the fewest ways to fail: one runtime transport, no message broker, and safety that never depends on Wi-Fi.

## 1. Decision in brief

- **Development access:** SSH with keys for commands, Git for code, and `rsync` over SSH for logs, models and datasets. Boards are found by name (`rushwick-pi.local`, `rushwick-jetson.local`).
- **Runtime transport:** WebSocket only. It already carries bridge protocol v1, and Node.js, Python and every phone browser speak it without extra dependencies. Three channels:
  - **Bridge:** Rushwick ↔ car program (existing, port 8765).
  - **Teleop:** phone → car program. Manual driving from a web page that the car serves (port 8080, no app to install).
  - **Telemetry:** car program → phone or laptop. Publish/subscribe over the same server, newest sample only.
- **Safety stays off the network:** the 2.4 GHz RC transmitter (manual override and kill switch), the hardware watchdog, and the software watchdogs on both ends. A phone is never the kill switch.
- **No broker now:** NSQ, MQTT and Kafka add moving parts and the wrong delivery semantics for steering (section 7). ROS 2 is the next step once the car runs several sensor processes (track stage).

## 2. Network

```
            5 GHz Wi-Fi (dedicated travel router, no internet exposure)
   ┌────────────────┬──────────────────┬─────────────────────────┐
 laptop          phone            vehicle computer         (2.4 GHz RC radio:
 Rushwick,       teleop page,     rushwick-pi.local or      transmitter → receiver
 SSH, rsync      telemetry        rushwick-jetson.local     → RC multiplexer,
   │                                    │                    independent of Wi-Fi)
   └──────── Ethernet cable (HIL calibration runs only) ────┘
```

- **Router:** a dedicated travel router, Wi-Fi on **5 GHz only**, so it never competes with the 2.4 GHz RC radio.
  - DHCP reservations for every device.
  - Hostnames `rushwick-pi` and `rushwick-jetson`, reachable over mDNS (`.local`).
  - No port forwarding to the internet.
- **Ethernet:** a direct cable between laptop and board for every latency calibration run. Wi-Fi latency is measured separately and reported apart.
- **Fallback:** the board's own access point (NetworkManager hotspot) when no router is around. Keep using the same hostnames.

## 3. Development access

| Need | Tool | How |
| :--- | :--- | :--- |
| Shell and commands | SSH, key-only | `ssh rushwick-pi`; password login disabled on the board |
| Code | Git | The board clones the repository and checks out the same commit as the laptop (`git fetch && git checkout <branch>`); the car program logs `git rev-parse HEAD` at start |
| Logs, models, datasets | `rsync` over SSH | `rsync -av rushwick-pi:rushwick/runs/ runs/pi/` and `rsync -av model.onnx rushwick-pi:rushwick/models/` |
| Python environment | virtualenv on the board | `pip install -e "autonomy[pi]"` or `"autonomy[jetson]"` |
| Long runs | `tmux`, or a systemd user service | Runs survive a dropped SSH session |
| Clocks | `chrony` (NTP) on every machine | Comparable log timestamps; latency itself is always measured on one clock (round trips) |

Example `~/.ssh/config` on the laptop:

```
Host rushwick-pi
  HostName rushwick-pi.local
  User rushwick
  IdentityFile ~/.ssh/id_ed25519_rushwick
Host rushwick-jetson
  HostName rushwick-jetson.local
  User rushwick
  IdentityFile ~/.ssh/id_ed25519_rushwick
```

**Agent access.** With these host entries and the key in place, the coding agent runs board commands from the laptop:
- `ssh rushwick-pi '<command>'` for commands;
- `rsync` to bring results back.

No password or key ever goes through the chat. Without SSH access, the user runs the board commands and pastes the summaries.

## 4. Runtime channels

| Channel | Direction | Transport | Rate | Semantics | When it fails |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Bridge v1 | Rushwick ↔ car program | WebSocket JSON, port 8765 (existing) | 30 Hz frames, commands on control ticks | Ordered by `seq`; lockstep or realtime | Both sides watchdog: the car program brakes after 200 ms without frames, Rushwick after 250 ms without commands |
| Teleop | Phone → car program | WebSocket JSON, port 8080, path `/ws` | 30 Hz | Newest message wins; `seq` drops late or out-of-order messages; deadman | Full brake after 250 ms without a message, on disconnect, or when the deadman is released |
| Telemetry | Car program → phone, laptop | Same server as teleop, server push | ≤ 10 Hz per topic | Publish/subscribe; each subscriber gets only the newest sample (no queue) | Display only; nothing depends on it |
| Logs and data | Board → laptop | Files, `rsync` after the run | — | Reliable, offline | Rerun the copy |
| Safety override | RC transmitter → multiplexer | 2.4 GHz RC radio | About 50 Hz | Hardware failsafe | Receiver failsafe to neutral |

## 5. Teleop: manual driving from a phone

### 5.1 Flow

```
phone browser ──▶ http://rushwick-pi.local:8080/?token=… (page served by the car program)
      │  WebSocket /ws, 30 Hz
      ▼
car program: teleop source ──▶ safety layer ──▶ SIL: command to Rushwick over bridge v1
                                            └─▶ car: PCA9685 → RC multiplexer → servo, ESC
```

- **The page** is a single HTML file with inline JavaScript: an on-screen two-axis joystick (Pointer Events) that is also the deadman, a speed scale slider, mode buttons (Autonomous, Teleop, Stop), and the live mode, speed and round trip. No app and no build step.
- **Start it** with `rushwick-autonomy --teleop` (port 8080 by default). The car program prints the page address with a random token; `--teleop-token` sets a fixed one and `--teleop-max-speed` the speed cap (default 1.0 m/s).
- **Serving it:** the car program serves the page from the same `websockets` server through its `process_request` hook, so no new dependency is needed.
- **Python side:** `asyncio` sets `TCP_NODELAY` on every TCP connection, so small messages leave immediately.

### 5.2 Messages

```jsonc
// phone → car, 30 Hz while the page is open
{ "type": "teleop", "seq": 812, "sentAt": 123456.7, "steering": -0.25, "throttle": 0.4, "deadman": true }
// car → phone, after each teleop message (round trip shown on the page)
{ "type": "teleop-ack", "seq": 812, "sentAt": 123456.7, "mode": "teleop", "braking": false }
```

- `steering` and `throttle` are normalized to `[-1, 1]`; positive steering turns left, as in `DrivingAction`.
- Throttle maps to an acceleration command:
  - forward: `throttle · teleop max acceleration`;
  - backward: `throttle · max braking`, which only brakes (the car never reverses, like the simulator).
- The teleop speed cap (configurable, for example 1.0 m/s on the RC car) applies in the safety layer.
- Every message is validated like bridge v1 commands; an invalid message ends the session, and the watchdog brakes.

### 5.3 Rules that keep teleop safe

1. **Deadman:** the car moves only while a finger is on the joystick; lifting it brakes fully.
2. **Watchdog:** 250 ms without a valid message brakes fully, the same value as the bridge.
3. **One controller:** the first phone with the right token gets control; later connections only receive telemetry. Control is released on disconnect, and the car stays stopped (it never falls back to the policy on its own) until a phone switches modes.
4. **Modes:** `autonomous` (the policy drives), `teleop` (the phone drives) and `stopped`.
   - Switching between `autonomous` and `teleop` happens only while the car is stopped.
   - `stopped` is always one tap away.
5. **The RC transmitter overrides everything in hardware.** Teleop never replaces the kill switch.
6. **Safety layer always on:** teleop commands go through `safety.py` like policy commands (steering clamp, speed cap, lidar stop on real hardware).

### 5.4 Latency budget

- Phone → car program: ≤ 50 ms at p95 on the 5 GHz LAN. The page shows its measured round trip.
- In-car path to the wheels: the same `actuationDelay` as for the policy.
- When the page shows a p95 above 100 ms, the Wi-Fi is too busy for teleop: move closer or change the channel.

### 5.5 Testing without hardware

In SIL the car program forwards teleop commands to Rushwick instead of the policy's. The same page then drives the simulated car in the browser view, so the whole teleop chain is tested before any board or car exists:
- validation;
- deadman;
- watchdog;
- the controller lock;
- the safety layer.

## 6. Telemetry topics

| Topic | Content | Rate |
| :--- | :--- | :--- |
| `state` | Mode, speed, the last command (acceleration, steering), watchdog state, whether a phone has control, safety interventions | 10 Hz |
| `system` | Temperatures, clocks and throttling, CPU and GPU load and power, from the board's stats backend (with `--config` and `--log`) | 1 Hz |

Latency percentiles are not streamed: they come from the HIL logs (`python -m rushwick_autonomy.report`).

Clients subscribe with `{ "type": "subscribe", "topics": ["state", "system"] }`. A slow client skips samples rather than building a queue.

## 7. Why not NSQ, or another broker, now

| Option | Good at | Why not for this prototype now |
| :--- | :--- | :--- |
| NSQ | Durable, scalable message processing pipelines | Delivery is at least once and unordered, so a late or repeated steering command can reach the car after a newer one. Extra daemons (`nsqd`, `nsqlookupd`) are more parts that can fail, and there is no browser client for a phone |
| MQTT (Mosquitto) | IoT telemetry, last-will messages, phone dashboards | A broker hop and a single point of failure in the control path; fine later for fleet telemetry |
| ROS 2 (DDS or Zenoh middleware) | The robotics standard for many processes and sensors, with tools such as rosbag and Foxglove | Heavy for one process today; Raspberry Pi OS is not a tier-1 ROS 2 platform (Ubuntu is). The right step at the track stage |
| WebRTC data channel | Unreliable, unordered channel without head-of-line blocking on lossy links | Needs signaling and extra libraries; WebSocket on a clean 5 GHz LAN meets the budget |
| Raw UDP | Lowest latency | Browsers cannot send raw UDP, so it needs a native app |

**Upgrade path:**
- When the track stage adds camera, lidar and localization processes, introduce ROS 2 inside the car (with a Zenoh or DDS middleware) and map bridge protocol v1 1:1 to topics, as planned.
- Phones and browsers keep using WebSocket through a bridge such as `foxglove_bridge`.

## 8. Checklist against mistakes

- [ ] One transport (WebSocket), one validator per message type, `seq` on every message.
- [ ] Newest-wins for commands; no queue anywhere in a control path.
- [ ] Watchdogs on both ends, plus a deadman for teleop.
- [ ] RC transmitter and hardware watchdog tested before any powered run.
- [ ] Laptop and board on the same Git commit; the car program logs it at start.
- [ ] One config file per board (`autonomy/configs/<board>.json`).
- [ ] Ethernet for calibration runs; 5 GHz Wi-Fi only, away from the RC radio's 2.4 GHz band.
- [ ] Local network only: SSH key-only, teleop token required, nothing exposed to the internet.
