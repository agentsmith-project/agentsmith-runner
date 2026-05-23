#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

failures=0

fail() {
  echo "FAIL: $*" >&2
  failures=$((failures + 1))
}

pass() {
  echo "PASS: $*"
}

require_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    pass "required file exists: $path"
  else
    fail "required file missing: $path"
  fi
}

require_grep() {
  local pattern="$1"
  local path="$2"
  local label="$3"
  if grep -Eqi "$pattern" "$path"; then
    pass "$label"
  else
    fail "$label"
  fi
}

scan_files() {
  find . \
    -path ./.git -prune -o \
    -type f \
    -print
}

check_remote() {
  local origin
  local normalized
  origin="$(git remote get-url origin 2>/dev/null || true)"

  normalized="$origin"
  normalized="${normalized#https://}"
  normalized="${normalized#http://}"
  normalized="${normalized#git@}"
  normalized="${normalized/:/\/}"
  normalized="${normalized%.git}"

  if [[ "$normalized" != "github.com/agentsmith-project/agentsmith-runner" ]]; then
    fail "origin must normalize to github.com/agentsmith-project/agentsmith-runner"
    return
  fi

  require_grep "github[.]com/agentsmith-project/agentsmith-runner" README.md "canonical repo identity documented"
}

check_required_files() {
  local files=(
    README.md
    AGENTS.md
    DEVELOPMENT.md
    docs/RELEASE_GATES.md
    docs/contracts/README.md
    docs/runbooks/README.md
    docs/adr/0001-bootstrap-boundary.md
    docs/READINESS_EVIDENCE.md
    docs/RISK_REGISTER.md
    .github/pull_request_template.md
    .github/workflows/ci.yml
    scripts/verify-release.sh
    scripts/check-governance-guard.sh
  )

  local file
  for file in "${files[@]}"; do
    require_file "$file"
  done
}

check_scope_and_non_goals() {
  require_grep "Runner execution process" README.md "README declares runner execution process scope"
  require_grep "Builtin skills runtime" README.md "README declares skills runtime scope"
  require_grep "Runner image" README.md "README declares runner image scope"
  require_grep "Runner contract conformance tests" README.md "README declares conformance test scope"
  require_grep "only consumes the AgentSmith runner contract" README.md "README declares contract consumer posture"

  require_grep "Agent task API" README.md "README excludes Agent task API"
  require_grep "Agent Runners API" README.md "README excludes Agent Runners API"
  require_grep "Context Store" README.md "README excludes Context Store"
  require_grep "Files or file library|Files/file library" README.md "README excludes Files/file library"
  require_grep "Managed credentials" README.md "README excludes managed credentials"
  require_grep "Audit or usage|audit/usage" README.md "README excludes audit/usage"
  require_grep "Frontend management surface|frontend management surface" README.md "README excludes frontend management surface"
}

check_quick_not_release() {
  require_file docs/RELEASE_GATES.md
  require_file scripts/verify-release.sh
  require_grep "Quick mode is not release readiness" docs/RELEASE_GATES.md "RELEASE_GATES says quick is not release readiness"
  require_grep "full release mode is intentionally not implemented|full release gate is not implemented" scripts/verify-release.sh "verify entrypoint fails full mode during bootstrap"
  require_grep "bash scripts/verify-release[.]sh --quick" .github/workflows/ci.yml "CI runs quick verification"

  if bash scripts/verify-release.sh >/dev/null 2>&1; then
    fail "full release mode must fail during bootstrap"
  else
    pass "full release mode fails during bootstrap"
  fi
}

check_local_handoff_documented() {
  require_grep "/home/percy/works/mbos-v1/agentsmith-runner" README.md "local sibling checkout path documented"
  require_grep "workspace convention" README.md "local sibling checkout is a workspace convention"
  require_grep "runtime dependency|source path dependency" README.md "local sibling checkout is not a runtime or source path dependency"
  require_grep "github[.]com/agentsmith-project/agentsmith-runner.*provenance|provenance.*github[.]com/agentsmith-project/agentsmith-runner" README.md "CI/release provenance stays canonical"
}

check_no_forbidden_patterns() {
  local files=()
  mapfile -t files < <(scan_files)

  local agentsmith_name="agent""smith"
  local fs_repo_name="${agentsmith_name}-fs-control""-plane"
  local sandbox_repo_name="mbos-sandbox""-v1"
  local sandbox_control_repo_name="${agentsmith_name}-sandbox-control""-plane"
  local legacy_repo_name="agent""smith-codex-runner"
  local agent_task_pkg="packages/agent-task""-runner"
  local agent_runner_pkg="packages/agent""-runner"
  local quote_class="[\"']"
  local mbos_scope="@m""bos/"
  local source_path_pattern
  source_path_pattern="(\\.\\./${agentsmith_name}(/|$)|\\.\\./${fs_repo_name}(/|$)|\\.\\./${sandbox_repo_name}(/|$)|/home/percy/works/mbos-v1/${agentsmith_name}(/|$)|${agent_task_pkg}|${agent_runner_pkg}|from ${quote_class}${mbos_scope}|require\\(${quote_class}${mbos_scope})"

  if grep -IEn -- "$source_path_pattern" "${files[@]}"; then
    fail "forbidden AgentSmith or sibling repo source path/import found"
  else
    pass "no AgentSmith runner runtime/source import or relative source path"
  fi

  local verify_ga="verify-ga""-release"
  local release_arg="verify-release[.]sh --rel""ease"
  local family_contract_path_a="docs/contracts/af""scp"
  local family_contract_path_b="docs/contracts/as""bcp"
  local family_manifest_a="af""scp-final-manifest"
  local family_manifest_b="as""bcp-final-manifest"
  local family_terms="(af""scp|as""bcp)"
  local dependency_terms="(source|sources|contract|contracts|gate|gates)"
  local family_dependency_pattern
  family_dependency_pattern="(${family_terms}.{0,80}${dependency_terms}|${dependency_terms}.{0,80}${family_terms})"
  local adjacent_family_pattern
  adjacent_family_pattern="(${verify_ga}|${release_arg}|${family_contract_path_a}|${family_contract_path_b}|${family_manifest_a}|${family_manifest_b}|${fs_repo_name}|${sandbox_repo_name}|${sandbox_control_repo_name}|${family_dependency_pattern})"

  if grep -IEin -- "$adjacent_family_pattern" "${files[@]}"; then
    fail "forbidden adjacent family dependency found"
  else
    pass "no adjacent family dependency"
  fi

  local forbidden_remote_repo_names="(${agentsmith_name}|${fs_repo_name}|${sandbox_repo_name}|${legacy_repo_name})"
  local forbidden_remote_repo_path="([^[:space:]\"'/:]+/)?${forbidden_remote_repo_names}"
  local remote_repo_boundary="([.]git)?([/#?[:space:]\"']|$)"
  local checkout_remote_dependency_pattern="repository:[[:space:]]*[\"']?${forbidden_remote_repo_path}${remote_repo_boundary}"
  local github_remote_dependency_pattern="(https?://github[.]com/|git@github[.]com:)${forbidden_remote_repo_path}${remote_repo_boundary}"
  local git_remote_dependency_pattern="git[[:space:]]+(clone|fetch|submodule)[^[:cntrl:]]*${github_remote_dependency_pattern}"
  local raw_remote_dependency_pattern="https?://raw[.]githubusercontent[.]com/${forbidden_remote_repo_path}/"
  local raw_contract_gate_dependency_pattern="https?://raw[.]githubusercontent[.]com/[^[:space:]\"']+/[^[:space:]\"']+/[^[:space:]\"']+/(docs/contracts/|contracts/|[^[:space:]\"']*(gate|verify-[^/[:space:]\"']*release)[^[:space:]\"']*)"
  local remote_dependency_pattern="(${checkout_remote_dependency_pattern}|${git_remote_dependency_pattern}|${raw_remote_dependency_pattern}|${raw_contract_gate_dependency_pattern})"

  if grep -IEin -- "$remote_dependency_pattern" "${files[@]}"; then
    fail "forbidden remote source, contract, or gate dependency found"
  else
    pass "no forbidden remote source, contract, or gate dependency"
  fi

  local replace_me="REPLACE""_ME"
  local changeme="CHANGE""ME"
  local change_me="CHANGE""_ME"
  local todo_marker="TODO""_SECRET"
  local dummy_marker="DUMMY""_SECRET"
  local example_marker="EXAMPLE""_SECRET"
  local private_key="PRIVATE"" KEY"
  local secret_pattern
  secret_pattern="(${replace_me}|${changeme}|${change_me}|${todo_marker}|${dummy_marker}|${example_marker}|BEGIN (RSA |OPENSSH |EC |)${private_key}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9_-]{20,}|password[=:][^[:space:]]+|token[=:][^[:space:]]+|secret[=:][^[:space:]]+)"

  if grep -IEn -- "$secret_pattern" "${files[@]}"; then
    fail "raw secret placeholder or credential-like value found"
  else
    pass "no raw secret placeholder"
  fi

  local latest_tag=":lat""est([^[:alnum:]_-]|$)"
  local mutable_release="mutable tag as rel""ease"
  local tag_image_release="tag-only image is rel""ease"
  local tag_release_proof="tag-only rel""ease proof"
  local local_tag_readiness="local image tag is rel""ease readiness"
  local mutable_tag_pattern
  mutable_tag_pattern="(${latest_tag}|${mutable_release}|${tag_image_release}|${tag_release_proof}|${local_tag_readiness})"

  if grep -IEn -- "$mutable_tag_pattern" "${files[@]}"; then
    fail "mutable/tag-only release claim found"
  else
    pass "no mutable/tag-only release claim"
  fi

  local legacy_pattern="(${legacy_repo_name}.*canonical|canonical.*${legacy_repo_name})"

  if grep -IEn -- "$legacy_pattern" "${files[@]}"; then
    fail "legacy runner repo canonical claim found"
  else
    pass "no legacy runner canonical claim"
  fi
}

check_no_ecosystem_bootstrap_files() {
  local files=()
  mapfile -t files < <(scan_files)

  local path
  local found=0
  for path in "${files[@]}"; do
    case "${path#./}" in
      package.json|*/package.json|package-lock.json|*/package-lock.json|npm-shrinkwrap.json|*/npm-shrinkwrap.json|yarn.lock|*/yarn.lock|pnpm-lock.yaml|*/pnpm-lock.yaml|bun.lock|*/bun.lock|bun.lockb|*/bun.lockb|go.mod|*/go.mod|go.sum|*/go.sum|requirements*.txt|*/requirements*.txt|uv.lock|*/uv.lock|pyproject.toml|*/pyproject.toml|poetry.lock|*/poetry.lock|Pipfile|*/Pipfile|Pipfile.lock|*/Pipfile.lock|Cargo.toml|*/Cargo.toml|Cargo.lock|*/Cargo.lock|composer.json|*/composer.json|composer.lock|*/composer.lock|Gemfile|*/Gemfile|Gemfile.lock|*/Gemfile.lock|*.lock|*/*.lock)
        echo "$path"
        found=1
        ;;
    esac
  done

  if [[ "$found" -ne 0 ]]; then
    fail "package manager or ecosystem bootstrap file found"
  else
    pass "no package manager or ecosystem bootstrap file"
  fi
}

check_remote
check_required_files
check_scope_and_non_goals
check_quick_not_release
check_local_handoff_documented
check_no_forbidden_patterns
check_no_ecosystem_bootstrap_files

if [[ "$failures" -ne 0 ]]; then
  echo "governance guard failed with $failures issue(s)" >&2
  exit 1
fi

echo "governance guard passed"
