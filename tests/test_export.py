import csv
import json
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
from export import WEB_DATA, write_csv  # noqa: E402

SCHEMA_DIR = WEB_DATA / "schema"


def _validator(name: str) -> Draft202012Validator:
    schemas = {p.name: json.loads(p.read_text()) for p in SCHEMA_DIR.glob("*.schema.json")}
    registry = Registry().with_resources((n, Resource.from_contents(s)) for n, s in schemas.items())
    Draft202012Validator.check_schema(schemas[name])
    return Draft202012Validator(schemas[name], registry=registry)


@pytest.mark.parametrize("path", sorted(WEB_DATA.glob("*/index.json")), ids=lambda p: p.parent.name)
def test_index_matches_schema(path):
    errors = list(_validator("index.schema.json").iter_errors(json.loads(path.read_text())))
    assert not errors, errors[0].message


@pytest.mark.parametrize("path", sorted(WEB_DATA.glob("*/regions/*.json")),
                         ids=lambda p: f"{p.parent.parent.name}-{p.stem}")
def test_region_matches_schema(path):
    errors = list(_validator("region.schema.json").iter_errors(json.loads(path.read_text())))
    assert not errors, f"{errors[0].json_path}: {errors[0].message}"


def test_write_csv_nulls_and_booleans(tmp_path):
    months = [{"ym": "2000-11", "modis": 3, "viirs": None, "harm": 9.5, "harm_lo": 7.0, "harm_hi": float("nan"),
               "src": "backcast_terra", "fit_level": "region_dn", "anom_pct": 40.0, "anom": True,
               "outage_days": 0, "outage": False}]
    p = tmp_path / "x.csv"
    write_csv(p, "EL52", "harmonized", months)
    rows = list(csv.DictReader(p.open()))
    assert rows[0]["region_id"] == "EL52" and rows[0]["viirs"] == "" and rows[0]["harm_hi"] == ""
    assert rows[0]["anom"] == "true" and rows[0]["outage"] == "false" and rows[0]["harm"] == "9.5"
