# general-agent-eval

Harnesses for evaluating general coding agents against isolated repositories.

## Layout

- `src/general_agent_eval/general_agents/`: Docker launcher and agent adapters.
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

Runs are written under `runs/<timestamp>__<agent>__<project>` by default. Pass
`--output-dir` to choose a different parent directory. After completion,
`manifest.json` includes a compact `agent_result` summary with cost, duration,
and turn count when the selected agent reports those fields.

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
