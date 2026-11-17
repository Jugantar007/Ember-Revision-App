#!/usr/bin/env python3
"""Content linter for Ember. Run from the repo root: python3 scripts/validate.py

Checks every file listed in data/index.json for valid JSON, required fields,
duplicate ids across all files, and well-formed MCQ blocks.
Exits non-zero if anything is wrong, so it also works as a pre-commit hook.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

REQUIRED = ("id", "type", "q", "a_short")
VALID_TYPES = {"concept", "predict_output", "coding", "compare"}


def main() -> int:
    problems = []
    seen_ids = {}
    total = 0

    index_path = os.path.join(DATA, "index.json")
    try:
        with open(index_path, encoding="utf-8") as fh:
            index = json.load(fh)
    except Exception as exc:
        print(f"✗ data/index.json — {exc}")
        return 1

    print(f"index v{index.get('version')} · {len(index.get('sections', []))} sections\n")

    for section in index.get("sections", []):
        path = os.path.join(DATA, section["file"])
        label = section["id"]

        if not os.path.exists(path):
            problems.append(f"{label}: file not found — {section['file']}")
            continue

        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except json.JSONDecodeError as exc:
            problems.append(f"{label}: invalid JSON at line {exc.lineno} — {exc.msg}")
            continue

        items = data.get("items", [])
        total += len(items)
        mcq_count = 0

        for item in items:
            iid = item.get("id", "<no id>")

            for key in REQUIRED:
                if not item.get(key):
                    problems.append(f"{iid}: missing required field '{key}'")

            if item.get("type") not in VALID_TYPES:
                problems.append(f"{iid}: unknown type '{item.get('type')}'")

            if iid in seen_ids:
                problems.append(f"{iid}: duplicate id (also in {seen_ids[iid]})")
            seen_ids[iid] = section["file"]

            diff = item.get("difficulty")
            if diff is not None and not (isinstance(diff, int) and 1 <= diff <= 4):
                problems.append(f"{iid}: difficulty must be an int 1-4, got {diff!r}")

            mcq = item.get("mcq")
            if mcq:
                mcq_count += 1
                opts = mcq.get("options")
                correct = mcq.get("correct")
                if not isinstance(opts, list) or len(opts) < 2:
                    problems.append(f"{iid}: mcq needs at least 2 options")
                elif not isinstance(correct, int) or not 0 <= correct < len(opts):
                    problems.append(f"{iid}: mcq 'correct' index {correct!r} out of range")
                elif len(set(opts)) != len(opts):
                    problems.append(f"{iid}: mcq has duplicate options")

        print(f"  {label:22} {len(items):3} items   {mcq_count:3} with MCQ")

    print(f"\n{total} items · {len(seen_ids)} unique ids")

    if problems:
        print(f"\n✗ {len(problems)} problem(s):")
        for p in problems:
            print(f"  - {p}")
        return 1

    print("\n✓ all content valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
