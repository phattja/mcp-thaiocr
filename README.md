# Thai OCR MCP Server

**Semantic Thai document OCR for AI assistants — Typhoon-OCR1.5-2B via MCP.**

An [MCP server](https://modelcontextprotocol.io/introduction) that extracts Thai and English text from images (PNG, JPG, PDF). Layout and HTTP transport follow [mcp-thailaw](https://github.com/phattja/mcp-thailaw).

```
AI Assistant / Open WebUI
        │  MCP protocol
        ▼
  mcp-thaiocr  (this project — Node.js)
        │  OpenAI-compatible /v1/chat/completions
        ▼
  Typhoon-OCR1.5-2B  (http://127.0.0.1:3003/v1)
```

## Quick Start

### HTTP (Open WebUI)

```bash
cd mcp-thaiocr
npm install
npm run build
node dist/cli.js --http-port 8006 --http-host 0.0.0.0 \
  --ocr-endpoint http://127.0.0.1:3003/v1 \
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
        "OCR_ENDPOINT": "http://127.0.0.1:3003/v1",
        "OCR_MODEL": "Typhoon-OCR1.5-2B"
      }
    }
  }
}
```

## Tools

* **ocr_thai** — extract text from a Thai document image
    * `source` — `file`, `url`, or `base64` (required)
    * `file_path` — local path when `source=file`
    * `url` — image URL when `source=url`
    * `base64` — encoded image when `source=base64`
    * `model`, `max_tokens`, `temperature`, `top_p`, `repetition_penalty`

HTTP transport is **stateless** by default (`OCR_HTTP_STATELESS=true`) so browser and Open WebUI clients do not need to persist `Mcp-Session-Id`.

## Configuration

| Setting | Default |
|---------|---------|
| OCR endpoint | `http://127.0.0.1:3003/v1` |
| Model | `Typhoon-OCR1.5-2B` |
| HTTP port | `8006` |
| HTTP host | `0.0.0.0` |

CLI flags (`--http-port`, `--http-host`, `--ocr-endpoint`, `--ocr-model`) override the matching environment variables (`OCR_HTTP_PORT`, `OCR_HTTP_HOST`, `OCR_ENDPOINT`, `OCR_MODEL`).

## Acknowledgements

HTTP/MCP layout is adapted from **[mcp-thailaw](https://github.com/phattja/mcp-thailaw)**, itself a fork of [mcp-searxng](https://github.com/ihor-sokoliuk/mcp-searxng).

## License

MIT — see [LICENSE](LICENSE).
