#!/bin/bash
# Start Open WebUI (connects to Ollama at http://localhost:11434)
source "$HOME/local-llm-stack/open-webui/.venv/bin/activate"
open-webui serve
