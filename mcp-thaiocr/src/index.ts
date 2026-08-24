import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  SetLevelRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  OCR_THAI_TOOL,
  THAIOCR_TOOL_NAME,
  THAIOCR_TOOL_ALIASES,
  THAIOCR_GUIDES_URI,
  THAIOCR_CONFIG_URI,
  THAIOCR_GUIDES_URI_ALIASES,
  THAIOCR_CONFIG_URI_ALIASES,
} from "./types.js";
import { logMessage, setLogLevel, getCurrentLogLevel, shouldLog } from "./logging.js";
import { performOCR, summarizeArgs, type OCRRequestArgs } from "./ocr.js";
import { createConfigResource, createHelpResource } from "./resources.js";
import { createHttpServer, resolveBindHost } from "./http-server.js";
import { initializeDiagnosticSanitizer, sanitizeErrorForTransport } from "./diagnostic-sanitizer.js";
import { writeDiagnostic } from "./diagnostic-output.js";
import { getOCRConfig, validateOCRConfig, resolveHttpListen, SERVER_NAME } from "./config.js";
import { packageVersion } from "./version.js";

export function createMcpServer(): McpServer {
  const mcpServer = new McpServer(
    {
      name: SERVER_NAME,
      version: packageVersion,
    },
    {
      capabilities: {
        logging: {},
        resources: {},
        tools: {},
      },
    },
  );

  const server = mcpServer.server;

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (shouldLog(mcpServer, "debug")) {
      logMessage(mcpServer, "debug", "Handling list_tools request");
    }
    return {
      tools: [OCR_THAI_TOOL],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    if (shouldLog(mcpServer, "debug")) {
      logMessage(mcpServer, "debug", `Handling call_tool request: ${name}`);
    }

    try {
      if (name === THAIOCR_TOOL_NAME || (THAIOCR_TOOL_ALIASES as readonly string[]).includes(name)) {
        if (!args || typeof args !== "object" || Array.isArray(args)) {
          throw new Error("Invalid arguments for Thai OCR");
        }

        const rawArgs = args as Record<string, unknown>;
        logMessage(mcpServer, "info", `${THAIOCR_TOOL_NAME} arguments`, summarizeArgs(rawArgs));

        const ocrArgs: OCRRequestArgs = {
          image: rawArgs.image,
          source: typeof rawArgs.source === "string" ? rawArgs.source : undefined,
          file_path: typeof rawArgs.file_path === "string" ? rawArgs.file_path : undefined,
          url: typeof rawArgs.url === "string" ? rawArgs.url : undefined,
          base64: typeof rawArgs.base64 === "string" ? rawArgs.base64 : undefined,
          file_id: typeof rawArgs.file_id === "string" ? rawArgs.file_id : undefined,
          __files__: rawArgs.__files__,
          files: rawArgs.files,
          model: typeof rawArgs.model === "string" ? rawArgs.model : undefined,
          task: typeof rawArgs.task === "string" ? rawArgs.task : undefined,
          prompt: typeof rawArgs.prompt === "string" ? rawArgs.prompt : undefined,
          page: typeof rawArgs.page === "string" ? rawArgs.page : undefined,
          max_tokens: typeof rawArgs.max_tokens === "number" ? rawArgs.max_tokens : undefined,
          temperature: typeof rawArgs.temperature === "number" ? rawArgs.temperature : undefined,
          top_p: typeof rawArgs.top_p === "number" ? rawArgs.top_p : undefined,
          repetition_penalty: typeof rawArgs.repetition_penalty === "number"
            ? rawArgs.repetition_penalty
            : undefined,
        };

        const result = await performOCR(mcpServer, ocrArgs, extra.signal);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      const safeError = sanitizeErrorForTransport(error);
      if (shouldLog(mcpServer, "error")) {
        logMessage(mcpServer, "error", `Tool execution error: ${safeError.message}`, {
          tool: name,
          args,
          error: safeError.stack,
        });
      }
      throw safeError;
    }
  });

  server.setRequestHandler(SetLevelRequestSchema, async (request) => {
    const { level } = request.params;
    if (shouldLog(mcpServer, "info")) {
      logMessage(mcpServer, "info", `Setting log level to: ${level}`);
    }
    setLogLevel(mcpServer, level);
    return {};
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    if (shouldLog(mcpServer, "debug")) {
      logMessage(mcpServer, "debug", "Handling list_resources request");
    }
    return {
      resources: [
        {
          uri: THAIOCR_CONFIG_URI,
          mimeType: "application/json",
          name: "thaiocr_config",
          description: "Current thaiocr server configuration and environment variables",
        },
        {
          uri: THAIOCR_GUIDES_URI,
          mimeType: "text/markdown",
          name: "thaiocr_guides",
          description: "How to use the thaiocr MCP tool (file types, PDF pages, task types)",
        },
      ],
    };
  });

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    if (shouldLog(mcpServer, "debug")) {
      logMessage(mcpServer, "debug", "Handling list_resource_templates request");
    }
    return { resourceTemplates: [] };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (shouldLog(mcpServer, "debug")) {
      logMessage(mcpServer, "debug", `Handling read_resource request for: ${uri}`);
    }

    if (uri === THAIOCR_CONFIG_URI || THAIOCR_CONFIG_URI_ALIASES.includes(uri)) {
      return {
        contents: [
          {
            uri: THAIOCR_CONFIG_URI,
            mimeType: "application/json",
            text: createConfigResource(mcpServer),
          },
        ],
      };
    }
    if (uri === THAIOCR_GUIDES_URI || THAIOCR_GUIDES_URI_ALIASES.includes(uri)) {
      return {
        contents: [
          {
            uri: THAIOCR_GUIDES_URI,
            mimeType: "text/markdown",
            text: createHelpResource(),
          },
        ],
      };
    }
    throw sanitizeErrorForTransport(new Error(`Unknown resource: ${uri}`));
  });

  return mcpServer;
}

export async function main() {
  initializeDiagnosticSanitizer();

  const configIssue = validateOCRConfig();
  if (configIssue) {
    writeDiagnostic("error", configIssue);
    process.exit(1);
  }

  const listen = resolveHttpListen();
  if (listen.portError) {
    writeDiagnostic("error", listen.portError);
    process.exit(1);
  }

  if (listen.port !== undefined) {
    const port = listen.port;
    const host = resolveBindHost(listen.host);
    writeDiagnostic("log", `Starting HTTP transport on ${host}:${port}`);
    const app = await createHttpServer(createMcpServer, port);

    const httpServer = app.listen(port, host, () => {
      writeDiagnostic("log", `HTTP server listening on ${host}:${port}`);
      writeDiagnostic("log", `Health check: http://localhost:${port}/health`);
      writeDiagnostic("log", `MCP endpoint: http://localhost:${port}/mcp`);
    });

    const shutdown = (signal: string) => {
      writeDiagnostic("log", `Received ${signal}. Shutting down HTTP server...`);
      httpServer.close(() => {
        writeDiagnostic("log", "HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } else {
    const mcpServer = createMcpServer();
    const config = getOCRConfig();

    if (process.stdin.isTTY) {
      writeDiagnostic("error", `Thai OCR MCP Server v${packageVersion} - Ready`);
      writeDiagnostic("error", `OCR Endpoint: ${config.ocrEndpoint}`);
      writeDiagnostic("error", "Waiting for MCP client connection via STDIO...\n");
    }

    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);

    if (shouldLog(mcpServer, "info")) {
      logMessage(mcpServer, "info", `Thai OCR MCP Server v${packageVersion} connected via STDIO`);
    }
    if (shouldLog(mcpServer, "info")) {
      logMessage(mcpServer, "info", `Log level: ${getCurrentLogLevel(mcpServer)}`);
    }
    if (shouldLog(mcpServer, "info")) {
      logMessage(mcpServer, "info", `OCR: ${config.ocrEndpoint}`);
    }
  }
}

