"""Drive the real agent over the chat SSE API and print a readable transcript.

Used to test the full traffic-light -> add-7-segment flow end to end against a
locally running backend (ARDUKID_AGENT_MODE=real). Not part of the app.
"""

import json
import sys

import httpx

BASE = "http://127.0.0.1:8080"
SESSION = "drive-test-2"
CLIENT = "drive-client-2"


def _short(name: str, args: dict) -> str:
    if name == "set_program":
        return f"setup={len(args.get('setup') or [])} steps, loop={len(args.get('loop') or [])} steps"
    if name == "edit_program":
        eds = args.get("edits") or []
        return "; ".join(f"{e.get('action')} {e.get('list')}" for e in eds) or "(no edits)"
    if name == "set_blocks":
        return f"raw XML ({len(args.get('blockly_xml') or '')} chars)"
    if name == "add_components":
        comps = args.get("components") or []
        return ", ".join(str(c.get("type")) for c in comps)
    if name == "add_component":
        return str(args.get("type"))
    if name == "wire_many":
        return f"{len(args.get('wires') or [])} wires"
    if name in ("search_web", "find_similar_example", "search_docs"):
        return f"query={args.get('query')!r}"
    if name == "read_web_page":
        return str(args.get("url"))
    if name == "load_skill":
        return str(args.get("skill_name"))
    return ", ".join(f"{k}={v}" for k, v in args.items() if k != "blockly_xml")[:120]


def run(message: str) -> None:
    print("\n" + "=" * 78)
    print(f"USER: {message}")
    print("=" * 78)
    payload = {
        "session_id": SESSION,
        "client_id": CLIENT,
        "message": message,
        "board": "uno",
    }
    counts = {"tool_calls": 0, "errors": 0}
    with httpx.stream(
        "POST", f"{BASE}/api/agent/chat", json=payload, timeout=420.0
    ) as resp:
        resp.raise_for_status()
        event = None
        for line in resp.iter_lines():
            if line.startswith("event:"):
                event = line[len("event:"):].strip()
            elif line.startswith("data:"):
                raw = line[len("data:"):].strip()
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if event == "tool_call":
                    counts["tool_calls"] += 1
                    name = data.get("name", "")
                    print(f"  -> {name}({_short(name, data.get('args') or {})})")
                elif event == "tool_result":
                    res = data.get("result") or {}
                    if isinstance(res, dict) and res.get("ok") is False:
                        counts["errors"] += 1
                        print(f"     !! {data.get('name')} FAILED: {res.get('error')}")
                elif event == "agent_text":
                    text = (data.get("content") or "").strip()
                    if text:
                        print(f"  AGENT: {text}")
                elif event == "error":
                    print(f"  ERROR: {data.get('message')}")
    print(f"  [summary] {counts['tool_calls']} tool calls, {counts['errors']} failed")


if __name__ == "__main__":
    run("Creame un semaforo con tres leds de diferentes colores.")
    if "--one" not in sys.argv:
        run(
            "Ahora agregale un display de 7 segmentos para mostrar los segundos que "
            "faltan entre cada cambio de luz. Busca en internet los tiempos estandar "
            "de un semaforo y usalos."
        )
