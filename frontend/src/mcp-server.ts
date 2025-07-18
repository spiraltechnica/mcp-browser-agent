import { MCPTool, toolRegistry } from './tools';

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
}

export interface MCPCallToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

export class BrowserMCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  constructor() {
    // Register built-in tools
    Object.entries(toolRegistry).forEach(([name, tool]) => {
      this.tools.set(name, tool);
    });
  }

  async initialize(): Promise<MCPServerInfo> {
    this.initialized = true;
    return {
      name: "browser-mcp-server",
      version: "1.0.0",
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true }
      }
    };
  }

  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.initialized) {
      throw new Error("Server not initialized");
    }

    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async callTool(name: string, arguments_: any): Promise<MCPCallToolResult> {
    if (!this.initialized) {
      throw new Error("Server not initialized");
    }

    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{
          type: "text",
          text: `Tool '${name}' not found`
        }],
        isError: true
      };
    }

    try {
      const result = await tool.handler(arguments_);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
          data: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    this.notifyListeners();
  }

  unregisterTool(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      this.notifyListeners();
    }
    return deleted;
  }

  onToolsChanged(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in tools changed listener:', error);
      }
    });
  }

  getToolCount(): number {
    return this.tools.size;
  }

  hasTools(): boolean {
    return this.tools.size > 0;
  }
}
