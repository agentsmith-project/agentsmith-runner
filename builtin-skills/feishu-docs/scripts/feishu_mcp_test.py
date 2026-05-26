import argparse
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import feishu_mcp


class FeishuMcpTests(unittest.TestCase):
    @patch("feishu_mcp.resolve_projected_dependency")
    def test_loads_connection_from_request_projection(self, mock_resolve: MagicMock) -> None:
        mock_resolve.return_value = {
            "provider_label": "feishu",
            "fields": {"access_token": "token_from_projection"},
        }

        connection = feishu_mcp.load_feishu_projection()

        self.assertEqual(connection["fields"]["access_token"], "token_from_projection")
        self.assertEqual(mock_resolve.call_args.args[1], "feishu-managed-user")

    @patch("feishu_mcp.resolve_projected_dependency")
    def test_explicit_access_token_does_not_require_projection(self, mock_resolve: MagicMock) -> None:
        args = argparse.Namespace(**{"access_" + "token": "explicit", "mcp_endpoint": "https://mcp.example.test"})

        connection = feishu_mcp.resolve_feishu_connection(args)

        self.assertEqual(connection["fields"]["access_token"], "explicit")
        self.assertEqual(connection["fields"]["feishu_mcp_endpoint"], "https://mcp.example.test")
        mock_resolve.assert_not_called()

    def test_build_headers_accepts_projected_token_alias(self) -> None:
        headers = feishu_mcp.build_headers(
            {"fields": {"uat": "token_alias"}},
            "search-doc",
        )

        self.assertEqual(headers["X-Lark-MCP-UAT"], "token_alias")
        self.assertEqual(headers["X-Lark-MCP-Allowed-Tools"], "search-doc")

    @patch("feishu_mcp.urlopen")
    @patch("feishu_mcp.resolve_projected_dependency")
    def test_rpc_call_uses_projected_endpoint_and_token(
        self,
        mock_resolve: MagicMock,
        mock_urlopen: MagicMock,
    ) -> None:
        mock_resolve.return_value = {
            "fields": {
                "access_token": "token_projected",
                "feishu_mcp_endpoint": "https://mcp.example.test",
            }
        }
        response = MagicMock()
        response.read.return_value = json.dumps({"result": {"ok": True}}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = response
        args = argparse.Namespace(**{"access_" + "token": None, "mcp_endpoint": None})

        result = feishu_mcp.rpc_call(args, "tools/list", {}, "search-doc")

        self.assertEqual(result, {"result": {"ok": True}})
        req = mock_urlopen.call_args.args[0]
        self.assertEqual(req.full_url, "https://mcp.example.test")
        self.assertEqual(req.headers["X-lark-mcp-uat"], "token_projected")


if __name__ == "__main__":
    unittest.main()
