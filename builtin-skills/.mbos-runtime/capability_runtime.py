import json
import os
from pathlib import Path
from typing import Any


PROJECTED_DEPENDENCIES_ENV = "MBOS_AGENT_PROJECTED_DEPENDENCIES"


def _read_json_env(name: str) -> Any | None:
    value = os.environ.get(name, "").strip()
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{name} must contain valid JSON.") from exc


def _read_json_file(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"Skill capability descriptor at {path} must be a JSON object.")
    return payload


def resolve_skill_root(script_file: str | Path) -> Path:
    path = Path(script_file).resolve()
    if path.parent.name == "scripts":
        return path.parent.parent
    return path.parent


def load_skill_capability_contract(script_file: str | Path) -> dict[str, Any]:
    skill_root = resolve_skill_root(script_file)
    contract_path = skill_root / "capabilities.json"
    if not contract_path.is_file():
        raise RuntimeError(f"Skill capability descriptor not found: {contract_path}")
    payload = _read_json_file(contract_path)
    if payload.get("version") != 1:
        raise RuntimeError(f"Skill capability descriptor version is unsupported: {contract_path}")
    return payload


def find_dependency(contract: dict[str, Any], dependency_name: str) -> dict[str, Any]:
    dependencies = contract.get("dependencies")
    if not isinstance(dependencies, list):
        raise RuntimeError("Skill capability descriptor is missing dependencies.")
    for dependency in dependencies:
        if isinstance(dependency, dict) and dependency.get("name") == dependency_name:
            return dependency
    skill_name = contract.get("skill_name", "unknown-skill")
    raise RuntimeError(f"Dependency '{dependency_name}' is not defined for skill '{skill_name}'.")


def list_projected_dependency_names() -> list[str]:
    names: list[str] = []
    bundle = _read_json_env(PROJECTED_DEPENDENCIES_ENV)
    if isinstance(bundle, dict):
        container = bundle.get("dependencies") if isinstance(bundle.get("dependencies"), dict) else bundle
        for key in container:
            if isinstance(key, str):
                names.append(key)
    return sorted(set(names))


def _read_projected_dependency(dependency_name: str) -> Any | None:
    bundle = _read_json_env(PROJECTED_DEPENDENCIES_ENV)
    if not isinstance(bundle, dict):
        return None
    dependencies = bundle.get("dependencies")
    if isinstance(dependencies, dict) and dependency_name in dependencies:
        return dependencies[dependency_name]
    return bundle.get(dependency_name)


def read_projected_dependency(dependency_name: str, *, required: bool = False) -> dict[str, Any]:
    payload = _read_projected_dependency(dependency_name)
    if payload is None:
        if required:
            raise RuntimeError(
                f"Request projection '{dependency_name}' is unavailable. "
                "Ask AgentSmith to project it for this run or pass explicit CLI parameters."
            )
        return {}
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, str) and payload.strip():
        return {"value": payload.strip()}
    raise RuntimeError(f"Request projection '{dependency_name}' must be a JSON object or non-empty string.")


def resolve_projected_dependency(
    script_file: str | Path,
    dependency_name: str,
    *,
    required: bool = False,
) -> dict[str, Any]:
    contract = load_skill_capability_contract(script_file)
    dependency = find_dependency(contract, dependency_name)
    if dependency.get("kind") not in (None, "opaque_projection"):
        raise RuntimeError(f"Dependency '{dependency_name}' must be an opaque projection descriptor.")

    return read_projected_dependency(dependency_name, required=required)


def resolve_projected_fields(
    script_file: str | Path,
    dependency_name: str,
    *,
    required: bool = False,
) -> dict[str, str]:
    payload = resolve_projected_dependency(script_file, dependency_name, required=required)
    fields = payload.get("fields")
    source = fields if isinstance(fields, dict) else payload
    resolved: dict[str, str] = {}
    for key, value in source.items():
        if isinstance(key, str) and isinstance(value, str) and value.strip():
            resolved[key] = value.strip()
    return resolved
