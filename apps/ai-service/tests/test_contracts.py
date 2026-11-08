"""Shared JSON fixtures: the same files are validated by the zod mirrors in apps/api/tests/ai-contracts.test.ts."""
import json
from pathlib import Path

import pytest

from app import schemas

FIX = Path(__file__).parent / "fixtures"
MODELS = {
    "extract-chunk.response": schemas.ExtractChunkResponse,
    "index.request": schemas.IndexRequest,
    "index.response": schemas.IndexResponse,
    "delete.request": schemas.DeleteRequest,
    "delete.response": schemas.DeleteResponse,
    "search.request": schemas.SearchRequest,
    "search.response": schemas.SearchResponse,
    "reindex-plan.response": schemas.ReindexPlanResponse,
    "drop-collection.response": schemas.DropCollectionResponse,
}


@pytest.mark.parametrize("name", sorted(MODELS))
def test_fixture_validates_with_pydantic(name: str) -> None:
    data = json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))
    model = MODELS[name].model_validate(data)
    assert json.loads(model.model_dump_json(exclude_none=False))  # round-trips


def test_error_fixture_has_the_one_error_shape() -> None:
    from app.errors import CATALOG

    data = json.loads((FIX / "error.json").read_text(encoding="utf-8"))
    assert set(data) == {"code", "message", "retryable", "requestId"}
    assert data["code"] in CATALOG and CATALOG[data["code"]][1] == data["retryable"]


def test_unknown_keys_are_rejected() -> None:
    data = json.loads((FIX / "search.request.json").read_text(encoding="utf-8"))
    with pytest.raises(Exception):
        schemas.SearchRequest.model_validate({**data, "extra": 1})
