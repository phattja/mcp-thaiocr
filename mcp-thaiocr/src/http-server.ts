import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { writeDiagnostic } from "./diagnostic-output.js";
import { packageVersion } from "./version.js";
import { SERVER_NAME } from "./config.js";

interface Session {
  transport: StreamableHTTPServerTransport;
  mcpServer: McpServer;
}

export interface ListenConfig {
  port?: number;
  host?: string;
  portError?: string;
}

function envEnabled(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return defaultValue;
  }
  if (raw === "true" || raw === "1") {
    return true;
  }
  if (raw === "false" || raw === "0") {
    return false;
  }
  return defaultValue;
}

export async function createHttpServer(
  createMcpServer: () => McpServer,
  port: number,
  _host?: string,
): Promise<express.Application> {
  const app = express();
  // Stateless is the default so browser / Open WebUI clients that do not
  // persist Mcp-Session-Id can still call tools/list after initialize.
  const stateless = envEnabled("OCR_HTTP_STATELESS", true);
  const bodyLimit = process.env.OCR_HTTP_BODY_LIMIT?.trim() || "512mb";

  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    exposedHeaders: ["Mcp-Session-Id"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Authorization",
      "mcp-session-id",
      "mcp-protocol-version",
    ],
  }));
  app.use(express.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

  const sessions = new Map<string, Session>();

  async function handleStatelessPost(req: express.Request, res: express.Response): Promise<void> {
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const cleanup = () => {
      void transport.close();
      void mcpServer.close();
    };
    res.once("finish", cleanup);
    res.once("close", cleanup);

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  app.post("/mcp", async (req, res) => {
    try {
      if (stateless) {
        await handleStatelessPost(req, res);
        return;
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;
      let mcpServer: McpServer;

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)!;
        transport = session.transport;
        mcpServer = session.mcpServer;
      } else if (isInitializeRequest(req.body)) {
        mcpServer = createMcpServer();
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, mcpServer });
            writeDiagnostic("log", `Session initialized: ${id}`);
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
          }
        };
        await mcpServer.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided. POST initialize first, or set OCR_HTTP_STATELESS=true.",
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      writeDiagnostic("error", `Error handling MCP request: ${error instanceof Error ? error.message : String(error)}`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", async (req, res) => {
    if (stateless) {
      res.json({
        status: "ok",
        server: SERVER_NAME,
        version: packageVersion,
        transport: "streamable-http",
        mode: "stateless",
        endpoint: "/mcp",
        usage: "POST JSON-RPC with Accept: application/json, text/event-stream",
      });
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or missing session ID" },
        id: null,
      });
      return;
    }

    try {
      await sessions.get(sessionId)!.transport.handleRequest(req, res);
    } catch (error) {
      writeDiagnostic("error", `Error handling MCP GET: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  app.delete("/mcp", async (req, res) => {
    if (stateless) {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed in stateless mode" },
        id: null,
      });
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid or missing session ID" },
        id: null,
      });
      return;
    }

    try {
      await sessions.get(sessionId)!.transport.handleRequest(req, res);
    } finally {
      sessions.delete(sessionId);
    }
  });

  app.post("/ocr", async (req, res) => {
    try {
      const image = typeof req.body?.image === "string"
        ? req.body.image
        : typeof req.body?.url === "string"
          ? req.body.url
          : typeof req.body?.file_path === "string"
            ? req.body.file_path
            : typeof req.body?.base64 === "string"
              ? req.body.base64
              : undefined;
      if (!image) {
        res.status(400).json({
          error: "Provide image, url, file_path, or base64 in the JSON body",
        });
        return;
      }
      const { performOCR } = await import("./ocr.js");
      const mcpServer = createMcpServer();
      const text = await performOCR(mcpServer, { image });
      void mcpServer.close();
      res.json({ text });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      server: SERVER_NAME,
      version: packageVersion,
      transport: "http",
      mode: stateless ? "stateless" : "session",
      mcp: "/mcp",
    });
  });

  app.use((
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const err = error as { type?: string; status?: number; message?: string };
    if (err?.type === "entity.too.large" || err?.status === 413) {
      writeDiagnostic("error", `Request entity too large: ${err.message || "payload exceeds JSON limit"}`);
      if (!res.headersSent) {
        res.status(413).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: `Request too large (limit ${bodyLimit}). Pass a host file path in image instead of embedding a huge base64 payload.`,
          },
          id: null,
        });
      }
      return;
    }
    next(error);
  });

  return app;
}

export function resolveBindHost(host?: string): string {
  return host || "0.0.0.0";
}
