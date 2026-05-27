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

forbid_grep() {
  local pattern="$1"
  local path="$2"
  local label="$3"
  if grep -Eqi "$pattern" "$path"; then
    fail "$label"
  else
    pass "$label"
  fi
}

scan_files() {
  find . \
    -path ./.git -prune -o \
    -path ./node_modules -prune -o \
    -path ./dist -prune -o \
    -path ./coverage -prune -o \
    -type f \
    -print
}

check_remote() {
  local origin
  local normalized
  origin="$(git remote get-url origin 2>/dev/null || true)"

  case "$origin" in
    "")
      fail "origin remote is missing"
      return
      ;;
    http://*)
      fail "origin must use https:// or git@github.com:, not http://"
      return
      ;;
    https://github.com/*)
      normalized="${origin#https://}"
      ;;
    git@github.com:*)
      normalized="${origin#git@}"
      normalized="${normalized/:/\/}"
      ;;
    *)
      fail "origin must use https://github.com/ or git@github.com: form"
      return
      ;;
  esac
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
    OWNERS.md
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
    .github/workflows/runner-image-publish.yml
    Dockerfile
    .dockerignore
    package.json
    tsconfig.json
    vitest.config.ts
    src/index.ts
    builtin-skills/README.md
    scripts/verify-release.sh
    scripts/check-governance-guard.sh
    scripts/check-start-guard-clean-deps.mjs
    scripts/check-runner-source-boundary.mjs
    scripts/test-runner-runtime-fast.sh
    scripts/test-runner-image-smoke.sh
    scripts/test-runner-runtime-image-prereq-smoke.sh
    scripts/check-runner-release-manifest.mjs
    scripts/write-runner-release-manifest.mjs
    scripts/test-runner-release-manifest.sh
  )

  local file
  for file in "${files[@]}"; do
    require_file "$file"
  done
}

check_owner_team_metadata() {
  require_file OWNERS.md
  require_grep "Owning team" OWNERS.md "OWNERS declares owning team"
  require_grep "AgentSmith Runner Maintainers" OWNERS.md "OWNERS names runner maintainers"
  require_grep "not a CODEOWNERS system" OWNERS.md "OWNERS avoids CODEOWNERS governance"
  require_grep "OWNERS[.]md" README.md "README points to owner metadata"
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

check_runner_specific_fail_fast_guard() {
  require_grep "must not define Context Store scopes" README.md "README blocks Context Store scope definitions"
  require_grep "Files/file-library behavior" README.md "README blocks Files/file-library behavior definitions"
  require_grep "managed credential resolution" README.md "README blocks managed credential resolution"
  require_grep "execution ticket issuance" README.md "README blocks execution ticket issuance"
  require_grep "permission semantics" README.md "README blocks permission semantics"
  forbid_grep "published AgentSmith runner contract package and fixtures" README.md "README avoids package-is-already-published wording"
  forbid_grep "published AgentSmith runner contract package and fixtures" AGENTS.md "AGENTS avoids package-is-already-published wording"
  require_grep "formal AgentSmith runner contract artifact package" README.md "README requires formal contract artifact package consumption"
  require_grep "after publication.*registry/package dependency|registry/package dependency.*after publication" README.md "README documents post-publication registry/package consumption"
  require_grep "pre-GA.*explicit.*artifact package|explicit.*artifact package.*pre-GA" README.md "README documents pre-GA explicit artifact package acquisition"
  require_grep "ordinary npm install.*not|not.*ordinary npm install" README.md "README says pre-GA acquisition is not ordinary npm install"
  require_grep "sibling source.*not|not.*sibling source" README.md "README rejects sibling source acquisition"
  require_grep "formal AgentSmith runner contract artifact package" AGENTS.md "AGENTS requires formal contract artifact package consumption"
  require_grep "after publication.*registry/package dependency|registry/package dependency.*after publication" AGENTS.md "AGENTS documents post-publication registry/package consumption"
  require_grep "pre-GA.*explicit.*artifact package|explicit.*artifact package.*pre-GA" AGENTS.md "AGENTS documents pre-GA explicit artifact package acquisition"
  require_grep "projection consumption and local execution" README.md "README limits builtin skills runtime"
  require_grep "must not add permission or credential resolution semantics" AGENTS.md "AGENTS blocks runtime permission or resolution semantics"
  require_grep "@mbos/agent-runner-contract" docs/contracts/README.md "contracts docs name the runner contract artifact package consumer"
  require_grep "formal AgentSmith runner contract artifact package" docs/contracts/README.md "contracts docs require formal contract artifact package"
  require_grep "pre-GA.*explicit.*artifact package|explicit.*artifact package.*pre-GA" docs/contracts/README.md "contracts docs document pre-GA explicit artifact package acquisition"
  require_grep "ordinary npm install.*not|not.*ordinary npm install" docs/contracts/README.md "contracts docs say pre-GA acquisition is not ordinary npm install"
  require_grep "fixtures.*provenance|provenance.*fixtures" docs/contracts/README.md "contracts docs require fixtures and provenance"
}

check_contract_consumer_source_boundary() {
  local files=()
  mapfile -t files < <(scan_files)

  local mbos_scope="@m""bos/"
  local allowed_contract_pkg="${mbos_scope}agent-runner-contract"
  local mbos_package_pattern="${mbos_scope}[A-Za-z0-9._-]+"
  local forbidden_mbos_hits
  forbidden_mbos_hits="$(grep -IEno -- "$mbos_package_pattern" "${files[@]}" | grep -Ev ":${allowed_contract_pkg}$" || true)"

  if [[ -n "$forbidden_mbos_hits" ]]; then
    echo "$forbidden_mbos_hits"
    fail "forbidden @mbos package reference found"
  else
    pass "only formal runner contract package is allowed under @mbos"
  fi

  local local_protocol="(file|link|portal|workspace):"
  local local_contract_pattern
  local_contract_pattern="(${allowed_contract_pkg}[^[:cntrl:]]*${local_protocol}|${local_protocol}[^[:cntrl:]]*${allowed_contract_pkg})"

  if grep -IEn -- "$local_contract_pattern" "${files[@]}"; then
    fail "contract package must not be consumed through local dependency protocols"
  else
    pass "contract package is not consumed through local dependency protocols"
  fi

  local agentsmith_name="agent""smith"
  local retired_repo_name="agent""smith-codex-runner"
  local agent_task_pkg="packages/agent-task""-runner"
  local agent_runner_pkg="packages/agent""-runner"
  local source_boundary_pattern
  source_boundary_pattern="(\\.\\./${agentsmith_name}(/|$)|/home/percy/works/mbos-v1/${agentsmith_name}(/|$)|${agent_task_pkg}|${agent_runner_pkg}|${retired_repo_name})"

  if grep -IEn -- "$source_boundary_pattern" "${files[@]}"; then
    fail "forbidden runner contract/source boundary reference found"
  else
    pass "no forbidden AgentSmith sibling source or retired runner reference"
  fi
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

check_start_guard_not_release() {
  require_grep "bash scripts/verify-release[.]sh --start-guard" README.md "README documents start guard command"
  require_grep "Start guard is not release readiness" README.md "README says start guard is not release readiness"
  require_grep "bash scripts/verify-release[.]sh --start-guard" DEVELOPMENT.md "DEVELOPMENT documents start guard command"
  require_grep "Start guard is not release readiness" DEVELOPMENT.md "DEVELOPMENT says start guard is not release readiness"
  require_grep "bash scripts/verify-release[.]sh --start-guard" docs/RELEASE_GATES.md "RELEASE_GATES documents start guard command"
  require_grep "Start guard is not release readiness" docs/RELEASE_GATES.md "RELEASE_GATES says start guard is not release readiness"
  require_grep "bash scripts/verify-release[.]sh --start-guard" docs/contracts/README.md "contracts docs document start guard command"
  require_grep "Start guard is not release readiness" docs/contracts/README.md "contracts docs say start guard is not release readiness"
  require_grep "bash scripts/verify-release[.]sh --start-guard" docs/runbooks/README.md "runbooks document start guard command"
  require_grep "Start guard is not release readiness" docs/runbooks/README.md "runbooks say start guard is not release readiness"
  require_grep "bash scripts/verify-release[.]sh --start-guard" docs/READINESS_EVIDENCE.md "readiness evidence documents start guard command"
  require_grep "Start guard is not release readiness" docs/READINESS_EVIDENCE.md "readiness evidence says start guard is not release readiness"
  require_grep "bash scripts/verify-release[.]sh --start-guard" .github/pull_request_template.md "PR template asks for start guard evidence"
  require_grep "not release readiness" .github/pull_request_template.md "PR template keeps start guard separate from release readiness"
  require_grep "contract-consumer-start-guard" .github/workflows/ci.yml "CI has contract consumer start guard job"
  require_grep "node-version:[[:space:]]*['\"]?24['\"]?" .github/workflows/ci.yml "CI start guard sets up Node 24"
  require_grep "bash scripts/verify-release[.]sh --start-guard" .github/workflows/ci.yml "CI runs start guard verification"
  require_grep "verify-release[.]sh --start-guard" scripts/verify-release.sh "verify entrypoint supports start guard"
  require_grep "check-start-guard-clean-deps[.]mjs" scripts/verify-release.sh "start guard checks clean dependency shape"
  require_grep "Runtime fast checks are separate" scripts/verify-release.sh "start guard keeps runtime fast separate"
  require_grep "check-runner-source-boundary[.]mjs" scripts/verify-release.sh "start guard checks source boundary syntax"
  require_grep "test-runner-runtime-image-prereq-smoke[.]sh" scripts/verify-release.sh "start guard checks runtime image prereq smoke syntax"
  require_grep "test-runner-release-manifest[.]sh" scripts/verify-release.sh "start guard runs release manifest self-test"
  require_grep "check-runner-release-manifest[.]mjs" scripts/verify-release.sh "start guard checks release manifest syntax"
  require_grep "write-runner-release-manifest[.]mjs" scripts/verify-release.sh "start guard checks release manifest generator syntax"
}

check_release_manifest_skeleton_not_release() {
  require_grep "bash scripts/verify-release[.]sh --release-manifest --manifest <manifest-path>" README.md "README documents release manifest skeleton command"
  require_grep "Release manifest skeleton mode is not release readiness|This skeleton is not.*release readiness" README.md "README says manifest skeleton is not release readiness"
  require_grep "not an image build|does not build a runner image" README.md "README says manifest skeleton is not image evidence"
  require_grep "not AgentSmith adoption|does not.*AgentSmith adoption" README.md "README says manifest skeleton is not AgentSmith adoption"

  require_grep "bash scripts/verify-release[.]sh --release-manifest --manifest <manifest-path>" DEVELOPMENT.md "DEVELOPMENT documents release manifest skeleton command"
  require_grep "Release manifest skeleton mode is not release readiness" DEVELOPMENT.md "DEVELOPMENT says manifest skeleton is not release readiness"
  require_grep "not an image build" DEVELOPMENT.md "DEVELOPMENT says manifest skeleton is not an image build"

  require_grep "bash scripts/verify-release[.]sh --release-manifest --manifest <manifest-path>" docs/RELEASE_GATES.md "RELEASE_GATES documents release manifest skeleton command"
  require_grep "Release manifest skeleton mode is not release readiness" docs/RELEASE_GATES.md "RELEASE_GATES says manifest skeleton is not release readiness"
  require_grep "does not build a runner image" docs/RELEASE_GATES.md "RELEASE_GATES says manifest skeleton is not image build evidence"
  require_grep "AgentSmith lock" docs/RELEASE_GATES.md "RELEASE_GATES keeps manifest skeleton separate from AgentSmith lock update"

  require_grep "bash scripts/verify-release[.]sh --release-manifest --manifest <manifest-path>" docs/READINESS_EVIDENCE.md "readiness evidence documents release manifest skeleton command"
  require_grep "not release readiness" docs/READINESS_EVIDENCE.md "readiness evidence says manifest skeleton is not release readiness"
  require_grep "scripts/test-runner-release-manifest[.]sh" docs/READINESS_EVIDENCE.md "readiness evidence documents release manifest self-test"

  require_grep "bash scripts/verify-release[.]sh --release-manifest --manifest <manifest-path>" docs/contracts/README.md "contracts docs document release manifest skeleton command"
  require_grep "not a contract source of truth" docs/contracts/README.md "contracts docs keep manifest skeleton out of contract authority"
  require_grep "not release readiness" docs/contracts/README.md "contracts docs say manifest skeleton is not release readiness"

  require_grep "bash scripts/verify-release[.]sh --release-manifest --manifest <manifest-path>" docs/runbooks/README.md "runbooks document release manifest skeleton command"
  require_grep "not release readiness" docs/runbooks/README.md "runbooks say manifest skeleton is not release readiness"
  require_grep "P5.3a release manifest skeleton" docs/RISK_REGISTER.md "risk register tracks manifest skeleton misuse"
  require_grep "release manifest skeleton" .github/pull_request_template.md "PR template separates manifest skeleton evidence"
  require_grep "Release manifest skeleton mode is not release readiness" scripts/verify-release.sh "verify entrypoint says manifest mode is not release readiness"
}

check_image_smoke_not_release() {
  require_grep "bash scripts/verify-release[.]sh --image-smoke --artifact-root <dir>" README.md "README documents image smoke command"
  require_grep "Image smoke is not release readiness" README.md "README says image smoke is not release readiness"
  require_grep "no GHCR publish|does not publish" README.md "README keeps image smoke out of GHCR publish"
  require_grep "no release manifest|does not generate.*release manifest" README.md "README keeps image smoke out of release manifest generation"
  require_grep "no AgentSmith adoption|does not.*AgentSmith adoption" README.md "README keeps image smoke out of AgentSmith adoption"

  require_grep "bash scripts/verify-release[.]sh --image-smoke --artifact-root <dir>" DEVELOPMENT.md "DEVELOPMENT documents image smoke command"
  require_grep "Image smoke is not release readiness" DEVELOPMENT.md "DEVELOPMENT says image smoke is not release readiness"
  require_grep "explicit.*artifact root|artifact root.*explicit" DEVELOPMENT.md "DEVELOPMENT requires explicit artifact root for image smoke"

  require_grep "bash scripts/verify-release[.]sh --image-smoke --artifact-root <artifact-root>" docs/RELEASE_GATES.md "RELEASE_GATES documents image smoke command"
  require_grep "Image smoke is not release readiness" docs/RELEASE_GATES.md "RELEASE_GATES says image smoke is not release readiness"
  require_grep "no-push|does not publish" docs/RELEASE_GATES.md "RELEASE_GATES keeps image smoke no-push"

  require_grep "bash scripts/verify-release[.]sh --image-smoke --artifact-root <artifact-root>" docs/READINESS_EVIDENCE.md "readiness evidence documents image smoke command"
  require_grep "Image smoke is not release readiness" docs/READINESS_EVIDENCE.md "readiness evidence says image smoke is not release readiness"
  require_grep "not release readiness" docs/READINESS_EVIDENCE.md "readiness evidence keeps focused image smoke separate from release readiness"

  require_grep "bash scripts/verify-release[.]sh --image-smoke --artifact-root <artifact-root>" docs/runbooks/README.md "runbooks document image smoke command"
  require_grep "Image smoke is not release readiness" docs/runbooks/README.md "runbooks say image smoke is not release readiness"
  require_grep "does not publish|no GHCR publish" docs/runbooks/README.md "runbooks keep image smoke out of publish"

  require_grep "bash scripts/verify-release[.]sh --image-smoke --artifact-root <dir>" scripts/verify-release.sh "verify entrypoint supports image smoke"
  require_grep "Image smoke is not release readiness" scripts/verify-release.sh "verify entrypoint says image smoke is not release readiness"
  require_grep "test-runner-image-smoke[.]sh" scripts/verify-release.sh "verify entrypoint delegates image smoke to focused script"
  require_grep "test-runner-runtime-image-prereq-smoke[.]sh" scripts/test-runner-image-smoke.sh "image smoke runs runtime image prerequisite smoke"
  require_grep 'ENTRYPOINT[[:space:]]+\["node",[[:space:]]*"/app/dist/index[.]js"\]' Dockerfile "Dockerfile uses absolute runner entrypoint"
  require_grep 'run_missing_env_usage_check .*--workdir[[:space:]]+/tmp' scripts/test-runner-image-smoke.sh "image smoke covers non-app working directory startup"
  require_grep "runner-image-smoke" .github/workflows/ci.yml "CI has focused image smoke job"
  require_grep "repository:[[:space:]]*agentsmith-project/agentsmith" .github/workflows/ci.yml "CI explicitly checks out AgentSmith as artifact producer"
  require_grep "npm run build -w @mbos/agent-runner-contract" .github/workflows/ci.yml "CI builds runner contract artifact package"
  require_grep "npx tsx scripts/governance/runner-contract-artifact[.]ts" .github/workflows/ci.yml "CI generates explicit runner contract artifact root"
  require_grep "bash scripts/verify-release[.]sh --image-smoke --artifact-root" .github/workflows/ci.yml "CI runs focused image smoke with artifact root"
}

check_runner_image_publish_focused_evidence() {
  local workflow=".github/workflows/runner-image-publish.yml"

  require_file "$workflow"
  require_grep "workflow_dispatch:" "$workflow" "runner image publish is manual workflow_dispatch"
  forbid_grep "^[[:space:]]*(push|pull_request|schedule):" "$workflow" "runner image publish has no automatic triggers"
  require_grep "agentsmith_contract_run_id" "$workflow" "runner image publish requires AgentSmith contract run id input"
  require_grep "release_id" "$workflow" "runner image publish accepts optional release id input"
  require_grep "contents:[[:space:]]*read" "$workflow" "runner image publish has contents read permission"
  require_grep "packages:[[:space:]]*write" "$workflow" "runner image publish has packages write permission"
  require_grep "actions:[[:space:]]*read" "$workflow" "runner image publish has actions read permission"

  require_grep "actions/download-artifact@v8[.]0[.]1" "$workflow" "runner image publish downloads artifact with pinned v8.0.1"
  require_grep "name:[[:space:]]*agentsmith-runner-contract-artifact" "$workflow" "runner image publish downloads formal AgentSmith artifact name"
  require_grep "repository:[[:space:]]*agentsmith-project/agentsmith" "$workflow" "runner image publish downloads from AgentSmith repo"
  require_grep "run-id:.*agentsmith_contract_run_id" "$workflow" "runner image publish uses supplied AgentSmith run id"
  require_grep "path:[[:space:]]*artifacts/runner-contract" "$workflow" "runner image publish downloads to runner contract artifact root"

  require_grep "verify-release[.]sh --contract-consumer --artifact-root artifacts/runner-contract" "$workflow" "runner image publish verifies contract consumer"
  require_grep "verify-release[.]sh --image-smoke --artifact-root artifacts/runner-contract" "$workflow" "runner image publish runs no-push image smoke before publish"
  require_grep "ghcr[.]io/agentsmith-project/agentsmith-runner" "$workflow" "runner image publish uses canonical GHCR repo"
  local old_agent_task_runner="agent-task""-runner"
  local old_codex_runner="agentsmith-codex""-runner"
  local latest_tag=":lat""est([^A-Za-z0-9_-]|$)"
  forbid_grep "ghcr[.]io/agentsmith-project/(${old_agent_task_runner}|${old_codex_runner})" "$workflow" "runner image publish avoids old GHCR aliases"
  forbid_grep "$latest_tag" "$workflow" "runner image publish does not create latest tag"
  require_grep "release-[\$][{]release_id[}]" "$workflow" "runner image publish creates release-id tag"
  require_grep "sha-[\$][{]GITHUB_SHA::12[}]" "$workflow" "runner image publish creates short sha tag"
  require_grep "docker/setup-buildx-action@v4[.]1[.]0" "$workflow" "runner image publish uses Node 24 Docker Buildx action"
  require_grep "docker/login-action@v4[.]2[.]0" "$workflow" "runner image publish uses Node 24 GHCR login action"
  forbid_grep "docker/(setup-buildx-action|login-action)@v3" "$workflow" "runner image publish does not use Node 20 Docker actions"
  require_grep "docker buildx build" "$workflow" "runner image publish builds image with buildx"
  require_grep "[[:space:]]--push" "$workflow" "runner image publish pushes image"
  require_grep "[[:space:]]--provenance=false" "$workflow" "runner image publish disables build provenance attestation"
  require_grep "[[:space:]]--sbom=false" "$workflow" "runner image publish disables build SBOM"
  require_grep "imagetools inspect" "$workflow" "runner image publish inspects pushed image"
  require_grep "Manifest[.]Digest" "$workflow" "runner image publish reads manifest digest"
  require_grep "sha256:\\[a-f0-9\\][{]64[}]" "$workflow" "runner image publish validates sha256 digest"

  require_grep "write-runner-release-manifest[.]mjs" "$workflow" "runner image publish generates release manifest"
  require_grep "verify-release[.]sh --release-manifest --manifest artifacts/runner-release/runner-release-manifest[.]json" "$workflow" "runner image publish verifies release manifest"
  require_grep "actions/upload-artifact@v7[.]0[.]1" "$workflow" "runner image publish uploads manifest artifact with pinned v7.0.1"
  require_grep "name:[[:space:]]*runner-release-manifest" "$workflow" "runner image publish artifact name is runner-release-manifest"
  require_grep "Focused publish evidence only" "$workflow" "runner image publish labels evidence as focused"
  require_grep "not release readiness" "$workflow" "runner image publish says it is not release readiness"
  require_grep "not AgentSmith adoption" "$workflow" "runner image publish says it is not AgentSmith adoption"
  require_grep "not an AgentSmith lock update" "$workflow" "runner image publish says it is not an AgentSmith lock update"

  require_grep "runner-image-publish[.]yml" README.md "README documents runner image publish workflow"
  require_grep "digest-pinned GHCR image plus manifest artifact" README.md "README describes publish evidence output"
  require_grep "does not create.*latest.*tag" README.md "README says publish workflow avoids latest"
  require_grep "does not.*AgentSmith adoption lock|not an AgentSmith lock update" README.md "README says publish workflow does not update AgentSmith lock"
  require_grep "runner-image-publish[.]yml" docs/RELEASE_GATES.md "RELEASE_GATES documents runner image publish workflow"
  require_grep "focused publish evidence only" docs/RELEASE_GATES.md "RELEASE_GATES keeps publish evidence focused"
  require_grep "not release readiness" docs/RELEASE_GATES.md "RELEASE_GATES says publish evidence is not release readiness"
  require_grep "runner-image-publish[.]yml" docs/READINESS_EVIDENCE.md "readiness evidence documents publish workflow"
  require_grep "not release readiness" docs/READINESS_EVIDENCE.md "readiness evidence says publish is not release readiness"
  require_grep "runner-image-publish[.]yml" docs/runbooks/README.md "runbooks document publish workflow"
  require_grep "not.*release contract runner digest" docs/runbooks/README.md "runbooks say publish does not change release contract runner digest"
  require_grep "write-runner-release-manifest[.]mjs" docs/contracts/README.md "contracts docs document release manifest generator"
  require_grep "manual focused GHCR publish evidence.*runner release manifest artifact" docs/adr/0001-bootstrap-boundary.md "ADR documents focused publish evidence allowance"
  require_grep "release contract runner digest changes" docs/adr/0001-bootstrap-boundary.md "ADR keeps publish evidence out of release contract runner digest changes"
  forbid_grep "still does not allow image publish, release manifest generation" docs/adr/0001-bootstrap-boundary.md "ADR does not regress to old publish prohibition wording"
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
  local retired_repo_name="agent""smith-codex-runner"
  local agent_task_pkg="packages/agent-task""-runner"
  local agent_runner_pkg="packages/agent""-runner"
  local source_path_pattern
  source_path_pattern="(\\.\\./${agentsmith_name}(/|$)|\\.\\./${fs_repo_name}(/|$)|\\.\\./${sandbox_repo_name}(/|$)|/home/percy/works/mbos-v1/${agentsmith_name}(/|$)|${agent_task_pkg}|${agent_runner_pkg})"

  if grep -IEn -- "$source_path_pattern" "${files[@]}"; then
    fail "forbidden AgentSmith or sibling repo source path/import found"
  else
    pass "no AgentSmith runner runtime/source import or relative source path"
  fi

  local verify_ga="verify-ga""-release[.]sh"
  local verify_afscp="verify-af""scp-release[.]sh"
  local verify_asbcp="verify-as""bcp-release[.]sh"
  local gate_afscp="gate-af""scp-release[.]sh"
  local gate_asbcp="gate-as""bcp-release[.]sh"
  local family_contract_path_a="docs/contracts/af""scp"
  local family_contract_path_b="docs/contracts/as""bcp"
  local family_contract_path_c="contracts/af""scp"
  local family_contract_path_d="contracts/as""bcp"
  local family_manifest_a="af""scp-final-manifest"
  local family_manifest_b="as""bcp-final-manifest"
  local family_path_pattern
  local family_contract_path_pattern
  local family_gate_file_pattern
  local family_manifest_pattern
  local adjacent_family_pattern
  family_path_pattern="(^|[^[:alnum:]_])\\.\\./(${fs_repo_name}|${sandbox_repo_name}|${sandbox_control_repo_name})(/|$)|/home/percy/works/mbos-v1/(${fs_repo_name}|${sandbox_repo_name}|${sandbox_control_repo_name})(/|$)|${fs_repo_name}/(src|cmd|internal|pkg|deploy|migrations|scripts|docs)(/|$)|${sandbox_repo_name}/(manager-service|k8s|scripts|docs)(/|$)"
  family_contract_path_pattern="(^|/)(${family_contract_path_a}|${family_contract_path_b}|${family_contract_path_c}|${family_contract_path_d})(/|[.][^/[:space:]\"']*|$)"
  family_gate_file_pattern="(^|/)(${verify_ga}|${verify_afscp}|${verify_asbcp}|${gate_afscp}|${gate_asbcp})([[:space:]\"']|$)"
  family_manifest_pattern="(^|/)(${family_manifest_a}|${family_manifest_b})([.][^/[:space:]\"']+)?([[:space:]\"']|$)"
  adjacent_family_pattern="(${family_path_pattern}|${family_contract_path_pattern}|${family_gate_file_pattern}|${family_manifest_pattern})"

  if grep -IEin -- "$adjacent_family_pattern" "${files[@]}"; then
    fail "forbidden adjacent family dependency found"
  else
    pass "no adjacent family path, gate, or manifest dependency"
  fi

  local forbidden_remote_repo_names="(${agentsmith_name}|${fs_repo_name}|${sandbox_repo_name}|${retired_repo_name})"
  local forbidden_remote_repo_path="([^[:space:]\"'/:]+/)?${forbidden_remote_repo_names}"
  local remote_repo_boundary="([.]git)?([/#?[:space:]\"']|$)"
  local checkout_remote_dependency_pattern="repository:[[:space:]]*[\"']?${forbidden_remote_repo_path}${remote_repo_boundary}"
  local github_remote_dependency_pattern="(https?://github[.]com/|git@github[.]com:)${forbidden_remote_repo_path}${remote_repo_boundary}"
  local git_remote_dependency_pattern="git[[:space:]]+(clone|fetch|submodule)[^[:cntrl:]]*${github_remote_dependency_pattern}"
  local raw_remote_dependency_pattern="https?://raw[.]githubusercontent[.]com/${forbidden_remote_repo_path}/"
  local raw_contract_gate_dependency_pattern="https?://raw[.]githubusercontent[.]com/[^[:space:]\"']+/[^[:space:]\"']+/[^[:space:]\"']+/(docs/contracts/|contracts/|[^[:space:]\"']*(gate|verify-[^/[:space:]\"']*release)[^[:space:]\"']*)"
  local remote_dependency_pattern="(${checkout_remote_dependency_pattern}|${git_remote_dependency_pattern}|${raw_remote_dependency_pattern}|${raw_contract_gate_dependency_pattern})"

  local remote_dependency_hits
  remote_dependency_hits="$(grep -IEin -- "$remote_dependency_pattern" "${files[@]}" | grep -Ev '^\./\.github/workflows/(ci|runner-image-publish)[.]yml:[0-9]+:[[:space:]]*repository:[[:space:]]*agentsmith-project/agentsmith[[:space:]]*$' || true)"

  if [[ -n "$remote_dependency_hits" ]]; then
    echo "$remote_dependency_hits"
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

  local retired_runner_canonical_pattern="(${retired_repo_name}.*canonical|canonical.*${retired_repo_name})"

  if grep -IEn -- "$retired_runner_canonical_pattern" "${files[@]}"; then
    fail "retired runner repo canonical claim found"
  else
    pass "no retired runner canonical claim"
  fi
}

check_no_ecosystem_bootstrap_files() {
  local files=()
  mapfile -t files < <(scan_files)

  local path
  local found=0
  for path in "${files[@]}"; do
    case "${path#./}" in
      package.json|tsconfig.json|vitest.config.ts)
        ;;
      */package.json|package-lock.json|*/package-lock.json|npm-shrinkwrap.json|*/npm-shrinkwrap.json|yarn.lock|*/yarn.lock|pnpm-lock.yaml|*/pnpm-lock.yaml|bun.lock|*/bun.lock|bun.lockb|*/bun.lockb|go.mod|*/go.mod|go.sum|*/go.sum|requirements*.txt|*/requirements*.txt|uv.lock|*/uv.lock|pyproject.toml|*/pyproject.toml|poetry.lock|*/poetry.lock|Pipfile|*/Pipfile|Pipfile.lock|*/Pipfile.lock|Cargo.toml|*/Cargo.toml|Cargo.lock|*/Cargo.lock|composer.json|*/composer.json|composer.lock|*/composer.lock|Gemfile|*/Gemfile|Gemfile.lock|*/Gemfile.lock|*.lock|*/*.lock)
        echo "$path"
        found=1
        ;;
    esac
  done

  if [[ "$found" -ne 0 ]]; then
    fail "generated lockfile or nested package manager file found"
  else
    pass "no generated lockfile or nested package manager file"
  fi
}

check_remote
check_required_files
check_owner_team_metadata
check_scope_and_non_goals
check_runner_specific_fail_fast_guard
check_contract_consumer_source_boundary
check_quick_not_release
check_start_guard_not_release
check_release_manifest_skeleton_not_release
check_image_smoke_not_release
check_runner_image_publish_focused_evidence
check_local_handoff_documented
check_no_forbidden_patterns
check_no_ecosystem_bootstrap_files

if [[ "$failures" -ne 0 ]]; then
  echo "governance guard failed with $failures issue(s)" >&2
  exit 1
fi

echo "governance guard passed"
