# Rushwick Autonomy: hardware-in-the-loop procedure

How to run the driving stack on the Raspberry Pi 5 or the Jetson Orin Nano against Rushwick, drive the servo and the ESC on the bench, and measure the values of the `rc-pi` and `rc-jetson` profiles. The parts are in [`hardware/pi.md`](hardware/pi.md) and [`hardware/jetson.md`](hardware/jetson.md); network and remote access are in [`connectivity.md`](connectivity.md).

> [!WARNING]
> `--actuate` and `rushwick_autonomy.calibrate` drive a real motor. Before the first powered run, do the bench checklist in section 5: wheels off the ground, RC kill switch and hardware watchdog tested, LiPo in a fire-safe bag, safety glasses on.

## 1. Overview

```
laptop: Rushwick                                     board: rushwick-autonomy
npm run sim:bridge --mode realtime  ── Ethernet ──▶  policy ▶ safety ▶ command back to Rushwick
  (owns the vehicle state)          WebSocket 8765          └▶ --actuate: PCA9685 ch0 / ch1 ▶ RC multiplexer ▶ servo, ESC
                                                     heartbeat GPIO, 20 Hz ▶ hardware watchdog ▶ PCA9685 OE
```

- Rushwick simulates the car. The board computes every command as it will on the track; with `--actuate` it also mirrors the command to the servo and the ESC.
- Steering follows the command. The throttle follows the simulated speed, because the bench has no wheel encoder yet. A full brake sets the throttle to neutral.
- In realtime mode Rushwick zeroes the profile's compute delay: the board's compute time is real there.
- Both sides log: the board with `--log`, Rushwick with `--log`. `python -m rushwick_autonomy.report` joins them.

## 2. Board setup

### 2.1 Raspberry Pi 5

1. Flash Raspberry Pi OS 64-bit (Bookworm). Set hostname `rushwick-pi`, user `rushwick`, and the SSH key from [`connectivity.md`](connectivity.md) section 3.
2. Enable I2C with `sudo raspi-config nonint do_i2c 0`. Add the user to the hardware groups with `sudo usermod -aG i2c,gpio rushwick`, then log in again.
3. Clone the repository to `~/rushwick` and check out the laptop's commit. Install into a virtualenv:
   ```sh
   python3 -m venv ~/venv && . ~/venv/bin/activate
   pip install -e "autonomy[pi,onnx,test]"
   pytest autonomy/tests
   ```
   If `lgpio` does not build, install its build tools (`sudo apt install swig liblgpio-dev`) and try again. Or create the virtualenv with `--system-site-packages` and install `python3-lgpio` with `apt`.
4. Before every measurement, set the CPU governor: `echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor`.
5. Check: `i2cdetect -y 1` shows `40`, and `vcgencmd get_throttled` reads `throttled=0x0`.
6. The board config is [`configs/pi.json`](../configs/pi.json): I2C bus 1, heartbeat on GPIO17 (header pin 11, BCM numbering), `vcgencmd` stats, the CPU provider.

### 2.2 Jetson Orin Nano

1. Install JetPack 6.2 or newer on the NVMe SSD. Set hostname `rushwick-jetson`, user `rushwick`, and the SSH key.
2. Before every measurement, fix the power mode: `sudo nvpmodel -m <mode>`, then `sudo jetson_clocks`. Record `nvpmodel -q` with the results.
3. I2C: `i2cdetect -l` lists the buses. Find the bus on header pins 3 and 5 with `i2cdetect -y -r <bus>` (the PCA9685 shows as `40`) and write it into [`configs/jetson.json`](../configs/jetson.json), which assumes 7.
4. Heartbeat pin: run `sudo /opt/nvidia/jetson-io/jetson-io.py`, set the chosen header pin to GPIO and reboot. Write its BOARD number into `configs/jetson.json`, which assumes 15. Add the user to the `gpio` and `i2c` groups.
5. Install into a virtualenv. Take `onnxruntime-gpu` from the Jetson AI Lab package index for your JetPack and CUDA version:
   ```sh
   python3 -m venv ~/venv && . ~/venv/bin/activate
   pip install -e "autonomy[jetson,test]"
   pip install onnxruntime-gpu --index-url <Jetson AI Lab index for your JetPack>
   pytest autonomy/tests
   python -c "import onnxruntime as ort; print(ort.get_available_providers())"
   ```
   The last line must list `TensorrtExecutionProvider` and `CUDAExecutionProvider`. The first ONNX session builds the TensorRT engine (minutes) and caches it next to the model.
6. Check: `tegrastats` shows no clock drops after 10 minutes of full CPU and GPU load.

### 2.3 Laptop

- Rushwick at the board's commit, after `npm ci`.
- A direct Ethernet cable to the board for every calibration run. Measure Wi-Fi separately.

## 3. Realtime HIL (no actuation)

Run each policy for 30 minutes: `simple`, then a trained model with `--policy onnx:models/policy.onnx`. Pi commands shown; for the Jetson use `rushwick-jetson`, `configs/jetson.json` and `--profile rc-jetson`.

```sh
# board, terminal 1: the car program, with system stats in the log
rushwick-autonomy --hardware sim --policy simple --config autonomy/configs/pi.json --log runs/pi-board.jsonl
# board, terminal 2: the perception load next to it (rc-pi objects rate 10 Hz; rc-jetson 20 Hz)
python -m rushwick_autonomy.bench --model models/detector.onnx --config autonomy/configs/pi.json --rate 10 --seconds 1800 --log runs/pi-bench.jsonl
# laptop: Rushwick in real time
npm run sim:bridge -- --url ws://rushwick-pi.local:8765 --mode realtime --profile rc-pi --minutes 30 --log runs/pi-bridge.jsonl
# laptop, afterwards
rsync -av rushwick-pi:rushwick/runs/ runs/pi/
python -m rushwick_autonomy.report runs/pi/pi-board.jsonl --bridge runs/pi-bridge.jsonl
```

The detector is any small ONNX detector for the target camera, for example a YOLO-nano class model at 320 × 320. Image content barely changes the time, so random input of the right size is enough.

Pass: under 1% deadline misses at 20 Hz, no watchdog brakes, no throttled samples, and `pytest autonomy/tests` green on the board.

## 4. What each measurement becomes

| Value | Source | Becomes |
| :--- | :--- | :--- |
| Round trip | Report: `round trip` p50, p95, p99 (Ethernet; Wi-Fi in a separate run) | Network share of the delay; reported, not in the profile |
| `computeDelay` | Benchmark p50 + report `policy time` p50 + `frame handling` p50, from the same run | Profile, rounded to milliseconds. The simulation steps at 33 ms, so report the distribution too |
| `delayJitter` | The benchmark's `std`, plus the policy's spread when it is not small | Profile |
| Thermals | Report: `max temperature`, `throttled samples`, CPU clock range | Pass or fail: a throttled run is invalid |

## 5. Bench checklist before any actuation

Do these steps in order. Stop at the first failure.

1. The car is on the bench stand with the wheels off the ground. The LiPo is in a fire-safe bag. Safety glasses are on.
2. The ESC is in forward/brake mode with drag brake 0%, its neutral is calibrated, and it falls back to neutral on signal loss.
3. RC kill switch: with the multiplexer on the RC receiver, the throttle stick turns the wheels, and the kill switch stops the throttle within 100 ms (240 fps video).
4. Hardware watchdog: start `python -m rushwick_autonomy.calibrate --config <board>.json --channel throttle --pulses <neutral_us> --i-have-a-kill-switch`, then stop it with `kill -9`. The PCA9685 outputs (OE pin and channel 1 on a logic analyzer) must switch off within 100 ms.

## 6. Bench calibration

`python -m rushwick_autonomy.calibrate` holds one channel at each listed pulse width in turn (`--period` seconds each) while the heartbeat runs. The other channel stays at neutral. `--led-pin` toggles an LED at every change; `--log` writes one line per change. List the rest position first: the first change also arms the watchdog, so time only the later changes.

| Step | Procedure | Writes |
| :--- | :--- | :--- |
| 1. PWM clock | `--channel steering --pulses 1500`. Measure the pulse width with a logic analyzer: `oscillator_hz = oscillator_hz × 1500 / measured_us`. Repeat until it is within ±5 µs, which is one PWM step (20 000 µs / 4096 ≈ 4.9 µs) | Config `pwm.oscillator_hz` |
| 2. Steering | Step between `center_us`, `left_us` and `right_us`. `left_us` must steer left (a positive command); swap the two if the servo is mounted the other way. Each side must reach 0.45 rad (25.8°) without binding. If the servo cannot, note the reachable angle: the profile's `maxSteer` must follow | Config `steering.*` |
| 3. Throttle neutral | At `neutral_us` the wheels stand still and the ESC shows neutral | Config `throttle.neutral_us` |
| 4. Throttle start | Step between `neutral_us` and `neutral_us + Δ`, with Δ up in 5 µs steps, until the wheels turn | Config `throttle.start_us` |
| 5. Throttle full | The pulse at which the free wheels reach `max_speed`. Speed = turns per second × wheel circumference, counted on video | Config `throttle.full_us` |
| 6. Steering deadband | Step between `center_us` and `center_us + Δ`, with Δ up one PWM step (5 µs) at a time, until the horn follows. `steerDeadband = Δ / (left_us − center_us)` | Profile |
| 7. Actuation delay | `--led-pin <free GPIO>`, 240 fps video of the LED and the servo horn (steering), then of a wheel marker (throttle). Frames from the LED change to the first movement × 4.17 ms, 20 changes each | Profile `actuationDelay` (the mean) |
| 8. Steering-center error | On the floor, kill switch in hand: `--channel throttle --pulses <pulse for about 0.5 m/s> --seconds 8` drives straight with the steering at `center_us`. Measure the distance `d` and the lateral offset `y`; the bias angle ≈ `2·y·L / d²` (wheelbase `L` = 0.26 m). 10 runs, re-trimmed between sessions as in practice | Profile `steerBiasStd` (the standard deviation) |

Not measurable on the bench yet: `accelDeadband` and `accelTimeConstant` need the wheel encoder (track stage). Keep the assumed values and mark them as assumed.

Then run the whole loop with actuation for 5 minutes: section 3's commands with `--actuate --i-have-a-kill-switch` on the board and `--minutes 5` on the laptop. The servo must follow the simulated car, and the throttle must return to neutral when Rushwick stops and at exit.

## 7. Writing the results back

1. Board config values: `autonomy/configs/<board>.json`, with the date in its `notes`.
2. Profile values: [`rcPi.ts`](../../src/sim/platform/profiles/rcPi.ts) and [`rcJetson.ts`](../../src/sim/platform/profiles/rcJetson.ts), with the date and the method next to every measured value. `rc-jetson` takes everything but its compute and camera values from `rc-pi`.
3. Changed profile values change recorded datasets: mark the commit as breaking (`feat(sim)!:`), and update the README tables and baseline.
4. Results that are not profile values (round trip, thermals, power, misses) go into the PR comment and into [`hardware/comparison.md`](hardware/comparison.md).

## 8. Laptop dry run

The same pipeline with [`configs/laptop.json`](../configs/laptop.json) (fake I2C and GPIO, no stats) checks the tooling before any board exists. Run it from the repository root, and stop the car program with Ctrl+C after the bridge run:

```sh
rushwick-autonomy --hardware sim --listen 127.0.0.1:8765 --config autonomy/configs/laptop.json --actuate --i-have-a-kill-switch --log runs/dry/board.jsonl
npm run sim:bridge -- --url ws://127.0.0.1:8765 --mode realtime --profile rc-pi --minutes 1 --log runs/dry/bridge.jsonl
python -m rushwick_autonomy.report runs/dry/board.jsonl --bridge runs/dry/bridge.jsonl
python -m rushwick_autonomy.calibrate --config autonomy/configs/laptop.json --channel steering --pulses 1500 2000 1000 --seconds 3 --log runs/dry/pulses.jsonl --i-have-a-kill-switch
```
