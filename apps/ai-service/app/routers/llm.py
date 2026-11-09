from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..errors import ApiError
from ..llm import prompts
from ..llm.openai_compatible import LlmClient
from ..llm.schemas import (AnswerRequest, AnswerResponse, ExtractOutput, ExtractRequest, ExtractResponse, MapOutput, MapRequest, MapResponse, ModelAnswer,
                           ReduceOutput, ReduceRequest, ReduceResponse, Usage)
from ..logging import log_event
from ..security import require_signed_body

router = APIRouter(prefix="/v1/llm", dependencies=[Depends(require_signed_body)])


def get_llm(request: Request) -> LlmClient:
    llm = getattr(request.app.state, "llm", None)
    if llm is None:
        llm = LlmClient(request.app.state.settings)
        request.app.state.llm = llm
    return llm


def _meta(c, version: str) -> dict:  # noqa: ANN001
    return {"usage": Usage(inputTokens=c.input_tokens, outputTokens=c.output_tokens), "model": c.model, "promptVersion": version, "structuredMode": c.mode}


@router.post("/answer", response_model=AnswerResponse)
async def answer(req: AnswerRequest, request: Request) -> AnswerResponse:
    s = request.app.state.settings
    messages, schema = prompts.build_answer(req.language, req.question, req.sources)
    c = await get_llm(request).complete(messages, schema, ModelAnswer, max_tokens=req.maxOutputTokens, timeout=s.llm_answer_timeout_s)
    log_event("llm_answer", sources=len(req.sources), tokens_in=c.input_tokens, tokens_out=c.output_tokens)
    return AnswerResponse(output=c.parsed, **_meta(c, prompts.PROMPT_VERSIONS["qa"]))


@router.post("/summarize-map", response_model=MapResponse)
async def summarize_map(req: MapRequest, request: Request) -> MapResponse:
    s = request.app.state.settings
    messages, schema = prompts.build_map(req.language, req.template, req.windowIndex, req.windowCount, req.sources)
    c = await get_llm(request).complete(messages, schema, MapOutput, max_tokens=req.maxOutputTokens, timeout=s.llm_map_timeout_s)
    log_event("llm_map", window=req.windowIndex, tokens_in=c.input_tokens, tokens_out=c.output_tokens)
    return MapResponse(output=c.parsed, **_meta(c, prompts.PROMPT_VERSIONS["summaryMap"]))


@router.post("/summarize-reduce", response_model=ReduceResponse)
async def summarize_reduce(req: ReduceRequest, request: Request) -> ReduceResponse:
    s = request.app.state.settings
    if req.mode == "final" and not req.sectionKeys:
        raise ApiError("VALIDATION_ERROR")
    messages, schema = prompts.build_reduce(req.language, req.template, req.mode, req.sectionKeys, req.notes)
    c = await get_llm(request).complete(messages, schema, ReduceOutput, max_tokens=req.maxOutputTokens, timeout=s.llm_reduce_timeout_s, strong=req.strong and req.mode == "final")
    log_event("llm_reduce", mode=req.mode, tokens_in=c.input_tokens, tokens_out=c.output_tokens)
    return ReduceResponse(output=c.parsed, **_meta(c, prompts.PROMPT_VERSIONS["summaryReduce"]))


@router.post("/extract", response_model=ExtractResponse)
async def extract(req: ExtractRequest, request: Request) -> ExtractResponse:
    s = request.app.state.settings
    messages, schema = prompts.build_extract(req.language, req.template, req.fields, req.sources)
    c = await get_llm(request).complete(messages, schema, ExtractOutput, max_tokens=req.maxOutputTokens, timeout=s.llm_extract_timeout_s, strong=req.strong)
    log_event("llm_extract", fields=len(req.fields), tokens_in=c.input_tokens, tokens_out=c.output_tokens)
    return ExtractResponse(output=c.parsed, **_meta(c, prompts.PROMPT_VERSIONS["extract"]))
