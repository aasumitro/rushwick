# Rushwick RC prototype: NVIDIA Jetson hardware

This document specifies the Jetson alternative to the Raspberry Pi 5 build in [`pi.md`](pi.md). The car, the actuation and safety chain, the sensors, the track and the tools stay the same. Only the compute board changes, and with it the power supply, the camera, a few interfaces and the software stack. Read the Pi document first; this one lists what differs.

> [!NOTE]
> Specifications of named parts are approximate; check the datasheet of the unit you buy. The simulator's `rc-jetson` profile (section 7) carries estimates until then, so every perception and compute number here is a target to measure in Phase C.

---

## 1. Why a Jetson, and what it costs

A Jetson adds an NVIDIA GPU with CUDA and TensorRT. Perception runs on the GPU instead of the CPU, which brings:

- a lower compute delay;
- higher detection rates;
- larger detectors;
- room for depth cameras and, later, end-to-end vision models.

The price is more power, more weight, a 19 V supply and a different software stack.

| | Raspberry Pi 5 | Jetson Orin Nano 8 GB |
| :--- | :--- | :--- |
| CPU | 4 × Cortex-A76, 2.4 GHz | 6 × Cortex-A78AE, up to about 1.7 GHz |
| GPU for inference | None usable (optional Hailo accelerator) | 1024-core Ampere GPU with 32 Tensor Cores, up to about 67 INT8 TOPS (sparse) in the Super modes |
| Memory | 2–16 GB LPDDR4X (8 GB recommended) | 8 GB LPDDR5 |
| Perception speed | CPU-only small detectors, 10–15 per second (the `rc-pi` assumption) | TensorRT on the GPU; small detectors typically 30 per second or more (to be measured) |
| Power | About 5–12 W at 5 V | About 7–25 W (power modes); 19 V input on the developer kit |
| Size and mass | Smaller, lighter | About 100 × 79 mm developer kit, heavier |
| Camera | Camera Module 3 Wide, native | IMX219 or IMX477 CSI cameras, USB cameras or depth cameras (section 4) |
| Software | Raspberry Pi OS, Python 3.11 | JetPack 6 (Ubuntu 22.04), Python 3.10, CUDA, TensorRT |
| Sim profile | `rc-pi` | `rc-jetson`, with estimates until measured (section 7) |
| Pick it when | The cheapest path that matches the current plan exactly | You want bigger models, faster detection, depth cameras or vision-first perception |

## 2. What stays the same

| Pi document section | For the Jetson build |
| :--- | :--- |
| 1 System overview | Same diagram with the Jetson in place of the Pi; the Jetson's USB ports power the lidar and USB cameras |
| 2 Stages | Same: bench HIL needs no sensors; track runs need all of them |
| 3 Vehicle platform | Same touring car. Weigh the electronics deck: the Jetson, its fan and its power converter add mass, so check the suspension and the 1.5–2 kg target |
| 5 Actuation and safety | Same PCA9685, servo, ESC, hardware watchdog, RC kill switch and bench rules; interface notes in section 5 below |
| 6.1 Wheel encoder, 6.2 IMU, 6.3 Steering, 6.4 Lidar, 6.6 Localization | Same parts and requirements; interface notes in section 5 below |
| 6.5 Camera | Different part, same requirements: section 4 below |
| 6.7 Observation sources | Same |
| 7 Track and room, 8 Network, 9 Tools | Same; thermal monitoring uses `tegrastats` instead of `vcgencmd` |

---

## 3. Compute and power

### 3.1 Jetson board

| Item | Requirement | Notes |
| :--- | :--- | :--- |
| Board | NVIDIA Jetson Orin Nano 8 GB Developer Kit | Use JetPack 6.2 or newer, which includes the "Super" power modes; older kits get them with the software update |
| More performance | Jetson Orin NX 8 or 16 GB on a compact third-party carrier | More GPU, more power; check the carrier's size and input voltage |
| Avoid | The original Jetson Nano (2019) | End of life on JetPack 4 (Ubuntu 18.04, Python 3.6); the car program needs Python 3.9 or newer |
| Avoid | Jetson AGX Orin and Thor | Too large and power-hungry for a 1:10 car |
| Storage | NVMe SSD (M.2 Key M), 128 GB or more | Faster than microSD for logs, datasets and TensorRT engines; boot from it |
| OS | JetPack 6.x: Ubuntu 22.04, CUDA 12, TensorRT, Python 3.10 | |
| Cooling | The developer kit's heatsink with fan | Acceptance: no thermal throttling during the 30-minute realtime run (`tegrastats`) |
| Power mode | One fixed `nvpmodel` mode, plus `sudo jetson_clocks`, during measurements | The Jetson counterpart of the Pi's `performance` governor: stable latency. Record the mode with every measurement |

### 3.2 Power architecture

| Rail | Source | Consumers | Requirement |
| :--- | :--- | :--- | :--- |
| Drive | 2S LiPo, as in the Pi build | ESC and motor | Unchanged |
| Servo | ESC's BEC, 6 V | Steering servo | Unchanged |
| Compute | DC-DC converter at the carrier board's input voltage (19 V for the developer kit), ≥ 40 W | Jetson, and through it the lidar, cameras, IMU, PCA9685 logic, Pico | Low ripple; never wire a LiPo straight to the barrel jack unless the carrier's datasheet allows the pack's full voltage range |
| Compute battery (recommended) | Separate 3S LiPo, 2200–3000 mAh, feeding the converter | Jetson only | Keeps motor current spikes from browning out the computer. Feeding the converter from the drive pack also works with a good input filter |

- **Budget:** plan for 25 W at the highest power mode, plus about 0.5 A at 5 V for the lidar and the camera's share. A 25 W load for a 30-minute run is about 12.5 Wh, which a 3S 2200 mAh pack (about 24 Wh) covers with margin.
- **Bench:** the developer kit's own 19 V adapter.
- **Grounds:** the Jetson, the PCA9685, the ESC and the servo share one ground, as in the Pi build.

## 4. Camera

The requirements of the Pi document's section 6.5 stay: ≥ 100° horizontal field of view, objects up to 3 m and lights up to 5 m. The Camera Module 3 (IMX708) has no driver in JetPack out of the box, so pick one of these:

| Option | Interface | Notes |
| :--- | :--- | :--- |
| **A. IMX219 camera with a wide lens (recommended)** | CSI (22-pin connector on the developer kit; 15-pin cameras need a 22-to-15-pin cable) | Supported by JetPack's camera stack (`nvarguscamerasrc`); choose a lens with ≥ 100° horizontal field of view (120°–160° diagonal modules exist) and calibrate the distortion |
| B. IMX477 camera with a wide M12 or CS lens | CSI | Better image, larger and heavier |
| C. USB (UVC) camera, 1080p at 30 fps, wide lens | USB 3 | Simplest drivers; somewhat more latency than CSI |
| D. Depth camera (Intel RealSense D435i class) | USB 3 | Metric 3D positions (less position noise in the objects channel) and an IMU, but a narrower field of view (about 87° for depth). Pair it with a wide RGB camera, or lower the profile's `fovDeg` to match |

- **Mounting and calibration:** same as the Pi build: front, centered, 10–15 cm above the floor, tilted slightly down; checkerboard intrinsics, measured extrinsics.
- **Processing:**
  - a detector compiled with TensorRT (FP16 or INT8) on the GPU, for example a YOLO nano or small class model;
  - ground-plane projection (or depth) into the ego frame;
  - a tracker for velocities.
- **What may change in the channel:** detections at 20–30 per second instead of 10, latency well below 100 ms, longer range at a higher input resolution. Measure them; they belong in a Jetson profile (section 7).

## 5. Interfaces

- **40-pin header:** Raspberry Pi-compatible pin layout with 3.3 V logic. The I2C pins are in the same places (3/5 and 27/28), but the Linux bus numbers differ from the Pi's `/dev/i2c-1`. Find them with `i2cdetect -l` and `sudo i2cdetect -y -r <bus>`, and make the bus a setting of the car program, not a constant.
- **PCA9685:** same board and calibration. Drive it with `smbus2` or Adafruit Blinka, which supports Jetson; the JetRacer and Donkey Car projects use the same setup.
- **Heartbeat GPIO for the hardware watchdog:** the `Jetson.GPIO` library (RPi.GPIO-compatible API). Some header pins must first be set to GPIO with `sudo /opt/nvidia/jetson-io/jetson-io.py`.
- **IMU:** same breakout on the header's I2C (or SPI).
- **Wheel encoder:** same Pico, over USB serial.
- **Lidar:** same RPLidar C1 over its USB-UART adapter; check that the adapter's kernel driver (for example `cp210x`) is loaded.
- **Network:** Gigabit Ethernet for HIL, as with the Pi. The developer kit has a Wi-Fi module for track runs; keep its antennas clear of the motor and the ESC.

## 6. Software stack

- **Python:** JetPack 6's Python 3.10 meets the car program's 3.9 minimum. Use a virtualenv and `pip install -e "autonomy[test]"`; `pytest autonomy/tests` must pass on the board.
- **ONNX on the GPU:** the `onnx` extra installs the CPU build of `onnxruntime`. For the GPU, install NVIDIA's `onnxruntime-gpu` build for your JetPack version (from the Jetson AI Lab package index), or convert the model to a TensorRT engine.
- **Required code change:** with a GPU build of onnxruntime, `InferenceSession` must be given its `providers` explicitly (TensorRT, CUDA, CPU). `OnnxPolicy.load()` in [`policy.py`](../../src/rushwick_autonomy/policy.py) does not pass them yet; add that before the first Jetson run.
- **Monitoring for the HIL logs (batch 15):**
  - `tegrastats` reports temperatures, clock frequencies (throttling shows as dropped clocks) and power rails;
  - `nvpmodel -q` reports the power mode.
  - The HIL logging must support these next to the Pi's `vcgencmd`.
- **Containers (optional):** NVIDIA's L4T containers or `jetson-containers` give reproducible CUDA, TensorRT and PyTorch versions.

## 7. Simulation profile

The `rc-jetson` profile ([`rcJetson.ts`](../../../src/sim/platform/profiles/rcJetson.ts)) models this build. It takes the vehicle, the track, the actuation chain and the non-camera sensors from `rc-pi`, and changes only what the GPU changes. Its values are estimates until the board is measured:

| Profile value | `rc-pi` | `rc-jetson` (estimate) |
| :--- | :--- | :--- |
| `actuators.computeDelay` | 60 ms | 25 ms (TensorRT; 20–30 ms expected) |
| `actuators.delayJitter` | 15 ms | 8 ms |
| `sensors.objects.rateHz`, `latency` | 10 Hz, 100 ms | 20 Hz, 50 ms |
| `sensors.signals.rateHz`, `latency` | 10 Hz, 100 ms | 20 Hz, 50 ms |
| `sensors.objects.fovDeg`, `range`, `posStd` | 100°, 3 m, 3 cm + 3%/m | Same until the camera is chosen; a depth camera narrows the field of view and lowers the position noise |
| Vehicle, other actuator values, lidar, localization, ego state, track | — | Same as `rc-pi` |

- The rates take the low end of the expected 20–30 detections per second, as `rc-pi` takes the low end of the Pi's 10–15.
- Train on `rc-pi` when one model must run on both boards: its delays and detection rate are the harder case.

## 8. Bill of materials changes

Start from the Pi document's bill of materials, then:

| Pi row | Replace with | Specification | Qty | Stage |
| :--- | :--- | :--- | ---: | :--- |
| 6 Raspberry Pi 5 | Jetson Orin Nano 8 GB Developer Kit | JetPack 6.2 or newer (Super modes) | 1 | Bench |
| 7 Active Cooler | — | The developer kit's heatsink with fan is included | — | — |
| 8 USB-C power supply | The developer kit's 19 V adapter | Included with the kit | 1 | Bench |
| 9 Storage | NVMe SSD | M.2 Key M, ≥ 128 GB | 1 | Bench |
| 18 5.1 V 5 A regulator | DC-DC converter | Output at the carrier's input voltage (19 V for the developer kit), ≥ 40 W | 1 | Track |
| — (new) | Compute battery | 3S LiPo, 2200–3000 mAh, with its own low-voltage alarm | 1 | Track |
| 22 Camera Module 3 Wide | Camera, option A–D (section 4) | ≥ 100° horizontal field of view, or a depth camera with a profile change | 1 | Track |
| 27 AI accelerator | — | Not needed: the GPU replaces it | — | — |

All other rows stay: chassis, servo, ESC, motor, drive LiPo, PCA9685, hardware watchdog, RC transmitter and multiplexer, cables, bench stand, tools, encoder, IMU, lidar, overhead camera, AprilTags and track materials.

## 9. Checklist before batch 15

These replace the Pi checklist's first three items; the rest of the Pi checklist (servo, ESC, watchdog, kill switch, channel map, bench stand) applies unchanged.

- [ ] JetPack 6.2 or newer runs from the NVMe SSD; the virtualenv passes `pytest autonomy/tests`; the Ethernet link to the laptop is up.
- [ ] The `nvpmodel` mode is fixed and `jetson_clocks` is on; after 10 minutes of full CPU and GPU load `tegrastats` shows no throttling.
- [ ] The PCA9685 answers on the header's I2C bus (`i2cdetect -y -r <bus>`), and after clock calibration a commanded 1500 µs pulse measures within ±5 µs.
- [ ] The heartbeat pin is configured as GPIO (`jetson-io.py`), and stopping the heartbeat disables the PCA9685 outputs within 100 ms.
- [ ] `OnnxPolicy` runs a model on the GPU with explicit `providers` (section 6).

## 10. Open decisions

- Pi or Jetson for the first prototype. The current plan and the `rc-pi` profile assume the Pi.
- Camera option A, B, C or D.
- One shared battery or a separate compute battery.
