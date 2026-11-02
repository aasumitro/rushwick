import asyncio

from rushwick_autonomy import Command, Safety, SafetyConfig
from rushwick_autonomy.driver import Driver
from rushwick_autonomy.loop import run
from rushwick_autonomy.safety import FULL_BRAKE

HELLO = {"type": "hello", "protocol": 1, "featureVersion": 1, "profile": "rc-pi", "scale": 10, "mode": "lockstep", "controlHz": 20}
OBS = {"ego": {"speed": 0.5, "length": 0.45}, "route": {"speedLimit": 1.4}, "lidar": [12.0] * 32}


def frame(seq, tick):
    return {"type": "frame", "seq": seq, "stamp": seq / 30, "controlTick": tick, "observation": OBS, "odom": {"twist": {"linear": {"x": 0.5}}}}


class FakeHardware:
    def __init__(self, inbox):
        self.inbox = list(inbox)
        self.sent = []

    async def start(self):
        pass

    async def read_frame(self, timeout):
        return self.inbox.pop(0) if self.inbox else None

    async def write_command(self, seq, cmd):
        self.sent.append((seq, cmd))


class CountingPolicy:
    def __init__(self):
        self.calls = 0
        self.resets = 0

    def reset(self):
        self.resets += 1

    def act(self, frame):
        self.calls += 1
        return Command(0.1 * self.calls, 2.0)


def drive(inbox, timeouts=0):
    """Run the loop over `inbox`, then `timeouts` reads that find no frame."""
    hw = FakeHardware(inbox)
    policy = CountingPolicy()
    asyncio.run(run(hw, lambda hello: policy, Driver(Safety(SafetyConfig())), log=lambda s: None, max_messages=len(inbox) + timeouts))
    return hw.sent, policy


def test_runs_the_policy_on_control_ticks_and_resends_in_between():
    sent, policy = drive([HELLO, {"type": "episode", "event": "start", "index": 0}, frame(0, True), frame(1, False), frame(2, True)])
    assert policy.resets == 1 and policy.calls == 2
    # Steering 2.0 is clamped by the safety layer; frame 1 resends frame 0's command.
    assert sent == [(0, Command(0.1, 1.0)), (1, Command(0.1, 1.0)), (2, Command(0.2, 1.0))]


def test_ignores_frames_before_hello():
    sent, policy = drive([frame(0, True), HELLO, frame(1, True)])
    assert [s for s, _ in sent] == [1]


def test_brakes_when_frames_stop_in_realtime():
    sent, _ = drive([dict(HELLO, mode="realtime"), frame(0, True)], timeouts=1)
    # The fake hardware has nothing more to read: the watchdog brakes with the last seq.
    assert sent[-1] == (0, Command(FULL_BRAKE, 0.0))


class RecordingSink:
    def __init__(self):
        self.got = []

    def command(self, cmd, frame):
        self.got.append((cmd, frame is None))

    def close(self):
        pass


def test_every_command_and_the_watchdog_brake_reach_the_sink():
    sink = RecordingSink()
    hw = FakeHardware([dict(HELLO, mode="realtime"), frame(0, True)])
    asyncio.run(run(hw, lambda hello: CountingPolicy(), Driver(Safety(SafetyConfig()), sink=sink), log=lambda s: None, max_messages=3))
    assert sink.got == [(Command(0.1, 1.0), False), (Command(FULL_BRAKE, 0.0), True)]
