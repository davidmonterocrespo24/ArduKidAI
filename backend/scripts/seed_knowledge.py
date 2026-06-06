"""Seed a curated educational corpus into `knowledge_chunks` for the RAG store.

Two kinds of content, both safe to index and to cite:

1. AUTHORED_DOCS - short, original concept primers written for ArduKid. They
   ground the agent's "teach the concept" answers (electricity, PWM, why an LED
   needs a resistor, real-world traffic-light timing, troubleshooting). They are
   our own text, so there is no licensing question, and they complement the
   per-component skills (which cover exact pins) rather than duplicating them.
2. CURATED_URLS - trusted, openly licensed pages (SparkFun Learn is CC BY-SA
   4.0; Wikipedia is CC BY-SA; the Arduino language reference for syntax). The
   agent already cites source + page via search_docs, which satisfies the
   attribution that CC BY-SA asks for.

Usage:
    cd backend
    uv run python -m scripts.seed_knowledge              # authored docs + URLs + index
    uv run python -m scripts.seed_knowledge --text-only  # just the authored primers (offline-safe)
    uv run python -m scripts.seed_knowledge --urls-only
    uv run python -m scripts.seed_knowledge --ensure-index
    uv run python -m scripts.seed_knowledge --limit 3    # cap items per kind (smoke test)
    uv run python -m scripts.seed_knowledge --dry-run    # list what would be indexed

Requires MONGODB_URI (and GOOGLE_CLOUD_PROJECT for real Gemini embeddings) in
the env or backend/.env. Re-running is idempotent (upsert by source::chunk)."""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.db.seed import _create_index
from app.services.knowledge import KNOWLEDGE_VECTOR_INDEX, index_plain_text, index_url

# --- Authored concept primers (our own text; license-clean) -------------------
# Kept concise and factual. Source labels read well as citations in chat.
AUTHORED_DOCS: list[tuple[str, str]] = [
    (
        "ArduKid Basics: Electricity and Ohm's Law",
        "Electricity flowing in a circuit has three linked quantities. Voltage (V), "
        "measured in volts, is the push that moves charge - an Arduino UNO pin gives "
        "0 V for LOW and 5 V for HIGH. Current (I), measured in amps, is how much "
        "charge flows. Resistance (R), measured in ohms, slows the flow. Ohm's Law "
        "ties them together: V = I x R, so I = V / R. More resistance means less "
        "current for the same voltage. This is why we add resistors: to keep the "
        "current at a safe level so parts do not overheat or burn out.",
    ),
    (
        "ArduKid Basics: How an LED works and why it needs a resistor",
        "An LED (light-emitting diode) makes light when current flows through it in "
        "one direction only. It has two legs: the longer leg is the anode (+) and "
        "the shorter leg is the cathode (-). Current must enter the anode and leave "
        "the cathode, so polarity matters - backwards, it stays dark. An LED has "
        "very little resistance of its own, so connecting it straight to 5 V would "
        "let too much current through and destroy it. A series resistor of about "
        "220 to 330 ohms limits the current to a safe ~10-15 mA. Rule: every LED "
        "gets its own resistor between the digital pin and the LED, and the cathode "
        "goes to GND.",
    ),
    (
        "ArduKid Basics: Choosing the LED resistor value",
        "To size an LED resistor, use Ohm's Law on the voltage left over after the "
        "LED. On 5 V, a red LED drops about 2 V, leaving about 3 V across the "
        "resistor. For a safe 10-15 mA: R = 3 V / 0.012 A is about 250 ohms, so a "
        "common 220 or 330 ohm resistor works well. Higher resistance makes the LED "
        "dimmer but safer; too low a value (or no resistor) lets too much current "
        "flow and can burn out the LED or the Arduino pin. Blue and white LEDs drop "
        "more voltage (~3 V), so a slightly smaller resistor still works.",
    ),
    (
        "ArduKid Basics: Using a breadboard",
        "A breadboard lets you build circuits without soldering. The two long rails "
        "on the edges are the power buses: one for + (5 V) and one for - (GND); "
        "everything in a rail is connected along its whole length. The inner area "
        "has many short rows of five holes. Holes in the same row are connected to "
        "each other, but the left half and right half are split by the center gap, "
        "which is made for chips. To connect two parts, put their legs in the same "
        "row, or run a jumper wire between rows.",
    ),
    (
        "ArduKid Basics: Digital versus analog signals",
        "Digital means only two states: HIGH (5 V, on) or LOW (0 V, off). Use "
        "pinMode(pin, OUTPUT) then digitalWrite(pin, HIGH/LOW) to drive an LED or "
        "buzzer, and digitalRead(pin) to read a button. Analog means a smooth range "
        "of values. analogRead(A0) reads a voltage on an analog pin (A0-A5) and "
        "returns a number from 0 (0 V) to 1023 (5 V) - good for knobs, light, and "
        "temperature sensors. analogWrite(pin, value) fakes an analog output using "
        "PWM with a value from 0 to 255, used to dim an LED or set motor speed.",
    ),
    (
        "ArduKid Basics: PWM (Pulse Width Modulation)",
        "PWM lets a digital pin act like a dimmer. Instead of a steady voltage, the "
        "pin switches on and off very fast; the fraction of time it is on is the "
        "duty cycle. A 25% duty cycle gives about a quarter of full brightness or "
        "speed. In Arduino, analogWrite(pin, value) sets the duty cycle with value "
        "0 (always off) to 255 (always on). Only pins marked with a tilde (~3, ~5, "
        "~6, ~9, ~10, ~11 on the UNO) support PWM. PWM is used to dim LEDs, control "
        "motor speed, and make tones.",
    ),
    (
        "ArduKid Basics: The Arduino UNO pins",
        "The Arduino UNO has 14 digital pins labelled D0-D13, used for on/off "
        "signals. Pins with a tilde (~3, ~5, ~6, ~9, ~10, ~11) also do PWM. D13 has "
        "a small LED built onto the board, handy for testing. There are 6 analog "
        "input pins A0-A5 that read voltages with analogRead. Power pins include 5V "
        "and 3.3V outputs, GND (ground, the 0 V reference - there are several GND "
        "pins and they are all connected), and Vin. Every circuit needs a common "
        "ground: parts that talk to the Arduino must share its GND.",
    ),
    (
        "ArduKid Basics: Buttons and pull-up resistors",
        "A pushbutton simply connects two points while pressed. If you wire a button "
        "to an input pin with nothing else, the pin 'floats' when released and reads "
        "random values. The fix is a pull-up resistor that gently holds the pin "
        "HIGH. The Arduino has these built in: use pinMode(pin, INPUT_PULLUP), then "
        "wire the button between that pin and GND. Now the pin reads HIGH when the "
        "button is up and LOW when pressed. Remember: with INPUT_PULLUP, pressed "
        "means digitalRead returns LOW.",
    ),
    (
        "ArduKid Basics: How sensors connect",
        "Sensors come in two flavours. Analog sensors (a potentiometer knob, a light "
        "sensor / photoresistor, many temperature sensors) output a changing "
        "voltage; wire their signal to an analog pin A0-A5 and read it with "
        "analogRead, which gives 0-1023. Digital sensors (a PIR motion sensor, a "
        "tilt switch, many sound or flame modules) output just HIGH or LOW when "
        "something happens; wire their output to a digital pin and use digitalRead, "
        "often comparing against a threshold. All sensors also need power (5V) and "
        "ground (GND).",
    ),
    (
        "ArduKid Basics: Controlling a servo motor",
        "A hobby servo (like the SG90) moves its arm to an angle between 0 and 180 "
        "degrees and holds it there. It has three wires: signal (often orange or "
        "yellow) to a digital pin, power (red) to 5V, and ground (brown or black) to "
        "GND. In code, attach the servo to its pin and write an angle. The servo "
        "uses a special PWM-like pulse, which the Arduino Servo library handles for "
        "you. Servos can draw a lot of current when they move, so a big one may need "
        "its own power supply rather than the Arduino's 5V pin.",
    ),
    (
        "ArduKid Basics: The 7-segment display",
        "A 7-segment display shows a digit using seven bar-shaped LEDs named A "
        "(top), B, C, D (bottom), E, F, G (middle), plus a dot DP. Light the right "
        "combination to form a number: for example 1 lights B and C; 7 lights A, B, "
        "and C; 8 lights all seven. In a common-cathode display, all the segment "
        "cathodes join one COM pin that goes to GND, and each segment lights when "
        "its pin is driven HIGH (through its own current-limiting resistor, just "
        "like any LED). Showing several digits at once uses multiplexing: light one "
        "digit at a time, very fast, so the eye sees them all.",
    ),
    (
        "ArduKid Basics: Real traffic-light timing",
        "Real traffic signals are timed by engineers from the speed limit, traffic, "
        "and how wide the crossing is, so there is no single 'correct' time. As a "
        "rough guide for a city intersection: green is often 30 to 60 seconds, "
        "yellow (amber) is about 3 to 5 seconds - roughly one second for every 10 "
        "mph of the speed limit - and there is usually a 1 to 2 second all-red "
        "'clearance' gap so the intersection empties before the cross traffic goes. "
        "In a small demo we shorten these (for example 3 seconds each) so the whole "
        "cycle is easy to watch.",
    ),
    (
        "ArduKid Basics: The setup and loop structure",
        "Every Arduino program has two parts. setup() runs once when the board turns "
        "on; put one-time jobs there, like pinMode to choose which pins are inputs "
        "or outputs, or starting Serial. loop() runs over and over forever after "
        "setup; put the repeating behaviour there, like blinking an LED or checking "
        "a sensor. delay(ms) pauses the program for a number of milliseconds (1000 "
        "ms = 1 second). Because loop repeats, anything you want to keep happening "
        "must live inside it.",
    ),
    (
        "ArduKid Basics: Troubleshooting when nothing lights up",
        "If a part does not light or react, check these in order. 1) Ground: almost "
        "every part needs a wire back to a GND pin; a missing ground is the most "
        "common mistake. 2) Resistor and polarity: an LED needs a series resistor, "
        "and its longer anode leg must face the positive side. 3) pinMode: a pin "
        "you drive must be set to OUTPUT in setup; a pin you read as a button often "
        "needs INPUT_PULLUP. 4) The right pin: make sure the pin number in the code "
        "matches the pin the wire actually uses. 5) Short circuits: never wire 5V "
        "straight to GND.",
    ),
]

# --- Curated, openly licensed reference URLs ----------------------------------
# SparkFun Learn is CC BY-SA 4.0; Wikipedia is CC BY-SA; the Arduino language
# reference is indexed for exact function syntax. "/all" gives the full page.
CURATED_URLS: list[tuple[str, str]] = [
    ("https://learn.sparkfun.com/tutorials/voltage-current-resistance-and-ohms-law/all",
     "SparkFun (CC BY-SA): Voltage, Current, Resistance, and Ohm's Law"),
    ("https://learn.sparkfun.com/tutorials/light-emitting-diodes-leds/all",
     "SparkFun (CC BY-SA): Light-Emitting Diodes (LEDs)"),
    ("https://learn.sparkfun.com/tutorials/resistors/all",
     "SparkFun (CC BY-SA): Resistors"),
    ("https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all",
     "SparkFun (CC BY-SA): How to Use a Breadboard"),
    ("https://learn.sparkfun.com/tutorials/analog-vs-digital/all",
     "SparkFun (CC BY-SA): Analog vs. Digital"),
    ("https://learn.sparkfun.com/tutorials/pulse-width-modulation/all",
     "SparkFun (CC BY-SA): Pulse Width Modulation"),
    ("https://learn.sparkfun.com/tutorials/pull-up-resistors/all",
     "SparkFun (CC BY-SA): Pull-up Resistors"),
    ("https://learn.sparkfun.com/tutorials/what-is-an-arduino/all",
     "SparkFun (CC BY-SA): What is an Arduino?"),
    ("https://en.wikipedia.org/wiki/Seven-segment_display",
     "Wikipedia (CC BY-SA): Seven-segment display"),
    ("https://en.wikipedia.org/wiki/Ohm%27s_law",
     "Wikipedia (CC BY-SA): Ohm's law"),
    ("https://docs.arduino.cc/language-reference/en/functions/digital-io/digitalWrite/",
     "Arduino Reference: digitalWrite()"),
    ("https://docs.arduino.cc/language-reference/en/functions/analog-io/analogWrite/",
     "Arduino Reference: analogWrite()"),
]


async def _seed_text(limit: int | None, dry_run: bool) -> int:
    docs = AUTHORED_DOCS[:limit] if limit else AUTHORED_DOCS
    total = 0
    for source, text in docs:
        if dry_run:
            print(f"  [text] would index: {source}")
            continue
        print(f"indexing text: {source} ...", flush=True)
        try:
            n = await index_plain_text(text, source=source)
            total += n
            print(f"  indexed {n} chunks")
        except Exception as exc:  # keep going; one failure must not abort the rest
            print(f"  failed: {exc}", file=sys.stderr)
    return total


async def _seed_urls(limit: int | None, dry_run: bool) -> int:
    urls = CURATED_URLS[:limit] if limit else CURATED_URLS
    total = 0
    for url, label in urls:
        if dry_run:
            print(f"  [url]  would index: {label} <- {url}")
            continue
        print(f"indexing URL: {label} ...", flush=True)
        try:
            n = await index_url(url, source=label)
            total += n
            print(f"  indexed {n} chunks" if n else "  (no extractable text, skipped)")
        except Exception as exc:
            print(f"  failed: {exc}", file=sys.stderr)
    return total


async def main_async(args: argparse.Namespace) -> int:
    if args.ensure_index:
        await _create_index(collection="knowledge_chunks", name=KNOWLEDGE_VECTOR_INDEX, path="embedding")
        print("ensured knowledge vector index")
        return 0

    total = 0
    if not args.urls_only:
        total += await _seed_text(args.limit, args.dry_run)
    if not args.text_only:
        total += await _seed_urls(args.limit, args.dry_run)

    if not args.dry_run:
        print("ensuring knowledge vector index ...", flush=True)
        await _create_index(collection="knowledge_chunks", name=KNOWLEDGE_VECTOR_INDEX, path="embedding")
        print(f"done - {total} chunks indexed")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the curated RAG knowledge corpus.")
    parser.add_argument("--text-only", action="store_true", help="Index only the authored primers.")
    parser.add_argument("--urls-only", action="store_true", help="Index only the curated URLs.")
    parser.add_argument("--ensure-index", action="store_true", help="Only (re)create the vector index.")
    parser.add_argument("--limit", type=int, default=None, help="Cap items per kind (smoke test).")
    parser.add_argument("--dry-run", action="store_true", help="List what would be indexed, write nothing.")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
