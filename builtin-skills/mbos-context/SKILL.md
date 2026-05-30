---
name: mbos-context
description: Inspect request-scoped dependency projections that AgentSmith has already supplied to this runner session. Use when a task needs to confirm which projected dependencies are available without searching local files.
---

# MBOS Context

## Overview

This skill does not define AgentSmith context policy or credential resolution. It only reads opaque request projections that AgentSmith has already made available to the runner.

## Quick Start

```bash
python3 ~/.agents/skills/mbos-context/scripts/context_cli.py list
python3 ~/.agents/skills/mbos-context/scripts/context_cli.py get --dependency sample-dependency
python3 ~/.agents/skills/mbos-context/scripts/context_cli.py get --dependency sample-dependency --field value
```

## Workflow

1. Use `list` to see the dependency names projected for this run.
2. Use `get --dependency <name>` to inspect one projection.
3. Use `--field <field>` when a skill expects a specific field.
4. If a projection is missing, ask AgentSmith to provide it for the run.

## Safety Rules

- Do not infer write policy or credential resolution from this runner repo.
- Do not search workspace files for hidden config when a required projection is missing.
- Do not persist projected secrets into workspace files or reusable config.
