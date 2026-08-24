# phattja/mcp-thaiocr

**Semantic Thai document OCR for AI assistants — Typhoon-OCR1.5-2B via MCP.**

Author: [phattja](https://github.com/phattja).

An [MCP server](https://modelcontextprotocol.io/introduction) that extracts Thai and English text from images and PDFs (PNG, JPEG, WEBP, GIF, TIFF, BMP, PDF).

```
AI Assistant / Open WebUI
        │  MCP protocol
        ▼
  mcp-thaiocr  (this project — Node.js)
        │  OpenAI-compatible /v1/chat/completions
        ▼
  Typhoon-OCR1.5-2B  (http://ai-tool:3003/v1)
```

## Quick Start

### HTTP (Open WebUI)

```bash
cd mcp-thaiocr
npm install
npm run build
node dist/cli.js --http-port 8006 --http-host 0.0.0.0 \
  --ocr-endpoint http://ai-tool:3003/v1 \
  --ocr-model Typhoon-OCR1.5-2B
```

Connect the client to `http://localhost:8006/mcp`.

### Docker (host network)

```bash
docker compose up -d --build
```

- Health: `http://127.0.0.1:8006/health`
- MCP: `http://127.0.0.1:8006/mcp`

### STDIO (Claude, Cursor, Codex)

```json
{
  "mcpServers": {
    "thaiocr": {
      "command": "npx",
      "args": ["-y", "mcp-thaiocr"],
      "env": {
        "OCR_ENDPOINT": "http://ai-tool:3003/v1",
        "OCR_MODEL": "Typhoon-OCR1.5-2B"
      }
    }
  }
}
```

## Tools

* **thaiocr** — extract text from a Thai document image or PDF
    * Supported types: PNG, JPEG/JPG, WEBP, GIF, TIFF/TIF, BMP, PDF
    * `image` — path, URL, data URI, raw base64, or Open WebUI file id
    * `source` — `file`, `url`, or `base64` (optional, auto-detected)
    * `file_path` — local path when `source=file`
    * `url` — image URL when `source=url`
    * `base64` — encoded image when `source=base64`
    * `task`, `prompt`, `page`, `model`, `max_tokens`, `temperature`, `top_p`, `repetition_penalty`

Resources: **thaiocr_guides** (`thaiocr://guides`), **thaiocr_config** (`thaiocr://config`).

HTTP transport is **stateless** by default (`OCR_HTTP_STATELESS=true`) so browser and Open WebUI clients do not need to persist `Mcp-Session-Id`.

## Configuration

| Setting | Default |
|---------|---------|
| OCR endpoint | `http://ai-tool:3003/v1` |
| Model | `Typhoon-OCR1.5-2B` |
| HTTP port | `8006` |
| HTTP host | `0.0.0.0` |

CLI flags (`--http-port`, `--http-host`, `--ocr-endpoint`, `--ocr-model`) override the matching environment variables (`OCR_HTTP_PORT`, `OCR_HTTP_HOST`, `OCR_ENDPOINT`, `OCR_MODEL`).

## License

MIT — see [LICENSE](LICENSE).
