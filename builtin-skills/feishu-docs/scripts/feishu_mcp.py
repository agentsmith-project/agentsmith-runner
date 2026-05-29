#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.error
import urllib.parse
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

SHARED_RUNTIME_DIR = Path(__file__).resolve().parents[2] / ".mbos-runtime"
if str(SHARED_RUNTIME_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_RUNTIME_DIR))

from capability_runtime import resolve_projected_dependency


ENDPOINT = "https://mcp.feishu.cn/mcp"
TRUSTED_MCP_HOSTS = {"mcp.feishu.cn"}
DEFAULT_ALLOWED_TOOLS = (
    "search-user,get-user,fetch-file,search-doc,create-doc,"
    "fetch-doc,update-doc,list-docs,get-comments,add-comments"
)


def load_feishu_projection() -> dict[str, Any] | None:
    projection = resolve_projected_dependency(__file__, "feishu-managed-user")
    return projection or None


def get_projected_connection_field(connection: dict[str, Any], *keys: str) -> str | None:
    fields = connection.get("fields")
    sources = [fields, connection] if isinstance(fields, dict) else [connection]
    for source in sources:
        if not isinstance(source, dict):
            continue
        for key in keys:
            value = source.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def resolve_feishu_connection(args: argparse.Namespace | None = None) -> dict[str, Any]:
    projected = load_feishu_projection()
    if projected is None:
        raise RuntimeError(
            "Feishu request projection 'feishu-managed-user' is unavailable. "
            "Ask AgentSmith to project it for this run."
        )
    return projected


def resolve_feishu_endpoint(connection: dict[str, Any]) -> str:
    endpoint = get_projected_connection_field(connection, "endpoint") or ENDPOINT
    parsed = urllib.parse.urlparse(endpoint)
    hostname = parsed.hostname.lower() if parsed.hostname else ""
    if parsed.scheme != "https" or not hostname:
        raise RuntimeError("Feishu MCP endpoint must be an HTTPS endpoint.")
    if parsed.username or parsed.password:
        raise RuntimeError("Feishu MCP endpoint must not include credentials.")
    if hostname not in TRUSTED_MCP_HOSTS:
        raise RuntimeError(f"Feishu MCP endpoint host is not trusted: {hostname}")
    return endpoint


def build_headers(connection: dict[str, Any], allowed_tools: str) -> dict[str, str]:
    token = get_projected_connection_field(connection, "access_token", "uat", "token")
    if not token:
        raise RuntimeError("Feishu projection is missing access_token.")

    return {
        "Content-Type": "application/json",
        "X-Lark-MCP-UAT": token,
        "X-Lark-MCP-Allowed-Tools": allowed_tools,
    }


def rpc_call(args: argparse.Namespace, method: str, params: dict[str, Any], allowed_tools: str) -> dict[str, Any]:
    connection = resolve_feishu_connection(args)
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    }
    data = json.dumps(payload).encode("utf-8")
    endpoint = resolve_feishu_endpoint(connection)
    req = Request(
        endpoint,
        data=data,
        headers=build_headers(connection, allowed_tools),
        method="POST",
    )

    try:
        with urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"HTTP {exc.code} from Feishu MCP: {body}\n"
            "If this looks like auth expiry, refresh the connection in AgentSmith and rerun."
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error calling Feishu MCP: {exc}") from exc

    result = json.loads(body)
    if result.get("error"):
        raise RuntimeError(
            "Feishu MCP returned error: "
            + json.dumps(result["error"], ensure_ascii=False)
            + "\nIf this looks like auth expiry, refresh the connection in AgentSmith and rerun."
        )
    return result


def parse_json_arg(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("JSON params must decode to an object")
    return parsed


def cmd_initialize(args: argparse.Namespace) -> int:
    result = rpc_call(
        args,
        "initialize",
        {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "feishu-docs-skill", "version": "1.0.0"},
        },
        args.allowed_tools,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_tools_list(args: argparse.Namespace) -> int:
    result = rpc_call(args, "tools/list", {}, args.allowed_tools)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_call_tool(args: argparse.Namespace) -> int:
    tool_name = args.tool_name
    params = parse_json_arg(args.params)
    allowed_tools = args.allowed_tools or tool_name
    result = rpc_call(
        args,
        "tools/call",
        {
            "name": tool_name,
            "arguments": params,
        },
        allowed_tools,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Call Feishu remote MCP over HTTP using a request projection."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("initialize")
    init_parser.add_argument("--allowed-tools", default=DEFAULT_ALLOWED_TOOLS)
    init_parser.set_defaults(func=cmd_initialize)

    list_parser = subparsers.add_parser("tools-list")
    list_parser.add_argument("--allowed-tools", default=DEFAULT_ALLOWED_TOOLS)
    list_parser.set_defaults(func=cmd_tools_list)

    call_parser = subparsers.add_parser("call-tool")
    call_parser.add_argument("tool_name")
    call_parser.add_argument("--params", default="{}")
    call_parser.add_argument(
        "--allowed-tools",
        default=None,
        help="Comma-separated whitelist sent to Feishu. Defaults to the tool name being called.",
    )
    call_parser.set_defaults(func=cmd_call_tool)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except Exception as exc:  # noqa: BLE001
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
