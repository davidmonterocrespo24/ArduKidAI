"""Download and index free, openly-licensed Arduino PDF resources into the RAG store.

Each item is fetched once into data/, then indexed: chunked (500-word) for
retrieval AND its original PDF stored so the Knowledge modal can preview it.
Re-running is idempotent (delete + re-index per source). Everything here is
clearly free / Creative-Commons; search_docs cites source + page, which
satisfies the CC BY-SA attribution.

Sources:
  - 3 CC-licensed books (Internet Archive / programmingelectronics).
  - The Adafruit Learning System "Arduino Lesson" series + a few guides
    (CC BY-SA 3.0), each downloadable as a PDF.

Usage:
    cd backend
    uv run python -m scripts.index_books              # download + index everything
    uv run python -m scripts.index_books --adafruit   # only the Adafruit guides
    uv run python -m scripts.index_books --books      # only the 3 books
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import httpx

from app.db.seed import _create_index
from app.services import knowledge

_DATA = Path(__file__).resolve().parents[2] / "data"

# Three CC-licensed books: (download url, local filename, citation label).
_BOOKS: list[tuple[str, str, str]] = [
    (
        "https://archive.org/download/arduino_notebook/arduino_notebook.pdf",
        "arduino-programming-notebook.pdf",
        "Arduino Programming Notebook (Brian W. Evans, CC BY-SA)",
    ),
    (
        "https://www.programmingelectronics.com/wp-content/uploads/2017/06/"
        "Arduino-Course-for-Absolute-Beginners-V4.pdf",
        "arduino-course-absolute-beginners.pdf",
        "Arduino Course for Absolute Beginners (programmingelectronics.com, CC)",
    ),
    (
        "https://archive.org/download/UltimateArduinoHandbook_201709/Ultimate_Arduino_Handbook.pdf",
        "ultimate-arduino-handbook.pdf",
        "Ultimate Arduino Handbook (Mark Maffei, CC BY-SA)",
    ),
]

_ADAFRUIT_BASE = "https://cdn-learn.adafruit.com/downloads/pdf/"
# Adafruit Learning System guides (CC BY-SA 3.0): (slug, short title).
_ADAFRUIT: list[tuple[str, str]] = [
    ("adafruit-arduino-lesson-0-getting-started", "Arduino Lesson 0: Getting Started"),
    ("adafruit-arduino-lesson-1-blink", "Arduino Lesson 1: Blink"),
    ("adafruit-arduino-lesson-2-leds", "Arduino Lesson 2: LEDs"),
    ("adafruit-arduino-lesson-3-rgb-leds", "Arduino Lesson 3: RGB LEDs"),
    ("adafruit-arduino-lesson-4-eight-leds", "Arduino Lesson 4: Eight LEDs"),
    ("adafruit-arduino-lesson-5-the-serial-monitor", "Arduino Lesson 5: The Serial Monitor"),
    ("adafruit-arduino-lesson-6-digital-inputs", "Arduino Lesson 6: Digital Inputs"),
    ("adafruit-arduino-lesson-7-make-an-rgb-led-fader", "Arduino Lesson 7: RGB LED Fader"),
    ("adafruit-arduino-lesson-8-analog-inputs", "Arduino Lesson 8: Analog Inputs"),
    ("adafruit-arduino-lesson-9-sensing-light", "Arduino Lesson 9: Sensing Light"),
    ("adafruit-arduino-lesson-10-making-sounds", "Arduino Lesson 10: Making Sounds"),
    ("adafruit-arduino-lesson-11-lcd-displays-1", "Arduino Lesson 11: LCD Displays 1"),
    ("adafruit-arduino-lesson-12-lcd-displays-2", "Arduino Lesson 12: LCD Displays 2"),
    ("adafruit-arduino-lesson-13-dc-motors", "Arduino Lesson 13: DC Motors"),
    ("adafruit-arduino-lesson-14-servo-motors", "Arduino Lesson 14: Servo Motors"),
    ("adafruit-arduino-lesson-15-dc-motor-reversing", "Arduino Lesson 15: DC Motor Reversing"),
    ("adafruit-arduino-lesson-16-stepper-motors", "Arduino Lesson 16: Stepper Motors"),
    ("adafruit-arduino-lesson-17-email-sending-movement-detector", "Arduino Lesson 17: Movement Detector"),
    ("all-about-leds", "All About LEDs"),
    ("multi-tasking-the-arduino-part-1", "Multi-tasking the Arduino, Part 1"),
    ("multi-tasking-the-arduino-part-2", "Multi-tasking the Arduino, Part 2"),
]


def _adafruit_items() -> list[tuple[str, str, str]]:
    return [
        (f"{_ADAFRUIT_BASE}{slug}.pdf", f"adafruit-{slug}.pdf", f"Adafruit (CC BY-SA): {title}")
        for slug, title in _ADAFRUIT
    ]


async def _ensure(url: str, filename: str) -> Path | None:
    path = _DATA / filename
    if path.is_file() and path.stat().st_size > 10_000:
        return path
    _DATA.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(follow_redirects=True, timeout=180) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        path.write_bytes(resp.content)
    return path


async def main(items: list[tuple[str, str, str]]) -> int:
    ok = 0
    for url, filename, source in items:
        try:
            path = await _ensure(url, filename)
        except Exception as exc:
            print(f"download failed ({source}): {exc}", flush=True)
            continue
        if path is None or not path.read_bytes()[:5].startswith(b"%PDF"):
            print(f"skip (not a PDF): {source}", flush=True)
            continue
        await knowledge.delete_source(source)
        count = await knowledge.index_pdf_path(str(path), source)
        ok += 1
        print(f"indexed {count} chunks + stored original: {source}", flush=True)
    await _create_index(
        collection="knowledge_chunks", name=knowledge.KNOWLEDGE_VECTOR_INDEX, path="embedding"
    )
    print(f"done - {ok} PDFs indexed", flush=True)
    return 0


if __name__ == "__main__":
    if "--adafruit" in sys.argv:
        chosen = _adafruit_items()
    elif "--books" in sys.argv:
        chosen = _BOOKS
    else:
        chosen = _BOOKS + _adafruit_items()
    raise SystemExit(asyncio.run(main(chosen)))
