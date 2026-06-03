"""Wraps `arduino-cli` to compile a sketch and return its Intel HEX text.

The HEX is returned as a string so the frontend can feed it directly into
avr8js's `loadHex`. We deliberately keep the temp directory layout simple so
this code is easy to mock in tests."""

from __future__ import annotations

import asyncio
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from ..config import get_settings


@dataclass
class CompileResult:
    ok: bool
    hex_text: str | None = None
    stdout: str | None = None
    stderr: str | None = None
    error: str | None = None


def _wrap_in_sketch_if_needed(cpp: str) -> str:
    """Make sure the source has a `void setup()` and `void loop()`. If the
    user passes a raw snippet, drop it inside `loop()` as a best-effort."""

    has_setup = "void setup" in cpp
    has_loop = "void loop" in cpp
    if has_setup and has_loop:
        return cpp
    return (
        "void setup() {\n"
        "  pinMode(13, OUTPUT);\n"
        "}\n\n"
        "void loop() {\n"
        f"{cpp}\n"
        "}\n"
    )


async def compile_cpp(cpp: str, fqbn: str | None = None) -> CompileResult:
    settings = get_settings()
    target_fqbn = fqbn or settings.ardukid_fqbn
    source = _wrap_in_sketch_if_needed(cpp)

    workdir = Path(tempfile.mkdtemp(prefix="ardukid_"))
    sketch_dir = workdir / "sketch"
    sketch_dir.mkdir()
    sketch_file = sketch_dir / "sketch.ino"
    sketch_file.write_text(source, encoding="utf-8")
    out_dir = workdir / "out"
    out_dir.mkdir()

    try:
        proc = await asyncio.create_subprocess_exec(
            settings.ardukid_arduino_cli,
            "compile",
            "--fqbn",
            target_fqbn,
            "--output-dir",
            str(out_dir),
            str(sketch_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await proc.communicate()
        stdout = stdout_bytes.decode("utf-8", errors="replace")
        stderr = stderr_bytes.decode("utf-8", errors="replace")
        if proc.returncode != 0:
            return CompileResult(
                ok=False, stdout=stdout, stderr=stderr, error="arduino-cli returned non-zero"
            )

        hex_path = next(out_dir.glob("*.hex"), None)
        if hex_path is None:
            return CompileResult(
                ok=False, stdout=stdout, stderr=stderr, error="no .hex produced"
            )

        return CompileResult(
            ok=True,
            hex_text=hex_path.read_text(encoding="utf-8"),
            stdout=stdout,
            stderr=stderr,
        )
    except FileNotFoundError:
        return CompileResult(
            ok=False,
            error=(
                f"`{settings.ardukid_arduino_cli}` not found. Install it locally "
                "or run the backend inside the Docker image which ships with it."
            ),
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
