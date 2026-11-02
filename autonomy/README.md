# Rushwick Autonomy

`rushwick-autonomy` is the reference driving stack for [Rushwick](../README.md): the program that runs on the vehicle. It drives the simulator over the bridge now (software-in-the-loop) and the real car later; only `--hardware` changes.

```sh
python3 -m venv .venv && . .venv/bin/activate
pip install -e "autonomy[test]"          # add ,onnx for OnnxPolicy; on a board add ,pi or ,jetson
rushwick-autonomy --hardware sim --listen 0.0.0.0:8765 --policy simple   # or: python -m rushwick_autonomy
```

Then let Rushwick connect, for example `npm run sim:bridge -- --mode lockstep --profile rc-pi --episodes 3`.

On a board, `--actuate --config autonomy/configs/<board>.json` also drives the real servo and ESC (bench only, wheels off the ground). It refuses to start without `--i-have-a-kill-switch`, which confirms the bench checklist in `docs/hil.md`.

## Layout

```
autonomy/
  pyproject.toml          package rushwick-autonomy, console script rushwick-autonomy
  src/rushwick_autonomy/  the package (src layout)
  configs/                one config per board: pi.json, jetson.json, laptop.json (fake hardware for dry runs)
  tests/                  pytest suite and the encoder golden vectors (tests/golden/)
  docs/hardware/          prototype hardware: Raspberry Pi 5 (pi.md) or Jetson Orin Nano (jetson.md)
  docs/connectivity.md    network, remote access (SSH, rsync), phone teleop and telemetry design
```

| Module | Role |
| :--- | :--- |
| `cli.py`, `app.py` | Command line (hardware backend, listen address, policy, speed cap, lidar stop, board config, `--actuate`) and the wiring that runs it |
| `events.py`, `stats.py`, `report.py` | HIL event log (`--log`: frame and policy timings, watchdog, the Git commit), 1 Hz system stats from `vcgencmd` or `tegrastats`, and `python -m rushwick_autonomy.report board.jsonl --bridge hil.jsonl` |
| `outputs.py`, `heartbeat.py` | With `--actuate`: every safe command mirrored to the servo and ESC, and a 20 Hz GPIO heartbeat for the hardware watchdog |
| `hardware.py` | `Hardware` protocol; `SimHardware` is the WebSocket server Rushwick connects to; `RealHardware` is a stub until Phase C |
| `loop.py` | Runs the policy on control-tick frames and resends the last command otherwise; the frame `stamp` is the clock in lockstep, a 200 ms wall-clock watchdog brakes in realtime |
| `policy.py` | `EchoPolicy` (returns the frame's teacher action, for the SIL echo check) and `OnnxPolicy` (a trained model) |
| `onnx_session.py`, `bench.py` | ONNX sessions on the board config's execution providers (TensorRT → CUDA → CPU on the Jetson, with a TensorRT engine cache next to the model), and `python -m rushwick_autonomy.bench --model detector.onnx --config <board>.json` to time a perception model at the camera rate |
| `lane_keeper.py` | `SimpleLaneKeeper`, a pure-pursuit smoke-test policy |
| `safety.py` | Always between the policy and the hardware: steering clamp, speed cap, lidar stop, watchdog brake |
| `encoder.py`, `units.py` | Ports of `encodeObservation()` and the bridge's real ↔ sim units |
| `config.py`, `config_file.py` | Board config types, and loading with checks (`configs/<board>.json`) |
| `pca9685.py` | Minimal PCA9685 driver (and a fake I2C bus); the configured oscillator frequency is the pulse-width calibration knob |
| `actuation.py` | Safe command → steering and throttle pulses; on the bench the throttle mirrors the simulated speed |

Policies get frames in real units and return commands in real units. `OnnxPolicy` converts the observation to sim units and encodes it exactly like Rushwick, because models learn from recorded datasets in sim units; `tests/test_encoder_golden.py` checks the encoder against `tests/golden/`, which `npm run sim:golden` exports.

The lidar stop defaults to off with `--hardware sim`: the simulated 2D lidar sees curbs as walls (block outlines), and a car turning a corner crosses them. On the real car it defaults to on. Override with `--lidar-stop` / `--no-lidar-stop`.

Run the tests with `pytest autonomy/tests`. Python 3.9 or newer.
