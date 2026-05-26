#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from typing import Any

SHARED_RUNTIME_DIR = Path(__file__).resolve().parents[2] / ".mbos-runtime"
if str(SHARED_RUNTIME_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_RUNTIME_DIR))

from capability_runtime import list_projected_dependency_names, read_projected_dependency


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Inspect request-scoped dependency projections supplied by AgentSmith."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    list_parser = sub.add_parser("list")
    list_parser.set_defaults(func=cmd_list)

    get_parser = sub.add_parser("get")
    get_parser.add_argument("--dependency", required=True)
    get_parser.add_argument("--field")
    get_parser.set_defaults(func=cmd_get)

    return parser.parse_args()


def _json_print(payload: Any) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def cmd_list(_args: argparse.Namespace) -> int:
    _json_print({"dependencies": list_projected_dependency_names()})
    return 0


def cmd_get(args: argparse.Namespace) -> int:
    payload = read_projected_dependency(args.dependency, required=True)
    if args.field:
        fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else payload
        value = fields.get(args.field) if isinstance(fields, dict) else None
        if not isinstance(value, str):
            raise RuntimeError(f"Projected dependency '{args.dependency}' does not include field '{args.field}'.")
        print(value)
        return 0
    _json_print(payload)
    return 0


def main() -> int:
    args = parse_args()
    return args.func(args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover
        sys.stderr.write(f"{exc}\n")
        raise SystemExit(1)
