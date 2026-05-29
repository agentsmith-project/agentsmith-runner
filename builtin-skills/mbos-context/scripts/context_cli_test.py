import json
import os
import sys
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".mbos-runtime"))
import context_cli
import capability_runtime


class ContextCliTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "MBOS_AGENT_PROJECTED_DEPENDENCIES": json.dumps(
                {
                    "dependencies": {
                        "jira-auth": {"fields": {"base_url": "https://jira.example.com", "token": "jira_token_123"}},
                        "feishu-managed-user": {"fields": {"access_token": "feishu_token_123"}},
                    }
                }
            )
        },
        clear=True,
    )
    def test_lists_projected_dependency_names(self) -> None:
        with patch.object(sys, "argv", ["context_cli.py", "list"]), patch("sys.stdout", new_callable=StringIO) as stdout:
            exit_code = context_cli.main()

        self.assertEqual(exit_code, 0)
        payload = json.loads(stdout.getvalue())
        self.assertEqual(payload["dependencies"], ["feishu-managed-user", "jira-auth"])

    @patch.dict(
        os.environ,
        {
            "MBOS_AGENT_PROJECTED_DEPENDENCIES": json.dumps(
                {"dependencies": {"jira-auth": {"fields": {"base_url": "https://jira.example.com"}}}}
            )
        },
        clear=True,
    )
    def test_get_prints_requested_projection_field(self) -> None:
        with patch.object(
            sys,
            "argv",
            ["context_cli.py", "get", "--dependency", "jira-auth", "--field", "base_url"],
        ), patch("sys.stdout", new_callable=StringIO) as stdout:
            exit_code = context_cli.main()

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout.getvalue(), "https://jira.example.com\n")

    @patch.dict(
        os.environ,
        {
            "MBOS_AGENT_PROJECTED_DEPENDENCIES": json.dumps(
                {
                    "dependencies": {
                        "jira-auth": {
                            "fields": {"base_url": "https://jira.example.com", "token": "jira_token_123"}
                        }
                    }
                }
            )
        },
        clear=True,
    )
    def test_runtime_helper_resolves_projected_fields_by_dependency_name(self) -> None:
        resolved = capability_runtime.resolve_projected_fields(
            Path(__file__).resolve().parents[2] / "jira-ops" / "scripts" / "jira_ops.py",
            "jira-auth",
        )

        self.assertEqual(
            resolved,
            {
                "base_url": "https://jira.example.com",
                "token": "jira_token_123",
            },
        )

    @patch.dict(
        os.environ,
        {
            "MBOS_AGENT_PROJECTED_DEPENDENCY_JIRA_AUTH": json.dumps(
                {"fields": {"base_url": "https://jira.example.com", "token": "jira_token_123"}}
            )
        },
        clear=True,
    )
    def test_runtime_helper_ignores_legacy_per_dependency_env(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "Request projection 'jira-auth' is unavailable"):
            capability_runtime.resolve_projected_fields(
                Path(__file__).resolve().parents[2] / "jira-ops" / "scripts" / "jira_ops.py",
                "jira-auth",
                required=True,
            )


if __name__ == "__main__":
    unittest.main()
