import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";

export const DEFAULT_LOG_LEVEL: LoggingLevel = "info";
const logLevelsByServer = new WeakMap<McpServer, LoggingLevel>();

const LOG_LEVELS: LoggingLevel[] = ["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"];

export function setLogLevel(mcpServer: McpServer, level: LoggingLevel): void {
  logLevelsByServer.set(mcpServer, level);
}

export function getCurrentLogLevel(mcpServer?: McpServer): LoggingLevel {
  return mcpServer === undefined
    ? DEFAULT_LOG_LEVEL
    : (logLevelsByServer.get(mcpServer) ?? DEFAULT_LOG_LEVEL);
}

export function shouldLog(mcpServer: McpServer, level: LoggingLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(getCurrentLogLevel(mcpServer));
}

export function logMessage(mcpServer: McpServer, level: LoggingLevel, message: string, data?: unknown): void {
  if (shouldLog(mcpServer, level)) {
    try {
      mcpServer.sendLoggingMessage({
        level,
        data,
      }).catch((error) => {
        // Silent failure for logging errors
      });
    } catch (error) {
      // Ignore send errors
    }
  }
}

export function logDebug(mcpServer: McpServer, message: string, extra?: unknown): void {
  logMessage(mcpServer, "debug", message, extra);
}

export function logInfo(mcpServer: McpServer, message: string, extra?: unknown): void {
  logMessage(mcpServer, "info", message, extra);
}

export function logWarning(mcpServer: McpServer, message: string, extra?: unknown): void {
  logMessage(mcpServer, "warning", message, extra);
}

export function logError(mcpServer: McpServer, message: string, extra?: unknown): void {
  logMessage(mcpServer, "error", message, extra);
}

