# Claude Code Playbook: Local LLM Setup on a 16GB Apple Silicon Mac mini

## Purpose

Use this document as the execution guide for Claude Code to stand up a stable local LLM environment on a 16GB Apple Silicon Mac mini.

This is an inference deployment task, not a model training task. The goal is to install a reliable backend, pull a small set of well-chosen quantized models, validate that they run correctly on Apple Silicon, and optionally expose a local UI.

## Primary Objective

Provision a local AI stack that:

- runs fully on-device
- uses Apple Silicon efficiently
- avoids memory pressure and swap-heavy failure modes
- supports CLI and local API access
- can optionally expose a browser UI

## Success Criteria

Claude Code should consider the task complete only when all of the following are true:

1. Apple Silicon and available memory have been verified.
2. Ollama is installed and running on `http://localhost:11434`.
3. At least two local models are installed and usable:
   - one general-purpose chat model
   - one coding or reasoning model
4. The installed models pass simple smoke tests.
5. The backend reports healthy runtime status with `ollama ps`.
6. Optional: Open WebUI is running on `http://localhost:3000`.
7. A short setup report has been written with what was installed, what passed, and any limits observed.

## Hard Constraints For This Machine

Treat the machine as a 16GB Apple Silicon Mac mini unless hardware inspection proves otherwise.

- Prefer quantized models, typically Q4-class variants.
- Do not begin with models larger than roughly 14B parameters.
- Keep default context windows modest: `4096` to `8192` unless testing proves higher values are safe.
- Leave RAM headroom for macOS, the UI, and background services.
- If memory pressure becomes high or swap starts climbing aggressively, step down to a smaller model or smaller context.
- Prefer Apple Silicon-native software only.

## Recommended Stack

Use this default stack unless the user explicitly asks for a different toolchain:

- Backend: Ollama
- Primary models:
  - `llama3.2:3b` for fast general chat
  - `qwen2.5-coder:7b` for coding
  - optional `deepseek-r1:8b` for reasoning experiments
- Optional browser UI: Open WebUI
- Optional desktop UI: Msty or LM Studio, but do not make them the default automation path

## What Not To Do

- Do not attempt to train a model from scratch.
- Do not pull 30B, 70B, or other large models on first setup.
- Do not assume a larger context window is better.
- Do not install x86 builds under Rosetta if an Apple Silicon build exists.
- Do not keep multiple large models loaded at the same time during first-pass validation.
- Do not call the setup successful until a real prompt has run through the installed backend.

## Execution Plan

Follow the phases in order.

### Phase 1: Preflight Inspection

Run these checks first and record the results in the setup report.

```bash
uname -m
system_profiler SPHardwareDataType
sysctl -n hw.memsize
df -h /
vm_stat
```

Expected outcomes:

- architecture should be `arm64`
- hardware should indicate Apple Silicon
- total memory should confirm the 16GB class machine
- free disk should be sufficient for several models and logs

If disk space is tight, stop pulling extra models and keep the install minimal.

### Phase 2: Prepare a Working Directory

Create a durable local workspace for setup artifacts.

```bash
mkdir -p "$HOME/local-llm-stack/modelfiles"
mkdir -p "$HOME/local-llm-stack/logs"
```

Create a report file that Claude Code updates as work completes:

```bash
cat > "$HOME/local-llm-stack/setup-report.md" <<'EOF'
# Local LLM Setup Report

## Machine

## Installed Software

## Installed Models

## Validation Results

## Notes and Limits
EOF
```

### Phase 3: Install Homebrew If Missing

Homebrew is the simplest automation path for this setup. Only install it if it is absent.

Check:

```bash
command -v brew
```

If missing, install it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Then verify:

```bash
brew --version
```

### Phase 4: Install Ollama

Preferred installation:

```bash
brew install --cask ollama
```

Start the app so the background service is available:

```bash
open -a Ollama
```

Wait for the daemon to come up, then verify:

```bash
curl -s http://localhost:11434/api/tags
```

If the endpoint does not respond, wait briefly and try again. If the app is blocked by macOS security prompts, clear the prompt manually and rerun the check.

### Phase 5: Pull Safe Starter Models

Install models in this order. Stop after each pull and verify available disk and memory before moving on.

Base general model:

```bash
ollama pull llama3.2:3b
```

Primary coding model:

```bash
ollama pull qwen2.5-coder:7b
```

Optional reasoning model:

```bash
ollama pull deepseek-r1:8b
```

Verify inventory:

```bash
ollama list
```

### Phase 6: Create 16GB-Safe Local Profiles

Create stable model variants with conservative defaults. This avoids repeatedly setting runtime parameters by hand.

General chat profile:

```bash
cat > "$HOME/local-llm-stack/modelfiles/llama3.2-3b-stable.Modelfile" <<'EOF'
FROM llama3.2:3b
PARAMETER num_ctx 8192
PARAMETER temperature 0.2
PARAMETER repeat_penalty 1.05
EOF
ollama create llama3.2-3b-stable -f "$HOME/local-llm-stack/modelfiles/llama3.2-3b-stable.Modelfile"
```

Coding profile:

```bash
cat > "$HOME/local-llm-stack/modelfiles/qwen2.5-coder-7b-stable.Modelfile" <<'EOF'
FROM qwen2.5-coder:7b
PARAMETER num_ctx 8192
PARAMETER temperature 0.1
PARAMETER repeat_penalty 1.05
EOF
ollama create qwen2.5-coder-7b-stable -f "$HOME/local-llm-stack/modelfiles/qwen2.5-coder-7b-stable.Modelfile"
```

Optional reasoning profile:

```bash
cat > "$HOME/local-llm-stack/modelfiles/deepseek-r1-8b-stable.Modelfile" <<'EOF'
FROM deepseek-r1:8b
PARAMETER num_ctx 4096
PARAMETER temperature 0.3
PARAMETER repeat_penalty 1.05
EOF
ollama create deepseek-r1-8b-stable -f "$HOME/local-llm-stack/modelfiles/deepseek-r1-8b-stable.Modelfile"
```

Reasoning models can run hotter in memory usage, so keep their default context lower unless explicit testing shows more headroom.

### Phase 7: Run CLI Smoke Tests

Run one real prompt against each created profile.

General chat test:

```bash
ollama run llama3.2-3b-stable "Explain unified memory on Apple Silicon in 5 concise bullet points."
```

Coding test:

```bash
ollama run qwen2.5-coder-7b-stable "Write a Python function that reverses a string and include a tiny test."
```

Optional reasoning test:

```bash
ollama run deepseek-r1-8b-stable "Compare three ways to summarize a long PDF locally while staying within 16GB RAM."
```

If a model is too slow or the machine starts swapping heavily, remove it from the default rotation and keep the smaller models.

### Phase 8: Validate API Access

Confirm that local applications can talk to Ollama over HTTP.

```bash
curl -s http://localhost:11434/api/generate \
  -d '{
    "model": "llama3.2-3b-stable",
    "prompt": "Reply with the phrase: local inference is working",
    "stream": false
  }'
```

This should return a JSON payload containing a successful textual response.

### Phase 9: Check Runtime Health

During an active generation, inspect processor placement and memory use.

```bash
ollama ps
```

Use macOS Activity Monitor as a secondary check:

- Memory Pressure should stay out of the red zone.
- Swap Used should stay as low as practical.
- If generation speed collapses, memory pressure is usually the first thing to inspect.

If `ollama ps` suggests the model is not using the GPU efficiently, step down in model size or context length and retest.

### Phase 10: Optional Browser UI With Open WebUI

If the goal includes a local web interface, install Open WebUI.

Install prerequisites:

```bash
brew install uv
```

Create an isolated environment:

```bash
mkdir -p "$HOME/local-llm-stack/open-webui"
cd "$HOME/local-llm-stack/open-webui"
uv venv
source .venv/bin/activate
uv pip install open-webui
```

Start the UI:

```bash
source "$HOME/local-llm-stack/open-webui/.venv/bin/activate"
open-webui serve
```

Expected result:

- Open WebUI should be reachable at `http://localhost:3000`
- it should connect to the Ollama backend on `http://localhost:11434`

If you need Open WebUI to run in the background later, create a dedicated launch script after the core stack has already been validated.

## Model Selection Guidance For A 16GB Mac mini

Use this as the practical default:

| Role | Model | Why |
|---|---|---|
| Fast everyday chat | `llama3.2:3b` | Very safe, responsive, low memory overhead |
| Coding assistant | `qwen2.5-coder:7b` | Strong balance of quality and 16GB fit |
| Reasoning experiments | `deepseek-r1:8b` | Useful if you want a stronger reasoning flavor without jumping too large |
| Stretch target | 12B to 14B Q4-class model | Only after the smaller models are stable |

Do not treat "bigger" as automatically better on this machine. Stability, context headroom, and low swap are more important than headline parameter count.

## Troubleshooting Rules

If a command fails, diagnose in this order:

1. Confirm Ollama is running.
2. Confirm the model exists with `ollama list`.
3. Confirm the model can answer one short prompt.
4. Inspect `ollama ps` while a prompt is running.
5. Inspect Memory Pressure and Swap Used in Activity Monitor.
6. Reduce `num_ctx`.
7. Fall back to a smaller model.

Common fixes:

- If the UI works poorly but CLI works, the frontend is the issue, not the model.
- If the model runs once and then gets sluggish, memory pressure or swap is likely rising.
- If a coding model is too heavy, fall back to the 3B general model for baseline validation and keep only one large model installed.
- If Open WebUI is failing, keep Ollama working first and add the UI only after the backend is known-good.

## Cleanup And Space Recovery

If disk space becomes an issue:

List models:

```bash
ollama list
```

Remove a model you do not need:

```bash
ollama rm MODEL_NAME
```

Do not remove the stable general model unless you are intentionally reworking the stack.

## Final Deliverables Claude Code Should Produce

Before finishing, Claude Code should leave behind:

1. A working Ollama installation.
2. At least two usable models.
3. Stable local model profiles created from Modelfiles.
4. A completed report at `~/local-llm-stack/setup-report.md`.
5. Optional: a working Open WebUI install.

## Completion Template

At the end of the run, populate the report with:

- detected hardware
- installed model names
- active stable profile names
- whether CLI prompts succeeded
- whether HTTP API calls succeeded
- whether Open WebUI was installed
- any observed limits, such as "8k context safe, 16k not recommended"

## Short Mission Statement For Claude Code

If you need a concise instruction block, use this:

> Set up a reliable local LLM stack on this 16GB Apple Silicon Mac mini using Ollama as the backend. Install safe quantized models, create conservative stable profiles, verify CLI and API inference, optionally install Open WebUI, and record the final working state in `~/local-llm-stack/setup-report.md`. Prioritize stability, low memory pressure, and Apple Silicon-native tooling over maximum model size.
