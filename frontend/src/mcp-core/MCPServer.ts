/**
 * Enhanced MCP Server following the Python implementation pattern
 * Integrates with the new architecture components
 * Now supports JSON-RPC communication for true MCP compliance
 */

import { getConfig } from '../app/HostConfiguration';
import { ToolRegistry, getToolRegistry } from '../mcp-tools/ToolRegistry';
import { Tool } from '../mcp-tools/Tool';
import { enhancedTools } from '../mcp-tools/ServerTools';
import { 
  JsonRpcRequest, 
  JsonRpcResponse, 
  MCPMethods, 
  MCPErrorCodes,
  InitializeRequest,
  InitializeResponse,
  ToolsListResponse,
  ToolCallRequest,
  ToolCallResponse
} from './MCPProtocol';
import { getMCPTransport } from './MCPTransport';

export interface MCPCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: MCPCapabilities;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: any;
  title?: string;
}

export interface MCPCallToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

/**
 * Enhanced MCP Server with proper resource management and error handling
 * Similar to the Python Server class
 */
export class MCPServer {
  private toolRegistry: ToolRegistry;
  private listeners: Set<() => void> = new Set();
  private initialized = false;
  private config = getConfig();
  private serverInfo: MCPServerInfo;

  constructor() {
    this.toolRegistry = getToolRegistry();
    this.serverInfo = this.config.serverConfig;
    
    // Listen for tool changes
    this.toolRegistry.onToolsChanged(() => {
      this.notifyListeners();
    });

    // Set up JSON-RPC transport
    this.setupJsonRpcTransport();
  }

  /**
   * Set up JSON-RPC transport for MCP communication
   */
  private setupJsonRpcTransport(): void {
    const transport = getMCPTransport();
    transport.setMessageHandler(this.handleJsonRpcMessage.bind(this));
  }

  /**
   * Handle incoming JSON-RPC messages
   */
  async handleJsonRpcMessage(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      console.log(`📨 MCP Server received: ${request.method}`);

      switch (request.method) {
        case MCPMethods.INITIALIZE:
          return await this.handleInitialize(request);
        
        case MCPMethods.TOOLS_LIST:
          return await this.handleToolsList(request);
        
        case MCPMethods.TOOLS_CALL:
          return await this.handleToolsCall(request);
        
        default:
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: MCPErrorCodes.METHOD_NOT_FOUND,
              message: `Method not found: ${request.method}`
            }
          };
      }

    } catch (error) {
      console.error(`❌ Error handling JSON-RPC message:`, error);
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal server error'
        }
      };
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      const params = request.params as InitializeRequest;
      
      // Initialize server if not already done
      if (!this.initialized) {
        await this.initialize();
      }

      const response: InitializeResponse = {
        protocolVersion: "2025-06-18",
        capabilities: this.serverInfo.capabilities,
        serverInfo: this.serverInfo
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: response
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCodes.INITIALIZATION_FAILED,
          message: error instanceof Error ? error.message : 'Initialization failed'
        }
      };
    }
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      const tools = await this.listTools();
      
      const response: ToolsListResponse = {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: response
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Failed to list tools'
        }
      };
    }
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      const params = request.params as ToolCallRequest;
      
      if (!this.toolRegistry.hasTool(params.name)) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: MCPErrorCodes.TOOL_NOT_FOUND,
            message: `Tool not found: ${params.name}`
          }
        };
      }

      const result = await this.callTool(params.name, params.arguments);
      
      const response: ToolCallResponse = result;

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: response
      };

    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: MCPErrorCodes.TOOL_EXECUTION_ERROR,
          message: error instanceof Error ? error.message : 'Tool execution failed'
        }
      };
    }
  }

  /**
   * Initialize the server with enhanced setup
   * Similar to Python's initialize method
   */
  async initialize(): Promise<MCPServerInfo> {
    if (this.initialized) {
      console.log("✅ MCP Server already initialized");
      return this.serverInfo;
    }

    try {
      console.log("🚀 Initializing Enhanced MCP Server...");

      // Register all enhanced tools
      await this.registerEnhancedTools();

      // Create dynamic list_tools implementation
      await this.setupDynamicListTools();

      this.initialized = true;
      console.log(`✅ Enhanced MCP Server initialized with ${this.toolRegistry.getToolCount()} tools`);

      return this.serverInfo;

    } catch (error) {
      console.error("❌ Failed to initialize Enhanced MCP Server:", error);
      throw error;
    }
  }

  /**
   * Register all enhanced tools
   */
  private async registerEnhancedTools(): Promise<void> {
    console.log("🔧 Registering enhanced tools...");

    for (const tool of enhancedTools) {
      try {
        this.toolRegistry.registerTool(tool);
      } catch (error) {
        console.error(`❌ Failed to register tool ${tool.name}:`, error);
      }
    }

    console.log(`✅ Registered ${enhancedTools.length} enhanced tools`);
  }

  /**
   * Setup dynamic list_tools implementation
   */
  private async setupDynamicListTools(): Promise<void> {
    // Create a dynamic list_tools tool that returns current tools
    const dynamicListToolsTool = new Tool(
      'list_tools',
      'List all available MCP tools with their descriptions and schemas',
      {
        type: 'object',
        properties: {},
        required: []
      },
      async () => {
        const tools = this.toolRegistry.getToolsInfo();
        return {
          success: true,
          data: {
            tools: tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema,
              title: tool.title
            })),
            count: tools.length
          }
        };
      },
      'Tool Discovery'
    );

    // Replace the placeholder list_tools with the dynamic one
    this.toolRegistry.unregisterTool('list_tools');
    this.toolRegistry.registerTool(dynamicListToolsTool);
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.initialized) {
      throw new Error("Server not initialized. Call initialize() first.");
    }

    return this.toolRegistry.getToolsInfo();
  }

  /**
   * Call a tool with enhanced error handling and logging
   * Similar to Python's execute_tool method
   */
  async callTool(name: string, arguments_: any): Promise<MCPCallToolResult> {
    if (!this.initialized) {
      throw new Error("Server not initialized. Call initialize() first.");
    }

    try {
      console.log(`🔧 Calling tool: ${name}`, arguments_);

      const result = await this.toolRegistry.executeTool(name, arguments_);

      if (result.success) {
        console.log(`✅ Tool call successful: ${name}`);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result.data, null, 2),
            data: result.data
          }]
        };
      } else {
        console.warn(`❌ Tool call failed: ${name} - ${result.error}`);
        return {
          content: [{
            type: "text",
            text: result.error || 'Tool execution failed'
          }],
          isError: true
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`💥 Tool call exception: ${name}`, error);
      
      return {
        content: [{
          type: "text",
          text: `Tool execution failed: ${errorMessage}`
        }],
        isError: true
      };
    }
  }

  /**
   * Register a new tool
   */
  registerTool(tool: Tool): void {
    if (!this.initialized) {
      console.warn("Server not initialized. Tool will be registered but may not be immediately available.");
    }

    this.toolRegistry.registerTool(tool);
    this.notifyListeners();
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    const result = this.toolRegistry.unregisterTool(name);
    if (result) {
      this.notifyListeners();
    }
    return result;
  }

  /**
   * Get tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.toolRegistry.getTool(name);
  }

  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.toolRegistry.hasTool(name);
  }

  /**
   * Get server statistics
   */
  getStats(): {
    initialized: boolean;
    toolCount: number;
    executionStats: any;
    serverInfo: MCPServerInfo;
  } {
    return {
      initialized: this.initialized,
      toolCount: this.toolRegistry.getToolCount(),
      executionStats: this.toolRegistry.getExecutionStats(),
      serverInfo: this.serverInfo
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): any[] {
    return this.toolRegistry.getExecutionHistory();
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.toolRegistry.clearHistory();
  }

  /**
   * Validate all tools
   */
  validateTools(): { valid: boolean; errors: Record<string, string[]> } {
    return this.toolRegistry.validateAllTools();
  }

  /**
   * Search tools
   */
  searchTools(query: string): Tool[] {
    return this.toolRegistry.searchTools(query);
  }

  /**
   * Register a listener for tool changes
   */
  onToolsChanged(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in tools changed listener:', error);
      }
    });
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.toolRegistry.getToolCount();
  }

  /**
   * Check if server has tools
   */
  hasTools(): boolean {
    return this.toolRegistry.hasTools();
  }

  /**
   * Get server info
   */
  getServerInfo(): MCPServerInfo {
    return { ...this.serverInfo };
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup server resources
   * Similar to Python's cleanup method
   */
  async cleanup(): Promise<void> {
    try {
      console.log("🧹 Cleaning up Enhanced MCP Server...");
      
      // Clear execution history
      this.toolRegistry.clearHistory();
      
      // Clear listeners
      this.listeners.clear();
      
      this.initialized = false;
      
      console.log("✅ Enhanced MCP Server cleanup completed");
      
    } catch (error) {
      console.error("❌ Error during server cleanup:", error);
    }
  }

  /**
   * Restart the server
   */
  async restart(): Promise<void> {
    console.log("🔄 Restarting Enhanced MCP Server...");
    
    await this.cleanup();
    await this.initialize();
    
    console.log("✅ Enhanced MCP Server restarted");
  }

  /**
   * Get tools for MCP standard format
   */
  getToolsForMCP(): any[] {
    return this.toolRegistry.getToolsForMCP();
  }

  /**
   * Health check
   */
  healthCheck(): {
    status: 'healthy' | 'unhealthy';
    initialized: boolean;
    toolCount: number;
    errors: string[];
    timestamp: string;
  } {
    const validation = this.toolRegistry.validateAllTools();
    const stats = this.toolRegistry.getExecutionStats();
    
    return {
      status: this.initialized && validation.valid ? 'healthy' : 'unhealthy',
      initialized: this.initialized,
      toolCount: this.toolRegistry.getToolCount(),
      errors: stats.recentErrors,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Global MCP server instance
 */
let globalMCPServer: MCPServer | null = null;

/**
 * Get the global MCP server instance
 */
export function getMCPServer(): MCPServer {
  if (!globalMCPServer) {
    globalMCPServer = new MCPServer();
  }
  return globalMCPServer;
}

/**
 * Reset the global MCP server (useful for testing)
 */
export function resetMCPServer(): void {
  if (globalMCPServer) {
    globalMCPServer.cleanup();
  }
  globalMCPServer = null;
}
