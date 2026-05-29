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
        args = argparse.Namespace(base_url=None, token="explicit")

        with self.assertRaisesRegex(RuntimeError, "Jira token not found"):
            jira_ops.resolve_auth(args)

    def test_parser_rejects_explicit_token_arg(self) -> None:
        parser = jira_ops.build_parser()

        with patch("sys.stderr", new_callable=StringIO) as stderr, self.assertRaises(SystemExit) as raised:
            parser.parse_args(["--token", "explicit", "myself"])

        self.assertEqual(raised.exception.code, 2)
        self.assertTrue(stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
