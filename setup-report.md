# Local LLM Setup Report

Generated: 2026-04-29

## Machine

| Field | Value |
|---|---|
| Model | Mac mini (Macmini9,1) |
| Chip | Apple M1 |
| Architecture | arm64 |
| Memory | 16 GB unified |
| Cores | 8 (4 performance + 4 efficiency) |
| Disk (total) | 228 GB |
| Disk (free at setup) | ~24 GB |

Baseline memory state: zero swapins, zero swapouts before model pulls.

## Installed Software

| Software | Version | Install Method |
|---|---|---|
| Homebrew | 5.1.8 | pre-existing |
| uv | 0.11.2 | pre-existing |
| Ollama | 0.22.0 | `brew install --cask ollama` |
| Open WebUI | latest | `uv pip install open-webui` |

## Installed Models

| Name | Size on Disk | Source |
|---|---|---|
| `llama3.2:3b` | 2.0 GB | `ollama pull llama3.2:3b` |
| `qwen2.5-coder:7b` | 4.7 GB | `ollama pull qwen2.5-coder:7b` |

## Stable Profiles Created

| Profile Name | Base Model | num_ctx | temperature | repeat_penalty |
|---|---|---|---|---|
| `llama3.2-3b-stable` | llama3.2:3b | 8192 | 0.2 | 1.05 |
| `qwen2.5-coder-7b-stable` | qwen2.5-coder:7b | 8192 | 0.1 | 1.05 |

Modelfiles are stored in `~/local-llm-stack/modelfiles/`.

## Validation Results

### CLI Smoke Tests

| Model | Prompt | Result |
|---|---|---|
| `llama3.2-3b-stable` | "Explain unified memory on Apple Silicon in 5 bullet points" | PASS — coherent 5-bullet response |
| `qwen2.5-coder-7b-stable` | "Write a Python function that reverses a string and include a tiny test" | PASS — valid Python with assertions |

### HTTP API Test

```
POST http://localhost:11434/api/generate
model: llama3.2-3b-stable
prompt: "Reply with the phrase: local inference is working"
```

Result: PASS — response contained "Local inference is working", done: true

### Runtime Health (ollama ps)

Both models loaded simultaneously during validation:

| Model | Size in RAM | Processor | Context |
|---|---|---|---|
| `llama3.2-3b-stable` | 3.4 GB | 100% GPU | 8192 |
| `qwen2.5-coder-7b-stable` | 5.3 GB | 100% GPU | 8192 |

Both models ran fully on the GPU (Apple Neural Engine / Metal). No CPU offload observed.

### Open WebUI

- Installed at: `~/local-llm-stack/open-webui/.venv`
- Launch script: `~/local-llm-stack/start-open-webui.sh`
- Expected URL: `http://localhost:3000`
- Connects to Ollama backend at `http://localhost:11434`

## Notes and Limits

**Safe context window:** 8192 tokens confirmed safe for both models individually. Do not test 16k+ without monitoring swap.

**Single-model rule:** Running both models loaded simultaneously (8.7 GB combined) caused minor swap activity on this 16 GB machine. Ollama auto-evicts the older model after 4 minutes of inactivity. Use one model at a time in normal operation.

**Processor placement:** Both models achieved 100% GPU utilization, confirming proper Apple Silicon Metal acceleration.

**Stretch target:** A 12B–14B Q4-class model (e.g., `mistral-nemo:12b` or `qwen2.5:14b`) may fit in ~9–10 GB and is a viable next step after the current stack is stable. Test with a single model loaded, monitor swap before committing.

**No deepseek-r1:8b installed:** Optional reasoning model was skipped to leave headroom. Install with `ollama pull deepseek-r1:8b` and create a profile using `~/local-llm-stack/modelfiles/` as a template. Limit its `num_ctx` to 4096.

## Quick Reference

```bash
# Start Ollama (if not running)
open -a Ollama

# Run general chat
ollama run llama3.2-3b-stable

# Run coding assistant
ollama run qwen2.5-coder-7b-stable

# Check what's loaded
ollama ps

# Start Open WebUI (browser at http://localhost:3000)
~/local-llm-stack/start-open-webui.sh

# List all models
ollama list
```
