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

import { OCR_THAI_TOOL } from "./types.js";
import { logMessage, setLogLevel, getCurrentLogLevel, shouldLog } from "./logging.js";
import { performOCR, type OCRRequestArgs } from "./ocr.js";
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
      if (name === "ocr_thai") {
        // Validate arguments structure
        if (!args || typeof args !== "object" || Array.isArray(args)) {
          throw new Error("Invalid arguments for Thai OCR");
        }

        const rawArgs = args as Record<string, unknown>;
        if (!rawArgs.hasOwnProperty("source") || typeof rawArgs.source !== "string") {
          throw new Error("source parameter is required and must be a string");
        }

        // Construct properly typed arguments
        const ocrArgs: OCRRequestArgs = {
          source: rawArgs.source as "file" | "url" | "base64",
          file_path: rawArgs.file_path as string | undefined,
          url: rawArgs.url as string | undefined,
          base64: rawArgs.base64 as string | undefined,
          model: rawArgs.model as string | undefined,
          max_tokens: rawArgs.max_tokens as number | undefined,
          temperature: rawArgs.temperature as number | undefined,
          top_p: rawArgs.top_p as number | undefined,
          repetition_penalty: rawArgs.repetition_penalty as number | undefined,
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
          uri: "config://server-config",
          mimeType: "application/json",
          name: "Server Configuration",
          description: "Current server configuration and environment variables",
        },
        {
          uri: "help://usage-guide",
          mimeType: "text/markdown",
          name: "Usage Guide",
          description: "How to use the Thai OCR MCP server",
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

    switch (uri) {
      case "config://server-config":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: createConfigResource(mcpServer),
            },
          ],
        };
      case "help://usage-guide":
        return {
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: createHelpResource(),
            },
          ],
        };
      default:
        throw sanitizeErrorForTransport(new Error(`Unknown resource: ${uri}`));
    }
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

