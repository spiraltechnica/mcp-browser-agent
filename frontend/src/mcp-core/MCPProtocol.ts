/**
 * MCP Protocol definitions following the official specification
 * https://modelcontextprotocol.io/specification/2025-06-18/
 */

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

// MCP Standard Methods
export const MCPMethods = {
  // Initialization
  INITIALIZE: "initialize",
  
  // Tools
  TOOLS_LIST: "tools/list",
  TOOLS_CALL: "tools/call",
  
  // Resources (future)
  RESOURCES_LIST: "resources/list",
  RESOURCES_READ: "resources/read",
  
  // Prompts (future)
  PROMPTS_LIST: "prompts/list",
  PROMPTS_GET: "prompts/get",
  
  // Sampling (future)
  SAMPLING_CREATE_MESSAGE: "sampling/createMessage",
} as const;

// MCP Capabilities
export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  sampling?: {};
}

// MCP Server Info
export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: MCPCapabilities;
}

// MCP Client Info
export interface MCPClientInfo {
  name: string;
  version: string;
  capabilities: MCPCapabilities;
}

// Initialize Request/Response
export interface InitializeRequest {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  clientInfo: MCPClientInfo;
}

export interface InitializeResponse {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: MCPServerInfo;
}

// Tools
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface ToolsListResponse {
  tools: MCPTool[];
}

export interface ToolCallRequest {
  name: string;
  arguments?: any;
}

export interface ToolCallResponse {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

// Error Codes
export const MCPErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // MCP specific errors
  INITIALIZATION_FAILED: -32000,
  TOOL_NOT_FOUND: -32001,
  TOOL_EXECUTION_ERROR: -32002,
} as const;
