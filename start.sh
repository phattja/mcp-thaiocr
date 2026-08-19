#!/bin/bash
set -euo pipefail

APP_DIR="${THAIOCR_APP_DIR:-/ai/thaiocr/mcp-thaiocr}"

cd "$APP_DIR"

if [ ! -d node_modules ]; then
  echo "Installing mcp-thaiocr dependencies..."
  npm ci
fi

if [ ! -f dist/cli.js ]; then
  echo "Building mcp-thaiocr..."
  npm run build
fi

echo "Starting Thai OCR MCP (CLI flags override environment variables)"
exec node dist/cli.js "$@"
