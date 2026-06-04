# general-agent-eval

Harnesses for evaluating general coding agents against isolated repositories.

## Layout

- `src/general_agent_eval/general_agents/`: agent adapters (claude-code, codex).
- `src/general_agent_eval/orchestration/`: Docker run orchestrator — staging,
  preprocessing pipeline, image build/run, and run manifests.
- `src/general_agent_eval/preprocessing/`: input preprocessing utilities.
- `src/general_agent_eval/recovery/`: rebuild agent outputs into the full repo.
- `src/general_agent_eval/prompts/`: packaged Jinja prompt templates.
- `runs/`: default parent directory for generated run outputs.

## Environment

This project uses `uv` with a Hatchling build backend.

```bash
uv sync
uv run pytest
```

## Claude Code Runner

Run Claude Code directly against an input directory:

```bash
uv run general-agent-eval-claude-code \
  --input-dir /path/to/project \
  --model sonnet
```

The runner denies `WebSearch` and `WebFetch`, sets the input directory as the
agent working directory, defaults Claude Code to `bypassPermissions`, and
renders the packaged prompt templates from `src/general_agent_eval/prompts/`.

When `--base-url` is set (a custom/non-Anthropic gateway), the runner defaults
`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` so Claude Code stops sending
`anthropic-beta` headers the gateway would reject. Pass
`--env CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=0` to re-enable them for a
beta-capable endpoint.

## OpenAI Codex Runner

Run OpenAI Codex directly against an input directory:

```bash
uv run general-agent-eval-codex \
  --input-dir /path/to/project \
  --model gpt-5-codex \
  --api-key-env OPENAI_API_KEY
```

The runner wraps the official `openai-codex` Python SDK (its native binary ships
bundled with the dependency, so no separate install is needed) and renders the
same packaged prompt templates as the Claude Code runner. `--model` is required;
there is no default.

`--system-prompt-config` maps the rendered system template onto Codex:
`replace` (default) uses it as `base_instructions` (a full replacement of Codex's
built-in prompt), `append` adds it as `developer_instructions`, and `none` uses
neither. `--sandbox` controls Codex's filesystem/network access. The standalone
runner defaults to `workspace_write` because direct runs execute on the host; raise
it to `full_access` or lower it to `read_only` as needed. (Under
`general-agent-eval-docker-run` it instead defaults to `full_access`, since the
container — `cap-drop ALL`, `no-new-privileges` — is the real security boundary.)
Pass `--base-url` to point Codex at a custom OpenAI-compatible gateway
(authenticated via `OPENAI_API_KEY`).

Codex reports token usage and duration but **no dollar cost**, so the result
record and `manifest.json` carry `total_cost_usd: null` plus a `usage` token
breakdown — consult the provider's billing dashboard for actual spend.

## Docker Runner

Run an agent inside the shared Docker runtime against a disposable staged copy:

```bash
uv run general-agent-eval-docker-run \
  --agent claude-code \
  --input-dir /path/to/project \
  --reset-git \
  --clear-tests \
  --model sonnet \
  --api-key-env ANTHROPIC_API_KEY
```

Pass `--agent codex` to run OpenAI Codex instead. `--model` is required for it,
and `--sandbox` (default `full_access`) selects the Codex sandbox mode:

```bash
uv run general-agent-eval-docker-run \
  --agent codex \
  --input-dir /path/to/project \
  --reset-git \
  --clear-tests \
  --model gpt-5-codex \
  --api-key-env OPENAI_API_KEY
```

Options that apply to a single agent are rejected (rather than silently dropped)
when passed for the other agent: `--permission-mode`, `--auth-token-env`,
`--oauth-token-env`, `--max-budget-usd`, and `--extra-arg` are claude-code only,
while `--sandbox` is codex only. Shared options (`--model`,
`--system-prompt-config`, `--system-template`, `--chat-template`,
`--prompt-var`, `--base-url`, `--api-key-env`, `--env`) work for both.

### Custom prompts

The Docker runner forwards the same prompt controls as the standalone runners.
`--system-template` and `--chat-template` take host paths to Jinja2 templates;
each template's directory is bind-mounted read-only into the container, so
`{% include %}` of sibling templates keeps resolving. `--prompt-var KEY=VALUE`
(repeatable) injects extra template variables. Without these flags the packaged
Java test-generation prompts are used, as before. Keys reserved by the template
context (`input_dir`, `model`, ...) are rejected up front, as are keys the
orchestrator derives from `--service` (`service_base_url`, ...), since
overriding those would desync the prompt from the live service.

Runs are written under `runs/<timestamp>__<agent>__<project>` by default. Pass
`--output-dir` to choose a different parent directory. After completion,
`manifest.json` includes a compact `agent_result` summary with cost, duration,
and turn count when the selected agent reports those fields (the codex agent
reports duration and token `usage` but a null `total_cost_usd`).

To run against a live service, pass the service manifest and scripts directory
explicitly:

```bash
uv run general-agent-eval-docker-run \
  --input-dir /path/to/service-repo \
  --service genome-nexus \
  --service-manifest /path/to/resources/scripts/services.json \
  --service-scripts-dir /path/to/resources/scripts \
  --clear-tests \
  --model sonnet \
  --api-key-env ANTHROPIC_API_KEY
```

`--service-scripts-dir` must contain `run-with-service.sh`. If
`--service-manifest` is omitted, the runner uses
`--service-scripts-dir/services.json`.

### Injecting RestAssured

Add `--inject-rest-assured` (requires `--service`) to provision RestAssured as a
test dependency before the agent runs, so generated HTTP tests can use it without
the agent wiring up the build itself. The per-service coordinates, target POM
(the module whose tests run), and version live in the service manifest's optional
`rest_assured` block; omit the block to skip injection. The version is `null` for
Spring Boot services (inherited from the Boot dependency-management BOM) and an
explicit string otherwise. The POM edit runs after `--clear-tests` and lands in
the testless baseline, so it stays out of the agent's `git_diff.patch`; the change
is captured separately as `output/dependency_injection.patch`, which the recoverer
replays onto the cloned original repo before the agent patch.

With the flag set, the chat prompt also tells the agent to use RestAssured, and for
a multi-module target it names the module to put the tests in (derived from the
`rest_assured.target_pom` directory). Single-module projects see no module note.

## Recovering Agent Outputs

A run's `input/` directory is the agent's live working directory and is
*testless* (tests are cleared before the agent runs). The pre-agent state is
preserved only as the synthetic baseline commit, and `output/git_diff.patch`
captures the agent's changes against it. To evaluate the agent's generated tests
inside the complete project, re-base that patch onto the original repository:

```bash
uv run general-agent-eval-recover \
  --run-dir runs/<timestamp>__claude-code__<project> \
  --repo-url https://github.com/owner/project.git
```

The recoverer clones `--repo-url`, checks out the commit recorded in
`manifest.json` (the `--reset-git` pinned commit, otherwise the cleared-tests
baseline's `original_head`; override with `--commit`), and applies
`git_diff.patch` onto that full tree. The agent's patch is taken against the
testless baseline, so the only conflicts are paths the agent recreated that were
cleared from the original; the agent's version wins those collisions. Results
land in `<run-dir>/recovered/<project>/` (override the parent with
`--output-dir`) alongside a `recovery_manifest.json` that records the commit,
collisions resolved, any non-test/production-code paths the patch touched, and
caveats (e.g. runs without `--reset-git` whose baseline may diverge from a clean
clone).
