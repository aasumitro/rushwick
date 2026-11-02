# Raspberry Pi 5 vs Jetson Orin Nano

The two compute builds of the 1:10 prototype side by side: what the simulator assumes for each, and, once the boards exist, what was measured. The parts are in [`pi.md`](pi.md) and [`jetson.md`](jetson.md) (section 1 compares the specifications); the measurements follow [`hil.md`](../hil.md).

> [!NOTE]
> Status 2026-11-02: no board is measured yet. Every value below is an assumption (`rc-pi`) or an estimate (`rc-jetson`). Fill in the measured columns from the HIL runs, then update the profiles (`hil.md` section 7).

## 1. Latency and load

| Quantity | Pi 5, `rc-pi` | Pi 5, measured | Jetson, `rc-jetson` | Jetson, measured | How to measure |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Compute delay (`computeDelay`) | 60 ms | — | 25 ms | — | `hil.md` section 4 |
| Its jitter (`delayJitter`) | 15 ms | — | 8 ms | — | `hil.md` section 4 |
| Actuation delay (`actuationDelay`) | 20 ms | — | 20 ms (same chain) | — | `hil.md` section 6, step 7 |
| Detections (objects and lights) | 10 per second, 100 ms late | — | 20 per second, 50 ms late | — | Perception benchmark |
| Round trip over Ethernet, p50 / p95 / p99 | — | — | — | — | Report, 30-minute realtime run |
| Deadline misses at 20 Hz | Must stay under 1% | — | Must stay under 1% | — | Report |
| Throttling over 30 minutes | None allowed | — | None allowed | — | Report (`vcgencmd`, `tegrastats`) |

The laptop dry run checks only the tooling: on the laptop's loopback, the round trip was 1.0 ms at p50 with 0 of 1610 deadline misses. It says nothing about the boards.

## 2. Power, mass and cost

| | Pi 5 build | Jetson build |
| :--- | :--- | :--- |
| Compute power | About 5–12 W at 5 V | About 7–25 W, depending on the power mode |
| Supply on the car | 5.1 V 5 A regulator from the drive LiPo | DC-DC converter (≥ 40 W) to 19 V, preferably from a separate 3S compute battery |
| Compute mass | Lower: board and cooler | Higher: developer kit, converter and compute battery |
| Cost class | Low | Medium: developer kit, plus converter and compute battery |
| Measured power and mass | — | — |

Measure the power with a USB-C power meter (Pi) or the `VDD_IN` rail in the HIL log (Jetson), and weigh the finished compute stack.

## 3. The expert on both profiles

From the README baseline (seeds 1–3, 3 episodes each, both driving sides, placeholder track):

| Profile | Observations | Success | Off-road | Mean score |
| :--- | :--- | ---: | ---: | ---: |
| `rc-pi` | exact (privileged teacher) | 18 / 18 | 0 | 0.845 |
| `rc-pi` | sensed | 10 / 18 | 8 | 0.629 |
| `rc-jetson` | exact (privileged teacher) | 18 / 18 | 0 | 0.845 |
| `rc-jetson` | sensed | 10 / 18 | 8 | 0.598 |

On the empty placeholder track the two builds drive alike. The camera channels have nothing to detect, and the shorter compute delay does not remove the curb strikes on sensed observations. The Jetson's faster perception can only matter once the track has traffic and lights.

## 4. Recommendation

Both builds go ahead in parallel. Until the measurements say otherwise:

- **First track runs on the Pi 5.** It is cheaper and lighter, needs one 5 V regulator, and its profile is the conservative one. The placeholder track gives the Jetson's faster perception nothing to do.
- **Train and gate models on `rc-pi`.** Its delays and detection rate are the harder case, so a model that drives `rc-pi` cleanly suits the Jetson too.
- **Move to the Jetson** when the track gets traffic and lights, when a detector needs more than the Pi's CPU, or for depth cameras.
- **Revisit after the HIL runs.** If the Pi misses more than 1% of the deadlines or throttles under the perception load, the Jetson takes the first track runs.
