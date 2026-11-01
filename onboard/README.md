# rushwick_onboard

Reference car program for [Rushwick](../README.md). The same program drives the simulator over the bridge (software-in-the-loop) and, once the hardware backend exists, the real car: only `--hardware` changes.

```sh
python3 -m venv .venv && . .venv/bin/activate
pip install -e "onboard[test]"          # add ,onnx for OnnxPolicy
python -m rushwick_onboard --hardware sim --listen 0.0.0.0:8765 --policy simple
```

Then let Rushwick connect, for example `npm run sim:bridge -- --mode lockstep --profile rc-pi --episodes 3`.

| Module | Role |
| :--- | :--- |
| `hardware.py` | `Hardware` protocol; `SimHardware` is the WebSocket server Rushwick connects to; `RealHardware` is a stub until Phase C |
| `loop.py` | Runs the policy on control-tick frames and resends the last command otherwise; the frame `stamp` is the clock in lockstep, a 200 ms wall-clock watchdog brakes in realtime |
| `policy.py` | `EchoPolicy` (returns the frame's teacher action, for the SIL echo check) and `OnnxPolicy` (a trained model) |
| `lane_keeper.py` | `SimpleLaneKeeper`, a pure-pursuit smoke-test policy |
| `safety.py` | Always between the policy and the hardware: steering clamp, speed cap, lidar stop, watchdog brake |
| `encoder.py`, `units.py` | Ports of `encodeObservation()` and the bridge's real ↔ sim units |

Policies get frames in real units and return commands in real units. `OnnxPolicy` converts the observation to sim units and encodes it exactly like Rushwick, because models learn from recorded datasets in sim units; `tests/test_encoder_golden.py` checks the encoder against `tests/golden/`, which `npm run sim:golden` exports.

The lidar stop defaults to off with `--hardware sim`: the simulated 2D lidar sees curbs as walls (block outlines), and a car turning a corner crosses them. On the real car it defaults to on. Override with `--lidar-stop` / `--no-lidar-stop`.

Run the tests with `pytest onboard/tests`. Python 3.9 or newer.
