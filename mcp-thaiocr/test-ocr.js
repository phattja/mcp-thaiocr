#!/usr/bin/env node

/**
 * Quick test script for mcp-thaiocr
 * Demonstrates how to use the OCR tool via STDIO
 */

import { execSync } from 'child_process';
import { readFile } from 'fs/promises';

// Configuration
const OCR_IMAGE_PATH = '/tmp/1.png';
const OCR_API_ENDPOINT = process.env.OCR_ENDPOINT || 'http://ai-tool:3003/v1';
const MODEL = process.env.OCR_MODEL || 'Typhoon-OCR1.5-2B';

// MCP initialize request
const initializeRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    processId: process.pid,
    rootUri: null,
    workspaceFolders: null,
  },
};

// MCP initialized notification
const initializedNotification = {
  jsonrpc: "2.0",
  method: "initialized",
  params: {},
};

// MCP tool call for OCR
function createOCRToolCall(imagePath) {
  return {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "thaiocr",
      arguments: {
        source: "file",
        file_path: imagePath,
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.1,
        top_p: 0.6,
        repetition_penalty: 1.2,
      },
    },
  };
}

// Simple STDIO MCP client simulation
async function runMCPTCPSim() {
  try {
    console.log("Starting mcp-thaiocr in STDIO mode...");

    // This would normally be done via the MCP client
    // For simplicity, we're just showing the structure
    
    console.log("\n=== Expected MCP Flow ===\n");
    console.log("1. Client sends initialize request");
    console.log(JSON.stringify(initializeRequest, null, 2));
    
    console.log("\n2. Server responds with capabilities");
    console.log("   { \"jsonrpc\": \"2.0\", \"id\": 1, \"result\": {...} }\n");
    
    console.log("3. Client sends initialized notification");
    console.log(JSON.stringify(initializedNotification, null, 2));
    
    console.log("\n4. Client calls thaiocr tool");
    console.log(JSON.stringify(createOCRToolCall(OCR_IMAGE_PATH), null, 2));
    
    console.log("\n5. Server returns OCR result");
    console.log("   { \"jsonrpc\": \"2.0\", \"id\": 2, \"result\": { \"content\": [{\"type\":\"text\",\"text\":\"...\"}] } }\n");

    // Verify image file exists
    try {
      await readFile(OCR_IMAGE_PATH);
      console.log(`✓ Image file found: ${OCR_IMAGE_PATH}`);
    } catch (err) {
      console.error(`✗ Image file not found: ${OCR_IMAGE_PATH}`);
      console.error(`  Please ensure the image is available at this path`);
      process.exit(1);
    }

    // Check OCR API endpoint
    try {
      const response = await fetch(`${OCR_API_ENDPOINT}/health`, { method: 'GET' });
      if (response.ok) {
        console.log(`✓ OCR API endpoint reachable: ${OCR_API_ENDPOINT}`);
      } else {
        console.error(`✗ OCR API endpoint returned: ${response.status}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`✗ Cannot reach OCR API endpoint: ${OCR_API_ENDPOINT}`);
      console.error(`  Error: ${err.message}`);
      process.exit(1);
    }

    console.log("\n=== Test Configuration ===");
    console.log(`OCR Image: ${OCR_IMAGE_PATH}`);
    console.log(`OCR API: ${OCR_API_ENDPOINT}`);
    console.log(`Model: ${MODEL}`);
    console.log("\nTo run the actual MCP server:");
    console.log("  npx -y mcp-thaiocr\n");

  } catch (error) {
    console.error("Error during test:", error);
    process.exit(1);
  }
}

runMCPTCPSim();
