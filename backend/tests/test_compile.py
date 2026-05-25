import asyncio
from pathlib import Path

from app.services.compiler import _wrap_in_sketch_if_needed, compile_cpp


def test_wrap_in_sketch_passthrough_when_well_formed():
    src = "void setup() {}\nvoid loop() {}\n"
    assert _wrap_in_sketch_if_needed(src) == src


def test_wrap_in_sketch_adds_scaffold_for_snippet():
    src = "digitalWrite(13, HIGH);"
    wrapped = _wrap_in_sketch_if_needed(src)
    assert "void setup" in wrapped
    assert "void loop" in wrapped
    assert "digitalWrite(13, HIGH);" in wrapped


class _FakeProc:
    def __init__(self, returncode: int, stderr: bytes = b"") -> None:
        self.returncode = returncode
        self._stderr = stderr

    async def communicate(self) -> tuple[bytes, bytes]:
        return b"", self._stderr


async def test_compile_cpp_success(monkeypatch, tmp_path):
    """Stub arduino-cli: pretend it succeeded and dropped a HEX in the output dir."""

    captured_out: dict[str, Path] = {}

    async def fake_subprocess(*args, **kwargs):
        # The output dir is the value passed after the `--output-dir` flag.
        flag_index = args.index("--output-dir")
        out_dir = Path(args[flag_index + 1])
        (out_dir / "sketch.ino.hex").write_text(":00000001FF\n", encoding="utf-8")
        captured_out["out_dir"] = out_dir
        return _FakeProc(returncode=0)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_subprocess)

    result = await compile_cpp("void setup() {}\nvoid loop() {}\n")
    assert result.ok is True
    assert result.hex_text is not None
    assert result.hex_text.strip().startswith(":")


async def test_compile_cpp_failure_surfaces_stderr(monkeypatch):
    async def fake_subprocess(*args, **kwargs):
        return _FakeProc(returncode=1, stderr=b"syntax error on line 4")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_subprocess)

    result = await compile_cpp("void setup")
    assert result.ok is False
    assert result.error
    assert "syntax error" in (result.stderr or "")


async def test_compile_cpp_missing_arduino_cli(monkeypatch):
    async def fake_subprocess(*args, **kwargs):
        raise FileNotFoundError("arduino-cli")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_subprocess)

    result = await compile_cpp("void setup() {} void loop() {}")
    assert result.ok is False
    assert result.error is not None
    assert "arduino-cli" in result.error
