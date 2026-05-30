import json
import os
import sys
from tempfile import TemporaryDirectory
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / ".mbos-runtime"))
import context_cli
import capability_runtime


def write_temp_skill(root: Path, dependency_name: str) -> Path:
    skill_root = root / "neutral-skill"
    scripts_root = skill_root / "scripts"
    scripts_root.mkdir(parents=True)
    (skill_root / "capabilities.json").write_text(
        json.dumps(
            {
                "version": 1,
                "skill_name": "neutral-skill",
                "dependencies": [
                    {
                        "name": dependency_name,
                        "kind": "opaque_projection",
                        "provider_label": "sample-provider",
                        "expected_fields": ["value", "label"],
                        "required": True,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    script_path = scripts_root / "neutral_tool.py"
    script_path.write_text("print('ok')\n", encoding="utf-8")
    return script_path


class ContextCliTests(unittest.TestCase):
    @patch.dict(
        os.environ,
        {
            "MBOS_AGENT_PROJECTED_DEPENDENCIES": json.dumps(
                {
                    "dependencies": {
                        "sample-dependency": {"fields": {"value": "sample-value", "label": "sample-label"}},
                        "smoke-secret": {"fields": {"value": "smoke-value"}},
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
        self.assertEqual(payload["dependencies"], ["sample-dependency", "smoke-secret"])

    @patch.dict(
        os.environ,
        {
            "MBOS_AGENT_PROJECTED_DEPENDENCIES": json.dumps(
                {"dependencies": {"sample-dependency": {"fields": {"value": "sample-value"}}}}
            )
        },
        clear=True,
    )
    def test_get_prints_requested_projection_field(self) -> None:
        with patch.object(
            sys,
            "argv",
            ["context_cli.py", "get", "--dependency", "sample-dependency", "--field", "value"],
        ), patch("sys.stdout", new_callable=StringIO) as stdout:
            exit_code = context_cli.main()

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout.getvalue(), "sample-value\n")

    @patch.dict(
        os.environ,
        {
            "MBOS_AGENT_PROJECTED_DEPENDENCIES": json.dumps(
                {
                    "dependencies": {
                        "sample-dependency": {
                            "fields": {"value": "sample-value", "label": "sample-label"}
                        }
                    }
                }
            )
        },
        clear=True,
    )
    def test_runtime_helper_resolves_projected_fields_by_dependency_name(self) -> None:
        with TemporaryDirectory() as temp_dir:
            script_path = write_temp_skill(Path(temp_dir), "sample-dependency")
            resolved = capability_runtime.resolve_projected_fields(script_path, "sample-dependency")

        self.assertEqual(
            resolved,
            {
                "value": "sample-value",
                "label": "sample-label",
            },
        )

    @patch.dict(
        os.environ,
        {
            "MBOS_AGENT_PROJECTED_DEPENDENCY_SMOKE_SECRET": json.dumps(
                {"fields": {"value": "legacy-value"}}
            )
        },
        clear=True,
    )
    def test_runtime_helper_ignores_legacy_per_dependency_env(self) -> None:
        with TemporaryDirectory() as temp_dir:
            script_path = write_temp_skill(Path(temp_dir), "sample-dependency")
            with self.assertRaisesRegex(RuntimeError, "Request projection 'sample-dependency' is unavailable"):
                capability_runtime.resolve_projected_fields(
                    script_path,
                    "sample-dependency",
                    required=True,
                )


if __name__ == "__main__":
    unittest.main()
