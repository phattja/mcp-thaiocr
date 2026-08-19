import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOCRConfig } from "./config.js";
import { getCurrentLogLevel } from "./logging.js";

export function createConfigResource(mcpServer: McpServer): string {
  const config = getOCRConfig();

  // Get current log level from the server if possible
  const logLevel = getCurrentLogLevel(mcpServer) || "info";

  const resource = {
    server_name: "mcp-thaiocr",
    version: "0.1.0-dev",
    configuration: {
      ocr_endpoint: config.ocrEndpoint,
      ocr_model: config.ocrModel,
      default_max_tokens: config.defaultMaxTokens,
      default_temperature: config.defaultTemperature,
      default_top_p: config.defaultTopP,
      default_repetition_penalty: config.defaultRepetitionPenalty,
      http_port: config.httpPort,
      http_host: config.httpHost,
    },
    log_level: logLevel,
    environment_variables: {
      ocr_endpoint: process.env.OCR_ENDPOINT || "(using default)",
      ocr_model: process.env.OCR_MODEL || "(using default)",
    },
  };

  return JSON.stringify(resource, null, 2);
}


export function createHelpResource(): string {
  const helpText = `# Thai OCR MCP Server - Usage Guide

## Overview
This MCP server provides OCR capabilities for Thai and English documents using Typhoon-OCR1.5-2B.

## Available Tools

### ocr_thai
Extract text from images using AI OCR.

**Parameters:**
- \`source\` (required): Source type - "file", "url", or "base64"
- \`file_path\`: File path when source="file"
- \`url\`: Image URL when source="url"
- \`base64\`: Base64 encoded image when source="base64"
- \`model\`: OCR model name (optional)
- \`max_tokens\`: Maximum tokens to generate (optional, default: 4096)
- \`temperature\`: Sampling temperature (optional, default: 0.1)
- \`top_p\`: Top-p sampling value (optional, default: 0.6)
- \`repetition_penalty\`: Repetition penalty (optional, default: 1.2)

**Example:**
\`\`\`json
{
  "source": "file",
  "file_path": "/tmp/1.png"
}
\`\`\`

## Resources

### config://server-config
Returns current server configuration as JSON.

### help://usage-guide
This usage guide.

## Configuration

Environment variables:
- \`OCR_ENDPOINT\`: OCR API endpoint URL (default: http://127.0.0.1:3003/v1)
- \`OCR_MODEL\`: Default model name (default: Typhoon-OCR1.5-2B)
- \`DEFAULT_MAX_TOKENS\`: Maximum tokens (default: 4096)
- \`DEFAULT_TEMPERATURE\`: Temperature value (default: 0.1)
- \`DEFAULT_TOP_P\`: Top-p value (default: 0.6)
- \`DEFAULT_REPETITION_PENALTY\`: Repetition penalty (default: 1.2)
- \`OCR_HTTP_PORT\`: HTTP port for streamable transport (default: 8006)
- \`OCR_HTTP_HOST\`: HTTP host binding (default: 0.0.0.0)

## Usage Examples

### STDIO Mode (Claude, Cursor, Codex)
\`\`\`json
{
  "mcpServers": {
    "ocr-thai": {
      "command": "npx",
      "args": ["-y", "mcp-thaiocr"],
      "env": {
        "OCR_ENDPOINT": "http://127.0.0.1:3003/v1"
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
- Supported image formats: PNG, JPG, JPEG, PDF
- Results are returned as plain text or Markdown depending on the OCR model output.
`;

  return helpText.trim();
}
