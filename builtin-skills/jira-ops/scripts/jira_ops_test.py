import argparse
import json
import sys
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import jira_ops


class JiraOpsTests(unittest.TestCase):
    @patch("jira_ops.resolve_projected_fields")
    def test_reads_jira_credentials_from_request_projection(self, mock_resolve: MagicMock) -> None:
        mock_resolve.return_value = {
            "base_url": "https://jira.example.com",
            "token": "jira_token_123",
        }

        base_url, token = jira_ops.load_jira_credentials_from_projection()

        self.assertEqual(base_url, "https://jira.example.com")
        self.assertEqual(token, "jira_token_123")
        self.assertEqual(mock_resolve.call_args.args[1], "jira-auth")

    @patch("jira_ops.resolve_projected_fields")
    def test_returns_none_when_request_projection_is_empty(self, mock_resolve: MagicMock) -> None:
        mock_resolve.return_value = {}

        base_url, token = jira_ops.load_jira_credentials_from_projection()

        self.assertIsNone(base_url)
        self.assertIsNone(token)

    @patch("jira_ops.resolve_projected_fields")
    def test_resolve_auth_rejects_explicit_token_fallback(self, mock_resolve: MagicMock) -> None:
        mock_resolve.return_value = {"base_url": "https://jira.example.com"}
        args = argparse.Namespace(base_url=None, **{"tok" + "en": "manual_arg"})

        with self.assertRaisesRegex(RuntimeError, "Jira token not found"):
            jira_ops.resolve_auth(args)

    def test_parser_rejects_explicit_token_arg(self) -> None:
        parser = jira_ops.build_parser()

        with patch("sys.stderr", new_callable=StringIO) as stderr, self.assertRaises(SystemExit) as raised:
            parser.parse_args(["--token", "explicit", "myself"])

        self.assertEqual(raised.exception.code, 2)
        self.assertTrue(stderr.getvalue())

    @patch("jira_ops.resolve_projected_fields")
    def test_base_url_rejects_embedded_credentials(self, mock_resolve: MagicMock) -> None:
        mock_resolve.return_value = {"token": "jira_token_123"}
        args = argparse.Namespace(base_url="https://user:pass@jira.example.com", ca_bundle=None)

        with self.assertRaisesRegex(RuntimeError, "must not include credentials"):
            jira_ops.resolve_connection(args)

    @patch("jira_ops.ssl._create_unverified_context")
    @patch("jira_ops.ssl.create_default_context")
    @patch("jira_ops.urllib.request.urlopen")
    def test_request_json_uses_default_verified_ssl_context(
        self,
        mock_urlopen: MagicMock,
        mock_create_default_context: MagicMock,
        mock_create_unverified_context: MagicMock,
    ) -> None:
        ssl_context = MagicMock()
        mock_create_default_context.return_value = ssl_context
        response = MagicMock()
        response.read.return_value = json.dumps({"ok": True}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = response

        result = jira_ops.request_json("https://jira.example.com", "token", "GET", "/rest/api/2/myself")

        self.assertEqual(result, {"ok": True})
        mock_create_default_context.assert_called_once_with()
        mock_create_unverified_context.assert_not_called()
        self.assertIs(mock_urlopen.call_args.kwargs["context"], ssl_context)

    @patch("jira_ops.ssl._create_unverified_context")
    @patch("jira_ops.ssl.create_default_context")
    @patch("jira_ops.urllib.request.urlopen")
    def test_request_json_passes_ca_bundle_to_verified_ssl_context(
        self,
        mock_urlopen: MagicMock,
        mock_create_default_context: MagicMock,
        mock_create_unverified_context: MagicMock,
    ) -> None:
        ssl_context = MagicMock()
        mock_create_default_context.return_value = ssl_context
        response = MagicMock()
        response.read.return_value = json.dumps({"ok": True}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = response

        result = jira_ops.request_json(
            "https://jira.example.com",
            "token",
            "GET",
            "/rest/api/2/myself",
            ca_bundle="/tmp/internal-ca.pem",
        )

        self.assertEqual(result, {"ok": True})
        mock_create_default_context.assert_called_once_with(cafile="/tmp/internal-ca.pem")
        mock_create_unverified_context.assert_not_called()
        self.assertIs(mock_urlopen.call_args.kwargs["context"], ssl_context)


if __name__ == "__main__":
    unittest.main()
