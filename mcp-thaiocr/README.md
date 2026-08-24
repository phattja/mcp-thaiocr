# Thai OCR MCP Server (`phattja/mcp-thaiocr`)

An MCP server that extracts Thai (and English) text from document images using **Typhoon-OCR1.5-2B**.

## Features

- Thai OCR via an OpenAI-compatible `/v1` endpoint
- File, URL, or base64 input: PNG, JPEG/JPG, WEBP, GIF, TIFF/TIF, BMP, PDF
- Multi-page PDF support with page-range selection (`all`, `1-3`, `1,3`, `4,6,7-9`)
- OCR task types: `default` (plain markdown), `structure` (HTML tables), `v1.5` (clean Markdown)
- Custom prompt appended to the OCR instructions
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
        "OCR_ENDPOINT": "http://ai-tool:3003/v1",
        "OCR_MODEL": "Typhoon-OCR1.5-2B"
      }
    }
  }
}
```

### HTTP (Open WebUI)

```bash
node dist/cli.js --http-port 8006 --http-host 0.0.0.0 \
  --ocr-endpoint http://ai-tool:3003/v1 \
  --ocr-model Typhoon-OCR1.5-2B
```

Connect the client to `http://localhost:8006/mcp`.

## Tool: `thaiocr`

Resources (unique IDs so they do not collide with other MCP servers):

- `thaiocr_guides` — URI `thaiocr://guides`
- `thaiocr_config` — URI `thaiocr://config`

```json
{
  "source": "file",
  "file_path": "/tmp/1.png",
  "model": "Typhoon-OCR1.5-2B"
}
```

`source` is `file`, `url`, or `base64`. Optional: `task`, `prompt`, `page`, `max_tokens`, `temperature`, `top_p`, `repetition_penalty`.

Multi-page PDF example (pages 1–3 only):

```json
{
  "source": "file",
  "file_path": "/tmp/doc.pdf",
  "task": "structure",
  "page": "1-3",
  "prompt": "Include every header and footer line."
}
```

For PDFs, each page's output is separated by `--- Page N ---`. `page` defaults to `1` (first page); pass `all` or a list like `1-3`, `1,3`, `4,6,7-9`.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OCR_ENDPOINT` | OCR API endpoint URL | `http://ai-tool:3003/v1` |
| `OCR_MODEL` | Default model name | `Typhoon-OCR1.5-2B` |
| `DEFAULT_MAX_TOKENS` | Maximum tokens to generate | `32768` |
| `DEFAULT_TEMPERATURE` | Sampling temperature | `0.1` |
| `DEFAULT_TOP_P` | Top-p sampling value | `0.6` |
| `DEFAULT_REPETITION_PENALTY` | Repetition penalty | `1.2` |
| `DEFAULT_TASK` | Default OCR task type (`default`, `structure`, `v1.5`) | `v1.5` |
| `DEFAULT_PROMPT` | Default custom prompt appended to OCR | *(empty)* |
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

Requires Node.js 20+, Python `typhoon-ocr` plus Poppler (`pdfinfo`/`pdftoppm`) for PDFs, and a running Typhoon-OCR1.5-2B server at `http://ai-tool:3003/v1`. The Docker image installs those Python/Poppler dependencies into `/opt/typhoon-ocr`.

## License

MIT
