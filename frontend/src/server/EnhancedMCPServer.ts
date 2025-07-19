/**
 * Enhanced MCP Server following the Python implementation pattern
 * Integrates with the new architecture components
 */

import { getConfig } from '../config/Configuration';
import { ToolManager, getToolManager } from '../tools/ToolManager';
import { Tool } from '../tools/Tool';
import { enhancedTools } from '../tools/EnhancedTools';

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
export class EnhancedMCPServer {
  private toolManager: ToolManager;
  private listeners: Set<() => void> = new Set();
  private initialized = false;
  private config = getConfig();
  private serverInfo: MCPServerInfo;

  constructor() {
    this.toolManager = getToolManager();
    this.serverInfo = this.config.serverConfig;
    
    // Listen for tool changes
    this.toolManager.onToolsChanged(() => {
      this.notifyListeners();
    });
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
      console.log(`✅ Enhanced MCP Server initialized with ${this.toolManager.getToolCount()} tools`);

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
        this.toolManager.registerTool(tool);
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
        const tools = this.toolManager.getToolsInfo();
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
    this.toolManager.unregisterTool('list_tools');
    this.toolManager.registerTool(dynamicListToolsTool);
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.initialized) {
      throw new Error("Server not initialized. Call initialize() first.");
    }

    return this.toolManager.getToolsInfo();
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

      const result = await this.toolManager.executeTool(name, arguments_);

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

    this.toolManager.registerTool(tool);
    this.notifyListeners();
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    const result = this.toolManager.unregisterTool(name);
    if (result) {
      this.notifyListeners();
    }
    return result;
  }

  /**
   * Get tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.toolManager.getTool(name);
  }

  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.toolManager.hasTool(name);
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
      toolCount: this.toolManager.getToolCount(),
      executionStats: this.toolManager.getExecutionStats(),
      serverInfo: this.serverInfo
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): any[] {
    return this.toolManager.getExecutionHistory();
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.toolManager.clearHistory();
  }

  /**
   * Validate all tools
   */
  validateTools(): { valid: boolean; errors: Record<string, string[]> } {
    return this.toolManager.validateAllTools();
  }

  /**
   * Search tools
   */
  searchTools(query: string): Tool[] {
    return this.toolManager.searchTools(query);
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
    return this.toolManager.getToolCount();
  }

  /**
   * Check if server has tools
   */
  hasTools(): boolean {
    return this.toolManager.hasTools();
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
      this.toolManager.clearHistory();
      
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
    return this.toolManager.getToolsForMCP();
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
    const validation = this.toolManager.validateAllTools();
    const stats = this.toolManager.getExecutionStats();
    
    return {
      status: this.initialized && validation.valid ? 'healthy' : 'unhealthy',
      initialized: this.initialized,
      toolCount: this.toolManager.getToolCount(),
      errors: stats.recentErrors,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Global enhanced server instance
 */
let globalEnhancedServer: EnhancedMCPServer | null = null;

/**
 * Get the global enhanced server instance
 */
export function getEnhancedMCPServer(): EnhancedMCPServer {
  if (!globalEnhancedServer) {
    globalEnhancedServer = new EnhancedMCPServer();
  }
  return globalEnhancedServer;
}

/**
 * Reset the global enhanced server (useful for testing)
 */
export function resetEnhancedMCPServer(): void {
  if (globalEnhancedServer) {
    globalEnhancedServer.cleanup();
  }
  globalEnhancedServer = null;
}
