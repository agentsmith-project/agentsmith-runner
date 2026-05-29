# Common Rules

## Authentication

Use the opaque `jira-auth` request projection supplied by AgentSmith for Bearer token auth.

Rules:

- resolve the `jira-auth` dependency through the shared runtime helper
- if the base URL is not present in the projection, pass `--base-url` explicitly
- if the token is not present in the projection, ask AgentSmith to provide it for this run

## Proxy Rule

Always clear proxy environment variables before Jira access.

This skill's script already clears:

- `http_proxy`
- `https_proxy`
- `HTTP_PROXY`
- `HTTPS_PROXY`
- `all_proxy`
- `ALL_PROXY`
- `no_proxy`
- `NO_PROXY`

If you do not use the script, replicate this behavior manually.

## API Version

Default to Jira REST API v2 paths unless the site proves otherwise.

For Jira 9.12.x, this skill assumes the common Server/Data Center v2 REST endpoints.

## TLS

The helper script accepts self-signed or private CA certificates by using an unverified SSL context.
Only use that against trusted internal Jira sites.

## Weak-Model Guidance

- inspect the `jira-auth` request projection before assuming auth inputs
- If the issue key is unknown, search first
- If editing fields, inspect `editmeta` first
- If transitioning, inspect transitions with field expansion first
- If JQL becomes long or complex, force POST search
