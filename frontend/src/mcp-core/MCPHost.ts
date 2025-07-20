/**
 * Pure MCP Host implementation following the official specification
 * Coordinates multiple MCP clients and aggregates MCP context
 * No application logic - pure MCP protocol coordination
 */

import { MCPClient } from './MCPClient';
import { 
  MCPCapabilities, 
  MCPServerInfo, 
  MCPTool 
} from './MCPProtocol';

export interface ServerConfig {
  name: string;
  version: string;
  capabilities: MCPCapabilities;
  transport?: any; // For future external server support
}

export interface MCPContext {
  availableTools: MCPTool[];
  serverCapabilities: MCPCapabilities[];
  serverStatus: ServerStatus[];
  aggregatedCapabilities: MCPCapabilities;
}

export interface ServerStatus {
  clientId: string;
  serverName: string;
  connected: boolean;
  toolCount: number;
  lastActivity: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  content?: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

/**
 * MCP Host - Multi-client coordinator following MCP specification
 * 
 * Responsibilities:
 * - Create and manage multiple MCP client instances
 * - Control client connection permissions and lifecycle
 * - Aggregate MCP context from all connected servers
 * - Route tool execution to appropriate clients
 * - Enforce security policies and boundaries
 */
export class MCPHost {
  private clients: Map<string, MCPClient> = new Map();
  private serverConfigs: Map<string, ServerConfig> = new Map();
  private capabilities: MCPCapabilities;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.capabilities = {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      sampling: {}
    };
  }

  /**
   * Add a new MCP server by creating a client connection
   */
  async addServer(config: ServerConfig): Promise<string> {
    const clientId = this.generateClientId();
    
    try {
      console.log(`🔌 MCPHost: Adding server "${config.name}"`);
      
      const client = new MCPClient(config.name);
      await client.initialize();
      
      this.clients.set(clientId, client);
      this.serverConfigs.set(clientId, config);
      
      console.log(`✅ MCPHost: Server "${config.name}" connected with client ID: ${clientId}`);
      this.notifyListeners();
      
      return clientId;
      
    } catch (error) {
      console.error(`❌ MCPHost: Failed to add server "${config.name}":`, error);
      throw error;
    }
  }

  /**
   * Remove an MCP server and disconnect its client
   */
  async removeServer(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    const config = this.serverConfigs.get(clientId);
    
    if (!client || !config) {
      throw new Error(`Client not found: ${clientId}`);
    }

    try {
      console.log(`🔌 MCPHost: Removing server "${config.name}"`);
      
      await client.disconnect();
      this.clients.delete(clientId);
      this.serverConfigs.delete(clientId);
      
      console.log(`✅ MCPHost: Server "${config.name}" disconnected`);
      this.notifyListeners();
      
    } catch (error) {
      console.error(`❌ MCPHost: Failed to remove server "${config.name}":`, error);
      throw error;
    }
  }

  /**
   * Get aggregated MCP context from all connected servers
   */
  async getMCPContext(): Promise<MCPContext> {
    const allTools: MCPTool[] = [];
    const serverCapabilities: MCPCapabilities[] = [];
    const serverStatus: ServerStatus[] = [];

    console.log(`🔧 DEBUG MCPHost: Getting context from ${this.clients.size} clients`);

    for (const [clientId, client] of this.clients.entries()) {
      const config = this.serverConfigs.get(clientId)!;
      
      try {
        console.log(`🔧 DEBUG MCPHost: Getting tools from client "${config.name}" (${clientId})`);
        console.log(`🔧 DEBUG MCPHost: Client connected: ${client.isConnected()}, healthy: ${client.isHealthy()}`);
        
        // Get tools from this client
        const tools = await client.listTools();
        console.log(`🔧 DEBUG MCPHost: Retrieved ${tools.length} tools from "${config.name}"`);
        console.log(`🔧 DEBUG MCPHost: Tool names: [${tools.map(t => t.name).join(', ')}]`);
        
        allTools.push(...tools);
        
        // Get capabilities
        const capabilities = client.getServerCapabilities();
        serverCapabilities.push(capabilities);
        
        // Get status
        const status: ServerStatus = {
          clientId,
          serverName: config.name,
          connected: client.isConnected(),
          toolCount: tools.length,
          lastActivity: new Date().toISOString(),
          health: client.isHealthy() ? 'healthy' : 'unhealthy'
        };
        serverStatus.push(status);
        
      } catch (error) {
        console.error(`❌ MCPHost: Failed to get context from server "${config.name}":`, error);
        
        // Add error status
        serverStatus.push({
          clientId,
          serverName: config.name,
          connected: false,
          toolCount: 0,
          lastActivity: new Date().toISOString(),
          health: 'unhealthy'
        });
      }
    }

    console.log(`🔧 DEBUG MCPHost: Total aggregated tools: ${allTools.length}`);
    console.log(`🔧 DEBUG MCPHost: Aggregated tool names: [${allTools.map(t => t.name).join(', ')}]`);

    return {
      availableTools: allTools,
      serverCapabilities,
      serverStatus,
      aggregatedCapabilities: this.aggregateCapabilities(serverCapabilities)
    };
  }

  /**
   * Get all available tools from all connected servers
   */
  async getAllTools(): Promise<MCPTool[]> {
    const context = await this.getMCPContext();
    return context.availableTools;
  }

  /**
   * Execute a tool by routing to the appropriate client
   */
  async executeTool(toolName: string, args: any): Promise<ToolResult> {
    console.log(`🔧 MCPHost: Executing tool "${toolName}"`);
    
    // Find the client that has this tool
    for (const [clientId, client] of this.clients.entries()) {
      const config = this.serverConfigs.get(clientId)!;
      
      try {
        const tools = await client.listTools();
        const hasTool = tools.some((tool: MCPTool) => tool.name === toolName);
        
        if (hasTool) {
          console.log(`🎯 MCPHost: Routing tool "${toolName}" to server "${config.name}"`);
          const mcpResponse = await client.executeTool(toolName, args);
          console.log(`✅ MCPHost: Tool "${toolName}" executed successfully`);
          
          // Convert MCP ToolCallResponse to our ToolResult format
          const result: ToolResult = {
            success: !mcpResponse.isError,
            content: mcpResponse.content,
            isError: mcpResponse.isError
          };

          // Extract data from content if available
          if (mcpResponse.content && mcpResponse.content.length > 0) {
            const firstContent = mcpResponse.content[0];
            if (firstContent.data) {
              result.data = firstContent.data;
            }
            if (firstContent.text && mcpResponse.isError) {
              result.error = firstContent.text;
            }
          }

          return result;
        }
        
      } catch (error) {
        console.error(`❌ MCPHost: Error checking tools for server "${config.name}":`, error);
        continue;
      }
    }

    throw new Error(`Tool not found: ${toolName}`);
  }

  /**
   * Get server status for all connected servers
   */
  async getServerStatus(): Promise<ServerStatus[]> {
    const context = await this.getMCPContext();
    return context.serverStatus;
  }

  /**
   * Get aggregated capabilities from all servers
   */
  getAggregatedCapabilities(): MCPCapabilities {
    const serverCapabilities = Array.from(this.clients.values())
      .map(client => client.getServerCapabilities());
    
    return this.aggregateCapabilities(serverCapabilities);
  }

  /**
   * Check if any servers are connected
   */
  hasConnectedServers(): boolean {
    return this.clients.size > 0;
  }

  /**
   * Get count of connected servers
   */
  getServerCount(): number {
    return this.clients.size;
  }

  /**
   * Get list of connected server names
   */
  getConnectedServerNames(): string[] {
    return Array.from(this.serverConfigs.values()).map(config => config.name);
  }

  /**
   * Health check for all servers
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy' | 'partial';
    serverCount: number;
    healthyServers: number;
    errors: string[];
  }> {
    const serverStatus = await this.getServerStatus();
    const healthyServers = serverStatus.filter(s => s.health === 'healthy').length;
    const errors = serverStatus
      .filter(s => s.health === 'unhealthy')
      .map(s => `Server ${s.serverName} is unhealthy`);

    let status: 'healthy' | 'unhealthy' | 'partial';
    if (healthyServers === serverStatus.length) {
      status = 'healthy';
    } else if (healthyServers === 0) {
      status = 'unhealthy';
    } else {
      status = 'partial';
    }

    return {
      status,
      serverCount: this.clients.size,
      healthyServers,
      errors
    };
  }

  /**
   * Register a listener for server changes
   */
  onServersChanged(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Cleanup all connections
   */
  async cleanup(): Promise<void> {
    console.log('🧹 MCPHost: Cleaning up all connections...');
    
    const disconnectPromises = Array.from(this.clients.entries()).map(
      async ([clientId, client]) => {
        try {
          await client.disconnect();
        } catch (error) {
          console.error(`Error disconnecting client ${clientId}:`, error);
        }
      }
    );

    await Promise.all(disconnectPromises);
    
    this.clients.clear();
    this.serverConfigs.clear();
    this.listeners.clear();
    
    console.log('✅ MCPHost: Cleanup completed');
  }

  /**
   * Private helper methods
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private aggregateCapabilities(capabilities: MCPCapabilities[]): MCPCapabilities {
    const aggregated: MCPCapabilities = {
      tools: {},
      resources: {},
      prompts: {},
      sampling: {}
    };

    for (const cap of capabilities) {
      if (cap.tools) {
        aggregated.tools = { ...aggregated.tools, ...cap.tools };
      }
      if (cap.resources) {
        aggregated.resources = { ...aggregated.resources, ...cap.resources };
      }
      if (cap.prompts) {
        aggregated.prompts = { ...aggregated.prompts, ...cap.prompts };
      }
      if (cap.sampling) {
        aggregated.sampling = { ...aggregated.sampling, ...cap.sampling };
      }
    }

    return aggregated;
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in server change listener:', error);
      }
    });
  }
}

/**
 * Global MCP host instance
 */
let globalMCPHost: MCPHost | null = null;

/**
 * Get the global MCP host instance
 */
export function getMCPHost(): MCPHost {
  if (!globalMCPHost) {
    globalMCPHost = new MCPHost();
  }
  return globalMCPHost;
}

/**
 * Reset the global MCP host (useful for testing)
 */
export async function resetMCPHost(): Promise<void> {
  if (globalMCPHost) {
    await globalMCPHost.cleanup();
  }
  globalMCPHost = null;
}
