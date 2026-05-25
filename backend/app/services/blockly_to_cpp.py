"""Trivial passthrough for phase 2.

A real Blockly XML -> Arduino C++ generator lives on the frontend (Blockly has
a JS code generator) and lands in phase 3. The backend keeps this stub so the
`/api/compile` route accepts both `cpp` and `blockly_xml` source kinds today,
and we can swap in a richer translator later without breaking callers."""


def blockly_xml_to_cpp(xml: str) -> str:
    if "void setup" in xml or "void loop" in xml:
        return xml
    return (
        "// phase 2 placeholder. blockly -> c++ codegen runs on the frontend in phase 3.\n"
        "void setup() {\n"
        "  pinMode(13, OUTPUT);\n"
        "}\n\n"
        "void loop() {\n"
        "  digitalWrite(13, HIGH);\n"
        "  delay(500);\n"
        "  digitalWrite(13, LOW);\n"
        "  delay(500);\n"
        "}\n"
    )
