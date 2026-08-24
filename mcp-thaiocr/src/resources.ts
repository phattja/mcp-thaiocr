import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOCRConfig } from "./config.js";
import { getCurrentLogLevel } from "./logging.js";
import { packageVersion } from "./version.js";
import { SUPPORTED_FILE_TYPES, THAIOCR_CONFIG_URI, THAIOCR_GUIDES_URI } from "./types.js";

export function createConfigResource(mcpServer: McpServer): string {
  const config = getOCRConfig();

  // Get current log level from the server if possible
  const logLevel = getCurrentLogLevel(mcpServer) || "info";

  const resource = {
    server_name: "phattja/mcp-thaiocr",
    version: packageVersion,
    configuration: {
      ocr_endpoint: config.ocrEndpoint,
      ocr_model: config.ocrModel,
      default_max_tokens: config.defaultMaxTokens,
      default_temperature: config.defaultTemperature,
      default_top_p: config.defaultTopP,
      default_repetition_penalty: config.defaultRepetitionPenalty,
      default_task: config.defaultTask,
      http_port: config.httpPort,
      http_host: config.httpHost,
    },
    log_level: logLevel,
    environment_variables: {
      ocr_endpoint: process.env.OCR_ENDPOINT || "(using default)",
      ocr_model: process.env.OCR_MODEL || "(using default)",
      default_task: process.env.DEFAULT_TASK || "(using default)",
    },
  };

  return JSON.stringify(resource, null, 2);
}


export function createHelpResource(): string {
  const helpText = `# thaiocr_guides — Thai OCR MCP Server

Version: ${packageVersion}

## Overview
This MCP server provides OCR capabilities for Thai and English documents using Typhoon-OCR1.5-2B.

## Supported file types

${SUPPORTED_FILE_TYPES}

- Images (PNG, JPEG, WEBP, GIF, TIFF, BMP): always page 1
- PDF: default \`page\` = \`1\` (first page); use \`all\` or ranges such as \`1-3\`, \`1,3\`, \`4,6,7-9\`

## Available Tools

### thaiocr
Extract text from images and PDFs using Typhoon-OCR.

**Parameters:**
- \`image\`: Absolute path, filename, http(s) URL, data URI, raw base64, or Open WebUI file id
- \`source\`: Optional source type — "file", "url", or "base64" (auto-detected if omitted)
- \`file_path\`: File path when source="file"
- \`url\`: Image URL when source="url"
- \`base64\`: Base64 encoded image when source="base64"
- \`model\`: OCR model name (optional)
- \`task\`: OCR task type (optional): "default" (plain markdown), "structure" (HTML tables), "v1.5" (default, clean Markdown with HTML tables)
- \`prompt\`: Custom instructions appended to the OCR prompt (optional)
- \`page\`: PDF pages to process (optional): "1" (default, first page), "all", or a list like "1-3", "1,3", "4,6,7-9"
- \`max_tokens\`: Maximum tokens to generate (optional, default: 32768)
- \`temperature\`: Sampling temperature (optional, default: 0.1)
- \`top_p\`: Top-p sampling value (optional, default: 0.6)
- \`repetition_penalty\`: Repetition penalty (optional, default: 1.2)

**Example:**
\`\`\`json
{
  "image": "/tmp/1.png"
}
\`\`\`

## Resources

### ${THAIOCR_CONFIG_URI} (name: thaiocr_config)
Returns current server configuration as JSON.

### ${THAIOCR_GUIDES_URI} (name: thaiocr_guides)
This usage guide.

## Configuration

Environment variables:
- \`OCR_ENDPOINT\`: OCR API endpoint URL (default: http://ai-tool:3003/v1)
- \`OCR_MODEL\`: Default model name (default: Typhoon-OCR1.5-2B)
- \`DEFAULT_MAX_TOKENS\`: Maximum tokens (default: 32768)
- \`DEFAULT_TEMPERATURE\`: Temperature value (default: 0.1)
- \`DEFAULT_TOP_P\`: Top-p value (default: 0.6)
- \`DEFAULT_REPETITION_PENALTY\`: Repetition penalty (default: 1.2)
- \`DEFAULT_TASK\`: Default OCR task type (default: v1.5)
- \`DEFAULT_PROMPT\`: Default custom prompt appended to OCR (default: empty)
- \`OCR_HTTP_PORT\`: HTTP port for streamable transport (default: 8006)
- \`OCR_HTTP_HOST\`: HTTP host binding (default: 0.0.0.0)

## Usage Examples

### STDIO Mode (Claude, Cursor, Codex)
\`\`\`json
{
  "mcpServers": {
    "thaiocr": {
      "command": "npx",
      "args": ["-y", "mcp-thaiocr"],
      "env": {
        "OCR_ENDPOINT": "http://ai-tool:3003/v1"
      }
    }
  }
}
\`\`\`

### HTTP Mode (Open WebUI)
\`\`\`bash
node dist/cli.js --http-port 8006 --http-host 0.0.0.0
\`\`\`

Connect client to: \`http://localhost:8006/mcp\`

## Notes
- The OCR model must be running at the configured endpoint before starting this server.
- Chat UIs do not auto-attach images; pass a path, URL, or base64 yourself.
- Results are returned as plain text or Markdown depending on the OCR task type.
`;

  return helpText.trim();
}
