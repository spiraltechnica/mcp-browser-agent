/**
 * MCP Transport layer implementing JSON-RPC communication
 * Provides in-browser message passing between MCP client and server
 */

import { 
  JsonRpcRequest, 
  JsonRpcResponse, 
  JsonRpcError, 
  MCPErrorCodes 
} from './MCPProtocol';

export type MessageHandler = (message: JsonRpcRequest) => Promise<JsonRpcResponse>;

/**
 * In-memory JSON-RPC transport for browser MCP implementation
 * Simulates proper JSON-RPC while maintaining browser performance
 */
export class MCPTransport {
  private messageHandler: MessageHandler | null = null;
  private requestId = 0;

  /**
   * Set the message handler (typically the MCP server)
   */
  setMessageHandler(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Send a JSON-RPC request and get response
   */
  async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.messageHandler) {
      throw new Error('No message handler set');
    }

    const id = this.generateRequestId();
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    try {
      // Simulate JSON-RPC serialization/deserialization
      const serializedRequest = JSON.stringify(request);
      const deserializedRequest = JSON.parse(serializedRequest) as JsonRpcRequest;

      console.log(`📤 MCP Request [${id}]:`, method, params);

      const response = await this.messageHandler(deserializedRequest);

      // Simulate response serialization/deserialization
      const serializedResponse = JSON.stringify(response);
      const deserializedResponse = JSON.parse(serializedResponse) as JsonRpcResponse;

      console.log(`📥 MCP Response [${id}]:`, deserializedResponse);

      if (deserializedResponse.error) {
        throw new MCPError(
          deserializedResponse.error.message,
          deserializedResponse.error.code,
          deserializedResponse.error.data
        );
      }

      return deserializedResponse.result;

    } catch (error) {
      console.error(`❌ MCP Request failed [${id}]:`, error);
      
      if (error instanceof MCPError) {
        throw error;
      }

      throw new MCPError(
        `Transport error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        MCPErrorCodes.INTERNAL_ERROR
      );
    }
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  async sendNotification(method: string, params?: any): Promise<void> {
    if (!this.messageHandler) {
      throw new Error('No message handler set');
    }

    const notification = {
      jsonrpc: "2.0" as const,
      method,
      params
    };

    try {
      // Simulate JSON-RPC serialization/deserialization
      const serialized = JSON.stringify(notification);
      const deserialized = JSON.parse(serialized);

      console.log(`📢 MCP Notification:`, method, params);

      // Notifications don't expect responses
      await this.messageHandler(deserialized);

    } catch (error) {
      console.error(`❌ MCP Notification failed:`, error);
      // Notifications fail silently
    }
  }

  /**
   * Create a JSON-RPC error response
   */
  createErrorResponse(id: string | number, code: number, message: string, data?: any): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        data
      }
    };
  }

  /**
   * Create a JSON-RPC success response
   */
  createSuccessResponse(id: string | number, result: any): JsonRpcResponse {
    return {
      jsonrpc: "2.0",
      id,
      result
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `mcp_${++this.requestId}_${Date.now()}`;
  }
}

/**
 * MCP-specific error class
 */
export class MCPError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }

  toJsonRpcError(): JsonRpcError {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
}

/**
 * Global transport instance
 */
let globalTransport: MCPTransport | null = null;

/**
 * Get the global MCP transport instance
 */
export function getMCPTransport(): MCPTransport {
  if (!globalTransport) {
    globalTransport = new MCPTransport();
  }
  return globalTransport;
}

/**
 * Reset the global transport (useful for testing)
 */
export function resetMCPTransport(): void {
  globalTransport = null;
}
