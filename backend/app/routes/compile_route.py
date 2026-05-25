from fastapi import APIRouter

from ..schemas import CompileResponse, CompileSource
from ..services.blockly_to_cpp import blockly_xml_to_cpp
from ..services.compiler import compile_cpp

router = APIRouter()


@router.post("/compile", response_model=CompileResponse)
async def compile_source(payload: CompileSource) -> CompileResponse:
    if payload.source_kind == "blockly_xml":
        cpp = blockly_xml_to_cpp(payload.source)
    else:
        cpp = payload.source

    result = await compile_cpp(cpp)
    return CompileResponse(
        ok=result.ok,
        hex=result.hex_text,
        stderr=result.stderr,
        error=result.error,
    )
