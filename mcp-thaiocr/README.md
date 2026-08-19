# Thai OCR MCP Server (`mcp-thaiocr`)

An MCP server that extracts Thai (and English) text from document images using **Typhoon-OCR1.5-2B**.

## Features

- Thai OCR via an OpenAI-compatible `/v1` endpoint
- File, URL, or base64 image input (PNG, JPG, JPEG, PDF)
- STDIO transport for Claude, Cursor, Codex
- Streamable HTTP transport for Open WebUI (`:8006`)

## Quick Start

### Docker (host network)

```bash
cd /ai/thaiocr
docker compose up -d --build
```

MCP endpoint: `http://127.0.0.1:8006/mcp`  
Health: `http://127.0.0.1:8006/health`

### STDIO (Claude, Cursor, Codex)

```json
{
  "mcpServers": {
    "thaiocr": {
      "command": "npx",
      "args": ["-y", "mcp-thaiocr"],
      "env": {
        "OCR_ENDPOINT": "http://127.0.0.1:3003/v1",
        "OCR_MODEL": "Typhoon-OCR1.5-2B"
      }
    }
  }
}
```

### HTTP (Open WebUI)

```bash
node dist/cli.js --http-port 8006 --http-host 0.0.0.0 \
  --ocr-endpoint http://127.0.0.1:3003/v1 \
  --ocr-model Typhoon-OCR1.5-2B
```

Connect the client to `http://localhost:8006/mcp`.

## Tool: `ocr_thai`

```json
{
  "source": "file",
  "file_path": "/tmp/1.png",
  "model": "Typhoon-OCR1.5-2B"
}
```

`source` is `file`, `url`, or `base64`. Optional: `max_tokens`, `temperature`, `top_p`, `repetition_penalty`.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OCR_ENDPOINT` | OCR API endpoint URL | `http://127.0.0.1:3003/v1` |
| `OCR_MODEL` | Default model name | `Typhoon-OCR1.5-2B` |
| `DEFAULT_MAX_TOKENS` | Maximum tokens to generate | `4096` |
| `DEFAULT_TEMPERATURE` | Sampling temperature | `0.1` |
| `DEFAULT_TOP_P` | Top-p sampling value | `0.6` |
| `DEFAULT_REPETITION_PENALTY` | Repetition penalty | `1.2` |
| `OCR_HTTP_PORT` | HTTP port | `8006` |
| `OCR_HTTP_HOST` | HTTP bind address | `0.0.0.0` |

CLI flags (`--http-port`, `--http-host`, `--ocr-endpoint`, `--ocr-model`) override the matching environment variables.

## Build from source

```bash
cd /ai/thaiocr/mcp-thaiocr
npm install
npm run build
node dist/cli.js --http-port 8006 --http-host 0.0.0.0
```

Requires Node.js 20+ and a running Typhoon-OCR1.5-2B server at `http://127.0.0.1:3003/v1`.

## License

MIT
