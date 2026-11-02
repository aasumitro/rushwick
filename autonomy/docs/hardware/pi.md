# Rushwick RC prototype: Raspberry Pi 5 hardware

This document specifies the hardware for the first Rushwick prototype: a 1:10 RC car with a Raspberry Pi 5 that runs Rushwick Autonomy, the reference driving stack in [`autonomy/`](../../README.md). It turns the `rc-pi` platform profile ([`src/sim/platform/profiles/rcPi.ts`](../../../src/sim/platform/profiles/rcPi.ts)) into parts, and lists which parts each stage of the sim-to-real plan needs.

An NVIDIA Jetson Orin Nano can replace the Pi: [`jetson.md`](jetson.md) reuses everything in this document except the compute board, its power supply, the camera and a few interfaces.

> [!NOTE]
> Every `rc-pi` value is an assumption until Phase C measures it. Treat the numbers below as targets: pick hardware that meets or beats them, measure what you built, and write the measured values into `rcPi.ts` with the date and the method next to each one. Specifications of named parts are approximate; check the datasheet of the unit you buy.

---

## 1. System overview

```
                 ┌──────────────────────── laptop ──────────────────────────┐
                 │ Rushwick: sim:bridge (HIL) or the browser Remote agent   │
                 │ overhead-camera localizer (track runs)                   │
                 └──────────────┬───────────────────────────────────────────┘
              Ethernet (HIL)    │    Wi-Fi (track runs)
┌──────────────────────────────┴──── RC car, 1:10 ───────────────────────────────────┐
│                                                                                    │
│  Raspberry Pi 5 ──USB──── 2D lidar                ──CSI──── Camera Module 3 Wide   │
│     │ I2C ─────────────── IMU                     ──USB──── Pico: wheel encoder    │
│     │ I2C ─────────────── PCA9685 ── ch0 steering ──┐                               │
│     │                        ▲     └─ ch1 throttle ─┤                              │
│     │ GPIO heartbeat ── HW watchdog ── OE           ├── RC mux ──┬── steering servo│
│     │                                RC receiver ───┘   ▲        └── ESC ── motor   │
│     │                                kill / manual switch                          │
│  2S LiPo ── ESC (BEC 6 V → servo)                                                  │
│      └───── 5.1 V 5 A regulator ── Pi 5 (lidar and camera powered by the Pi)       │
└────────────────────────────────────────────────────────────────────────────────────┘
```

The Pi never drives the servo or the ESC directly. Every command passes the car program's safety layer, the PCA9685 (whose outputs a hardware watchdog can switch off) and an RC multiplexer that lets a person take over or cut the throttle at any time.

## 2. What each stage needs

| Stage | Plan items | What happens | Hardware |
| :--- | :--- | :--- | :--- |
| Bench HIL | Batches 15–16 (C1–C3) | The Pi runs the car program against Rushwick in real time. With `--actuate` the commands also drive the servo and the ESC, with the wheels off the ground. | Chassis with servo, ESC and motor; Pi 5 with cooling and power; PCA9685; hardware watchdog; RC kill switch; Ethernet; bench stand; measurement tools |
| Track runs | Phase D | The car drives the physical twin of a Rushwick city and rebuilds the observation from its own sensors. | Everything above, plus wheel encoder, IMU, lidar, camera, localization and the track |

In HIL the observation still comes from the simulation, so the bench stage needs no lidar, camera, IMU, encoder or localization. Two calibrations need the car on the floor: the steering-center error (a straight-line test) and, later, the longitudinal response.

---

## 3. Vehicle platform

A 1:10 on-road **touring car** matches the profile's footprint almost exactly.

| Parameter | `rc-pi` value | Requirement | Why |
| :--- | :--- | :--- | :--- |
| Footprint | 0.45 × 0.20 m | About 420–460 × 185–205 mm | Collision footprint and object sizes scale from it |
| Wheelbase | 0.26 m | 250–270 mm | Sets the turning radius; the kinematic model scales exactly with it |
| Steering | Front, ±0.45 rad (26°) at the wheels | ≥ 26° each way, Ackermann linkage | The tightest turn on the placeholder track is a 0.61 m path radius; at 0.45 rad the car turns on 0.55 m, about 10% margin |
| Steering rate | 6 rad/s at the wheels | Servo ≤ 0.10 s/60° at 6 V | Matches the profile's servo assumption |
| Top speed | 3 m/s | ≥ 3 m/s, capped in software | Track speed limits are 1.39 m/s on roads and 0.40–0.49 m/s in turns |
| Acceleration / braking | 2 / 3 m/s² | Reached smoothly from standstill | Profile limits |
| Low-speed control | — | Smooth from 0.1 m/s | Most driving happens below 1.5 m/s |
| Reverse | — | Not needed | The simulator never reverses; use forward/brake mode |
| Mass | — | About 1.5–2 kg ready to drive | Leaves headroom for about 0.4 kg of electronics |

- **Drivetrain:** a sensored brushless motor (13.5T–21.5T class) or a brushed 540 motor with a high gear reduction. Both give fine control at walking speed. Avoid high-kV unsensored brushless motors, which cog at low speed.
- **Tires:** pick tires with grip on your floor. Tire slip is not modeled yet (risk R3), so avoid tire–floor combinations that slide.
- **Body:** remove the body shell or cut it down so the lidar sees 360°. Mount a flat deck (acrylic or 3D printed) on standoffs for the electronics.
- **Drag brake:** set the ESC's drag brake to 0%. The simulated car keeps its speed when the commanded acceleration is 0, and the closed-loop speed controller on the car compensates for rolling resistance.

## 4. Compute and power

### 4.1 Raspberry Pi 5

| Item | Requirement | Notes |
| :--- | :--- | :--- |
| Board | Raspberry Pi 5, 8 GB (4 GB minimum) | The profile's 60 ms compute delay assumes CPU-only inference at 10–15 detections per second |
| Cooling | Official Active Cooler or equivalent | Acceptance: no throttling during a 30-minute realtime run (`vcgencmd get_throttled` stays `0x0`) |
| Storage | microSD A2, 64 GB or more, or an NVMe SSD on an M.2 HAT+ | Long HIL logs and datasets |
| OS | Raspberry Pi OS 64-bit (Bookworm), Python 3.11 | CPU governor `performance` during measurements |
| Accelerator | Optional: AI HAT+ (Hailo) or AI Camera (IMX500) | Cuts the compute delay; if you add one, recalibrate `computeDelay` and `delayJitter` |

### 4.2 Power architecture

| Rail | Source | Consumers | Requirement |
| :--- | :--- | :--- | :--- |
| Drive | 2S LiPo, 7.4 V, 4000–5000 mAh, hard case | ESC and motor | ESC rated well above the motor's peak current; low-voltage alarm on the pack |
| Servo | ESC's BEC, 6 V | Steering servo (through the PCA9685 V+ rail or the RC mux) | BEC ≥ 3 A; never power the servo from the Pi's 5 V |
| Logic | Dedicated 5.1 V, 5 A switching regulator (UBEC) from the LiPo | Pi 5, and through it the lidar, camera, IMU, PCA9685 logic, Pico | Low-ripple output. On the bench, use the official 27 W USB-C supply instead |

- **USB current:** a supply that cannot negotiate 5 A over USB-C PD (for example a regulator on the GPIO 5 V pins) limits the Pi 5's USB ports to 600 mA in total. If the lidar and other USB devices need more, set `usb_max_current_enable=1` in `config.txt` and make sure the regulator really delivers 5 A.
- **Grounds:** the Pi, the PCA9685, the ESC and the servo share one ground.
- **Budget to plan for:**

| Consumer | Rail | Current to plan for |
| :--- | :--- | :--- |
| Pi 5 under load | 5 V | 1.5–2.5 A |
| Lidar | 5 V | about 0.5 A |
| Camera | 5 V | about 0.25 A |
| Servo peaks | 6 V | 1–2 A |
| Motor | 7.4 V | tens of amps peak |

- **Runtime:** a 30-minute HIL run needs about 30 minutes of low-throttle spinning on the bench from the drive pack, while the Pi runs from the wall supply.

## 5. Actuation and safety

### 5.1 PCA9685 PWM board

| Item | Requirement |
| :--- | :--- |
| Board | PCA9685 16-channel, 12-bit PWM over I2C, default address `0x40` |
| Frequency | 50 Hz (20 ms frame), 1000–2000 µs pulses, 1500 µs neutral |
| Channel map | Proposal: ch0 steering servo, ch1 ESC (to be confirmed before batch 15) |
| Resolution | 4096 steps per 20 ms = 4.9 µs per step, about 0.004 rad of steering, finer than the 0.02 steering deadband |
| Calibration knob | The internal oscillator (nominally 25 MHz) is off by a few percent from board to board. Measure a commanded 1500 µs pulse with a logic analyzer and correct the reference clock in a config value, not a constant |
| Output enable | Wire the active-low OE pin to the hardware watchdog (5.4) |
| Latency | A 50 Hz frame adds up to 20 ms before the servo sees a new command. Many digital servos accept faster frames; if yours does, measure it and update `actuationDelay` |

### 5.2 Steering servo

- Standard size, digital, metal gears.
- Speed ≤ 0.10 s/60° at 6 V, which gives the profile's 6 rad/s at the wheels with a 1:1 linkage.
- Torque ≥ 6 kg·cm.
- Deadband ≤ 10 µs. The profile's 0.02 steering deadband equals about 10 µs when full lock is ±500 µs.
- Repeatable centering. The profile assumes a steering-center error with a std of 0.03 rad (1.7°) per episode; trim it mechanically, then measure it with the straight-line test.
- No angle feedback, which is why the profile reports the commanded angle (`steer: 'commanded'`). A servo with analog feedback, or a sensor on the knuckle, would allow `'measured'` later.

### 5.3 ESC and motor

- Input: standard 50 Hz PWM.
- Mode: forward/brake with proportional braking. No reverse needed.
- Settings: drag brake 0%, linear throttle curve.
- Failsafe: neutral on signal loss within 100 ms. Verify this on the bench; the hardware watchdog relies on it.
- BEC: ≥ 3 A at 6 V for the servo.

The ESC takes throttle, not acceleration. `RealHardware` therefore needs a small longitudinal controller (feed-forward plus PI on the encoder speed) that turns the commanded acceleration into throttle. Phase C then measures the lag (`accelTimeConstant`, assumed 0.15 s) and the deadband (`accelDeadband`, assumed 0.1 m/s²) of the result.

### 5.4 Safety chain

Four independent layers, each able to stop the car on its own:

1. **Car program safety layer** (software, `safety.py`): steering clamp, speed cap (`--max-speed`), lidar stop (on by default with real hardware), and a 200 ms stale-frame watchdog that commands full braking.
2. **Hardware watchdog:** the control loop toggles a Pi GPIO at 20 Hz. A retriggerable timer (a Raspberry Pi Pico, or a 74HC123 monostable circuit) holds the PCA9685 OE pin low while the heartbeat arrives and pulls it high when it stops for more than 100 ms. With OE high the outputs stop, and the ESC fails safe to neutral. This layer matters because the PCA9685 keeps sending its last pulses when the Pi hangs.
3. **RC override and kill switch:** a 2.4 GHz transmitter and receiver (at least 3 channels, with failsafe) and an RC servo multiplexer. One transmitter switch selects manual or autonomous control; a kill switch forces neutral throttle. Acceptance (C2): it cuts throttle within 100 ms.
4. **Mechanical:** a bench stand for every actuation test (wheels off the ground), foam bumpers for track runs, and a spotter holding the transmitter.

### 5.5 Where the actuator profile values come from

| Profile value | Assumed | Comes from | How to measure (C3) |
| :--- | :--- | :--- | :--- |
| `controlHz` | 20 Hz | Control loop on the Pi | Loop timing in the HIL log |
| `computeDelay` | 60 ms | Perception and inference on the Pi | Inference time in the HIL log |
| `actuationDelay` | 20 ms | PWM frame plus servo or ESC reaction | 240 fps video: LED switched with the command vs. servo horn motion |
| `delayJitter` | 15 ms | Variation of both | Spread of the measured round trip and inference times |
| `accelTimeConstant` | 0.15 s | ESC, motor and speed controller | Acceleration step response on the floor |
| `accelDeadband`, `steerDeadband` | 0.1 m/s², 0.02 | ESC neutral band, servo deadband | Smallest command that moves the wheels |
| `steerBiasStd` | 0.03 rad | Mechanical steering center | Straight-line test: lateral drift over a known distance with steering 0 |

---

## 6. Sensors

Each subsection starts from the `rc-pi` sensor channel it feeds (real units). Rushwick's frames: ego x forward, y left, heading and yaw rate counter-clockwise positive, lidar ray `i` at `2π·i/32` counter-clockwise from the heading. Match every sensor to these conventions and check the signs on the bench.

### 6.1 Wheel speed: ego state `speed`

| Profile | Requirement |
| :--- | :--- |
| 30 Hz, 20 ms latency, σ 0.03 m/s, resolution 0.01 m/s | At least 3000 counts per meter of travel (≤ 0.33 mm per count), so a 33 ms window resolves 0.01 m/s |

- With a 64 mm touring wheel (about 0.20 m per revolution) that is at least 600 counts per wheel revolution. On the motor side of an N:1 drivetrain (N ≈ 6–10) it is at least 600/N, about 60–100 counts per motor revolution (15–25 lines with quadrature decoding).
- **Options:**
  - a magnetic quadrature encoder, or a hall sensor with a multi-pole magnet, on the motor shaft or the center driveshaft;
  - an AS5600 magnetic angle sensor on a slow shaft, sampled fast enough to stay below half a revolution per sample;
  - the hall signals of a sensored brushless motor, tapped with a Y-cable.
- **Interface:** count pulses on a Raspberry Pi Pico (PIO) and stream the speed at 100 Hz over USB serial. GPIO interrupts on the Pi also work, with more jitter.
- 4WD touring cars: measure the center shaft or the motor. Wheel slip is ignored.

### 6.2 IMU: ego state `yawRate` and `accel`

| Profile | Requirement |
| :--- | :--- |
| 30 Hz, 20 ms latency; yaw rate σ 0.02 rad/s with a bias walk of 0.001 rad/s/√s; acceleration σ 0.2 m/s² | Meet these numbers on the running car, with the motor vibrating |

- Any current 6-axis MEMS IMU meets them on paper. A gyro noise density of 3–5 mdps/√Hz gives about 0.0004 rad/s at 30 Hz. Vibration from the motor and drivetrain is the real limit.
- **Recommended:** ICM-42688-P or LSM6DSOX (6-axis, I2C or SPI), or BNO085 (on-chip fusion). The MPU-6050 works but is older and noisier.
- **Mounting:** near the center of the car on vibration-damping foam or gel, axes aligned with x forward, y left, z up. A left turn must read a positive yaw rate.
- **Processing:** sample at ≥ 200 Hz, low-pass filter, publish at 30 Hz. Estimate the gyro bias at standstill at every start.

### 6.3 Steering angle: ego state `steer`

No sensor. The profile uses `steer: 'commanded'`: the car program reports the angle it commanded, as a servo without feedback requires (see 5.2).

### 6.4 2D lidar: `lidar` (32 rays)

| Profile | Requirement |
| :--- | :--- |
| 10 Hz, 50 ms latency, range 12 m, σ 2 cm, minimum 5 cm, 2% dropouts | 360° scan at ≥ 10 Hz, ≥ 360 samples per scan, accuracy ±3 cm, range ≥ 6 m (the track is 4.7 m across) |

- **Recommended:** Slamtec RPLidar C1 (DTOF, 360°, about 0.05–12 m, about 10 Hz, about 5000 samples per second, ±30 mm, USB-UART adapter included, Class 1 laser). Alternative: an LDRobot LD19-class DTOF lidar (12 m, 10 Hz, UART).
- **Mounting:**
  - on the car's center line, as close to the vehicle center as possible (the simulated lidar is cast from the ego center; record any offset and correct for it in software);
  - scan plane about 12–15 cm above the floor, level, above every part of the car.
- **Conventions:** RPLidar angles increase clockwise, while Rushwick rays go counter-clockwise. Convert, correct the mounting yaw, and check with a box placed to the car's left (it must show up near ray 8).
- **Downsampling to 32 rays:** take the beam nearest to each ray angle, which is closest to how the simulation casts single rays. A ray without a return reads the range (12 m); invalid beams count as dropouts.
- **Note:** the physical track has no curbs, so the real lidar sees only boxes, cars and people, while the simulated lidar also sees curbs (README, Known Limitations).

### 6.5 Camera: `vehicles`, `pedestrians` and the traffic light

| Channel | Profile | Requirement |
| :--- | :--- | :--- |
| Objects | 10 Hz, 100 ms latency, 100° field of view, range 3 m, position σ 3 cm + 3% of the distance, velocity σ 5 cm/s, missed 5% + 3% per meter, occlusion | ≥ 100° horizontal field of view; 10 detections per second, each ready ≤ 100 ms after exposure |
| Signals | 10 Hz, 100 ms latency, range 5 m, missed 5%, misread 2%, no time left | The light at the next stop line resolved and classified up to 5 m |

- **Recommended:** Raspberry Pi Camera Module 3 Wide (Sony IMX708, 12 MP, about 102° horizontal, autofocus). On the Pi 5 it needs the 22-pin to 15-pin camera cable.
- **Mounting:** front of the car, centered, lens about 10–15 cm above the floor, tilted slightly down so the floor from about 0.3 m to 3 m and the lights up to 5 m are in view. Mount it rigidly and measure its height and pitch.
- **Calibration:** intrinsics with a checkerboard; extrinsics (height, pitch, offset from the vehicle center) measured.
- **Processing:**
  - a small detector on the CPU, for example a quantized SSD or YOLO-nano class model at about 320 × 320;
  - ground-plane projection into the ego frame (x forward, y left) using the calibration;
  - velocities from a simple tracker.
- **Lights:** a color and shape classifier for the toy traffic lights (section 7). The time left is never known (`NaN`), as in the profile.
- An AI accelerator (section 4.1) lowers the latency; recalibrate if you use one.

### 6.6 Localization: ego pose (decision Q3)

| Profile | Requirement |
| :--- | :--- |
| 30 Hz, 50 ms latency, position σ 2 cm, heading σ 0.02 rad, slow drift 3 cm over about 5 s | Pose of the car in track coordinates at 30 Hz, ≤ 50 ms from exposure to arrival on the Pi, ≤ 2 cm and ≤ 1° error |

**Option A, recommended first: overhead camera.**
- A USB camera on the ceiling above the track, 1080p at 30 fps, wide lens.
- Field of view: to cover the 4.7 m track plus margin (about 5.5 m) from a mounting height `h`, it needs `2·atan(2.75 / h)`: about 93° at 2.6 m. A higher mount allows a narrower lens.
- Resolution: 1920 pixels over about 5.5 m is about 3 mm per pixel.
- Markers:
  - an AprilTag (`tag36h11`, 10–12 cm, about 35 pixels across) flat on a roof plate centered over the vehicle center;
  - four more tags fixed at known track coordinates for the floor homography.
- Processing: AprilTag detection on the laptop (about 10 ms), pose sent to the car over Wi-Fi at 30 Hz.
- Calibration: lens distortion with a checkerboard; accuracy checked against tape-measured points (target ≤ 2 cm).

**Option B: AprilTags around the track, seen by the onboard camera.**
- Needs no ceiling mount.
- Accuracy and coverage depend on how many tags are in view, so 2 cm is harder to reach.

### 6.7 Observation fields and their sources on the car

| Observation field | Source on the car |
| :--- | :--- |
| `ego.speed` | Wheel encoder (6.1) |
| `ego.accel`, `ego.yawRate` | IMU (6.2) |
| `ego.steer` | Commanded angle (6.3) |
| `ego.length`, `width`, `wheelBase`, `maxSteer` | Vehicle configuration (section 3) |
| `ego.x`, `ego.y`, `ego.heading` | Localization (6.6) |
| `route.*` (waypoints, lateral and heading error, progress, speed limits, stop distance) | Track map (exported from Rushwick) plus localization |
| `route.nextStop.light` | Camera light classifier (6.5) |
| `route.nextStop.timeLeft` | Always unknown (`NaN`) |
| `vehicles`, `pedestrians` | Camera detector with tracking (6.5), optionally fused with the lidar |
| `lidar` (32 rays) | 2D lidar downsampled (6.4) |

Every value is converted to sim units (times `scale`, 10) before `encode_observation()`, exactly as `OnnxPolicy` does in SIL.

---

## 7. Track and room (decision Q4, still a placeholder)

The current `rc-pi` world preset is a placeholder until the room is measured. At 1:10 it is:

| Element | Simulation | Real (1:10) |
| :--- | :--- | :--- |
| Overall square | 47 × 47 m | 4.7 × 4.7 m |
| Road centerlines | 2 × 2 grid, 30 m apart | 3.0 m apart |
| Roads | One lane per direction, 3.5 m lanes | 0.70 m wide, 0.35 m lanes |
| Sidewalks | 3.5 m | 0.35 m |
| Curb corner radius | 4.5 m | 0.45 m |
| Inner block (curb to curb) | 23 × 23 m | 2.3 × 2.3 m |
| Building | One box of about 10.7 × 10.7 m (seed-dependent) | About 1.07 × 1.07 m |
| Outer border | 5 m | 0.5 m |
| Signals | None: the four corners are plain turns, forming two one-way loops | None |
| Speed limits | 13.9 m/s on roads, 3.95–4.94 m/s in turns | 1.39 m/s, 0.40–0.49 m/s |

- **Room:**
  - at least 5.5 × 5.5 m of clear, flat floor;
  - matte, even floor surface (good for the lidar, the camera and the tires);
  - even indoor light, no direct sunlight;
  - a ceiling mount point about 2.5–3 m high for the overhead camera.
- **Materials:**
  - floor tape for lane edges and center lines (for people and future vision: the reference stack drives from the map plus localization, not from the lines);
  - matte cardboard boxes as buildings, at least 30 cm tall (above the lidar plane);
  - AprilTags for the overhead camera.
  - No raised curbs are needed.
- **Traffic lights (later):** small red, yellow and green LED lights at the stop lines, driven by a microcontroller (for example an ESP32 or a Pico W) in sync with Rushwick's fixed-time signal plan. The placeholder track has no signals, so they wait for a larger grid.
- **Exact layout:** the Phase D track export (`track:export`, an SVG at real scale) will give the exact positions for taping.

## 8. Network and laptop

- **Laptop:**
  - Node.js 22.12 or newer for Rushwick;
  - Python 3.9+ in a virtualenv for the car program and the localizer;
  - a Gigabit Ethernet port, or a USB adapter.
- **HIL (Phase C):** a direct Ethernet cable between the laptop and the Pi. Measure Wi-Fi separately (risk R6).
- **Track runs:** a Wi-Fi 5 access point. The car drives on its own; the laptop sends localization and monitors through the browser Remote agent and the logs.
- **Addressing:** a static IP or `raspberrypi.local` (mDNS).

## 9. Tools for bench and calibration

- Bench stand (wheels off the ground), safety glasses, LiPo bag and a fire-safe charging spot.
- Phone with 240 fps slow motion, for `actuationDelay`.
- Logic analyzer (8 channels, ≥ 24 MHz) or oscilloscope, for PWM calibration and GPIO timestamps.
- Multimeter and USB power meter.
- Tape measure (≥ 5 m), angle gauge for the steering range, floor tape.
- `vcgencmd measure_temp` and `vcgencmd get_throttled` for the thermal checks.

---

## 10. Bill of materials

| # | Item | Specification | Qty | Stage |
| ---: | :--- | :--- | ---: | :--- |
| 1 | 1:10 touring-car chassis (kit or RTR) | About 450 × 200 mm, wheelbase 250–270 mm, ≥ 26° steering | 1 | Bench |
| 2 | Steering servo | Digital, ≤ 0.10 s/60° at 6 V, ≥ 6 kg·cm, metal gears, deadband ≤ 10 µs | 1 | Bench |
| 3 | ESC | Forward/brake, proportional brake, drag brake 0%, failsafe to neutral, BEC ≥ 3 A at 6 V | 1 | Bench |
| 4 | Motor | Sensored brushless 13.5T–21.5T, or brushed 540 with high reduction | 1 | Bench |
| 5 | 2S LiPo with balance charger and LiPo bag | 7.4 V, 4000–5000 mAh, hard case, low-voltage alarm | 1–2 | Bench |
| 6 | Raspberry Pi 5 | 8 GB (4 GB minimum) | 1 | Bench |
| 7 | Active Cooler | Official or equivalent | 1 | Bench |
| 8 | USB-C power supply | Official 27 W (5.1 V, 5 A) | 1 | Bench |
| 9 | Storage | microSD A2 ≥ 64 GB, or NVMe SSD with M.2 HAT+ | 1 | Bench |
| 10 | PCA9685 board | 16 channels, 12 bit, I2C, OE pin broken out | 1 | Bench |
| 11 | Hardware watchdog | Raspberry Pi Pico, or a 74HC123 retriggerable monostable circuit | 1 | Bench |
| 12 | RC transmitter and receiver | 2.4 GHz, ≥ 3 channels, receiver failsafe | 1 | Bench |
| 13 | RC servo multiplexer | Manual/autonomous switching by an RC channel | 1 | Bench |
| 14 | Ethernet cable | Cat 6 | 1 | Bench |
| 15 | Bench stand | Wheels off the ground | 1 | Bench |
| 16 | Mounting material | Deck plate, standoffs, damping foam, cable ties, JST/Dupont cables | — | Bench |
| 17 | Measurement tools | Logic analyzer, multimeter, phone with slow motion, tape measure (section 9) | — | Bench |
| 18 | 5.1 V 5 A regulator (UBEC) | Switching, low ripple, input from 2S | 1 | Track |
| 19 | Wheel encoder | Magnetic quadrature or hall sensor with magnet, ≥ 3000 counts per meter | 1 | Track |
| 20 | IMU | ICM-42688-P, LSM6DSOX or BNO085 breakout | 1 | Track |
| 21 | 2D lidar | RPLidar C1, or LD19-class | 1 | Track |
| 22 | Camera | Camera Module 3 Wide with the Pi 5 camera cable (22 to 15 pin) | 1 | Track |
| 23 | Overhead camera | USB, 1080p at 30 fps, wide lens, ceiling mount | 1 | Track |
| 24 | AprilTags | `tag36h11`, 10–12 cm, on rigid backing | ≥ 5 | Track |
| 25 | Track materials | Floor tape, matte cardboard boxes ≥ 30 cm tall | — | Track |
| 26 | Traffic lights | LED lights and a microcontroller (later, larger track) | — | Later |
| 27 | AI accelerator | AI HAT+ or AI Camera (optional; changes the compute delay) | — | Optional |

## 11. Checklist before batch 15

- [ ] The Pi 5 boots Raspberry Pi OS 64-bit, `pip install -e "autonomy[onnx]"` works, the CPU governor is `performance`, and the Ethernet link to the laptop is up.
- [ ] `vcgencmd get_throttled` reads `0x0` after 10 minutes of full CPU load with the cooler.
- [ ] `i2cdetect -y 1` shows the PCA9685 at `0x40`, and after clock calibration a commanded 1500 µs pulse measures within ±5 µs.
- [ ] The servo centers, reaches ≥ 0.45 rad each way without binding, and a positive command steers left.
- [ ] The ESC is in forward/brake mode with drag brake 0%, its neutral is calibrated, and it falls back to neutral on signal loss.
- [ ] Stopping the heartbeat disables the PCA9685 outputs within 100 ms.
- [ ] The RC kill switch cuts the throttle within 100 ms, and manual override works.
- [ ] The channel map is written down (proposal: ch0 steering, ch1 throttle).
- [ ] The car sits on the bench stand, and the LiPo safety gear is in place.

## 12. Open decisions

- Compute board: Raspberry Pi 5 (this document) or Jetson Orin Nano ([`jetson.md`](jetson.md)).
- PCA9685 channel map (proposal: ch0 steering, ch1 throttle).
- Motor type: sensored brushless or brushed.
- Localization: option A (overhead camera) or B (AprilTags around the track). Q3 suggests starting with A.
- Room size (Q4): it fixes the final track preset and the overhead camera's height and lens.
- Whether to add an AI accelerator, which requires recalibrating the compute delay.
