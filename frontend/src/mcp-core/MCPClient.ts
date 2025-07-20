/**
 * Pure MCP Client implementation following the official specification
 * Handles protocol communication with a single MCP server
 * No application logic - pure protocol handling
 */

import { getMCPTransport } from './MCPTransport';
import { 
  MCPMethods, 
  MCPCapabilities, 
  MCPServerInfo, 
  MCPClientInfo,
  MCPTool,
  InitializeRequest,
  InitializeResponse,
  ToolsListResponse,
  ToolCallRequest,
  ToolCallResponse
} from './MCPProtocol';

/**
 * MCP Client - Protocol communication with single server
 * 
 * Responsibilities:
 * - Establish stateful session with one MCP server
 * - Handle protocol negotiation and capability exchange
 * - Route protocol messages bidirectionally
 * - Manage subscriptions and notifications
 * - Maintain security boundaries
 */
export class MCPClient {
  private serverName: string;
  private serverCapabilities: MCPCapabilities = {};
  private clientCapabilities: MCPCapabilities;
  private sessionId: string;
  private connected = false;
  private healthy = true;
  private lastActivity = Date.now();

  constructor(serverName: string) {
    this.serverName = serverName;
    this.sessionId = this.generateSessionId();
    
    // Define client capabilities
    this.clientCapabilities = {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      sampling: {}
    };
  }

  /**
   * Initialize the MCP client connection
   */
  async initialize(): Promise<void> {
    try {
      console.log(`🔌 MCPClient: Initializing connection to "${this.serverName}"`);
      
      // For browser-based servers, we'll use the transport to connect to our internal server
      const transport = getMCPTransport();
      
      // Send initialize request
      const initRequest: InitializeRequest = {
        protocolVersion: "2025-06-18",
        capabilities: this.clientCapabilities,
        clientInfo: {
          name: "mcp-browser-client",
          version: "1.0.0",
          capabilities: this.clientCapabilities
        }
      };

      const initResponse: InitializeResponse = await transport.sendRequest(
        MCPMethods.INITIALIZE, 
        initRequest
      );

      // Store server capabilities
      this.serverCapabilities = initResponse.capabilities;
      this.connected = true;
      this.healthy = true;
      this.updateActivity();

      console.log(`✅ MCPClient: Connected to "${this.serverName}" with capabilities:`, this.serverCapabilities);

    } catch (error) {
      console.error(`❌ MCPClient: Failed to initialize connection to "${this.serverName}":`, error);
      this.connected = false;
      this.healthy = false;
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    try {
      console.log(`🔌 MCPClient: Disconnecting from "${this.serverName}"`);
      
      // For browser implementation, we don't need to send a disconnect message
      // Just mark as disconnected
      this.connected = false;
      this.healthy = false;
      
      console.log(`✅ MCPClient: Disconnected from "${this.serverName}"`);
      
    } catch (error) {
      console.error(`❌ MCPClient: Error disconnecting from "${this.serverName}":`, error);
      this.connected = false;
      this.healthy = false;
    }
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.connected) {
      throw new Error(`Client not connected to "${this.serverName}"`);
    }

    try {
      console.log(`🔧 MCPClient: Listing tools from "${this.serverName}"`);
      
      const transport = getMCPTransport();
      const response: ToolsListResponse = await transport.sendRequest(MCPMethods.TOOLS_LIST);
      
      this.updateActivity();
      console.log(`✅ MCPClient: Retrieved ${response.tools.length} tools from "${this.serverName}"`);
      
      return response.tools;
      
    } catch (error) {
      console.error(`❌ MCPClient: Failed to list tools from "${this.serverName}":`, error);
      this.markUnhealthy();
      throw error;
    }
  }

  /**
   * Execute a tool on the server
   * Returns pure MCP protocol response
   */
  async executeTool(toolName: string, args: any): Promise<ToolCallResponse> {
    if (!this.connected) {
      throw new Error(`Client not connected to "${this.serverName}"`);
    }

    try {
      console.log(`🔧 MCPClient: Executing tool "${toolName}" on "${this.serverName}"`);
      
      const transport = getMCPTransport();
      const request: ToolCallRequest = {
        name: toolName,
        arguments: args
      };

      const response: ToolCallResponse = await transport.sendRequest(
        MCPMethods.TOOLS_CALL, 
        request
      );

      this.updateActivity();
      console.log(`✅ MCPClient: Tool "${toolName}" executed on "${this.serverName}"`);
      
      return response;
      
    } catch (error) {
      console.error(`❌ MCPClient: Failed to execute tool "${toolName}" on "${this.serverName}":`, error);
      this.markUnhealthy();
      
      // Return error response in MCP format
      return {
        content: [{
          type: "text",
          text: error instanceof Error ? error.message : 'Unknown error'
        }],
        isError: true
      };
    }
  }

  /**
   * Get server capabilities
   */
  getServerCapabilities(): MCPCapabilities {
    return { ...this.serverCapabilities };
  }

  /**
   * Get client capabilities
   */
  getClientCapabilities(): MCPCapabilities {
    return { ...this.clientCapabilities };
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Check if client is healthy
   */
  isHealthy(): boolean {
    return this.healthy && this.connected;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }


  /**
   * Get last activity timestamp
   */
  getLastActivity(): number {
    return this.lastActivity;
  }

  /**
   * Get connection status summary
   */
  getStatus(): {
    connected: boolean;
    healthy: boolean;
    serverName: string;
    sessionId: string;
    lastActivity: string;
    capabilities: MCPCapabilities;
  } {
    return {
      connected: this.connected,
      healthy: this.healthy,
      serverName: this.serverName,
      sessionId: this.sessionId,
      lastActivity: new Date(this.lastActivity).toISOString(),
      capabilities: this.serverCapabilities
    };
  }

  /**
   * Ping the server to check health
   */
  async ping(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      // Use tools/list as a ping mechanism
      await this.listTools();
      this.healthy = true;
      return true;
      
    } catch (error) {
      console.warn(`⚠️ MCPClient: Ping failed for "${this.serverName}":`, error);
      this.markUnhealthy();
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateActivity(): void {
    this.lastActivity = Date.now();
    this.healthy = true;
  }

  private markUnhealthy(): void {
    this.healthy = false;
    console.warn(`⚠️ MCPClient: Marking "${this.serverName}" as unhealthy`);
  }

  /**
   * Handle server notifications (future feature)
   */
  private handleNotification(method: string, params: any): void {
    console.log(`📢 MCPClient: Received notification from "${this.serverName}":`, method, params);
    
    // Handle different notification types
    switch (method) {
      case 'notifications/tools/list_changed':
        // Tools list has changed
        console.log(`🔧 MCPClient: Tools list changed on "${this.serverName}"`);
        break;
        
      case 'notifications/resources/list_changed':
        // Resources list has changed
        console.log(`📁 MCPClient: Resources list changed on "${this.serverName}"`);
        break;
        
      default:
        console.log(`📢 MCPClient: Unknown notification type: ${method}`);
    }
  }

  /**
   * Subscribe to server notifications (future feature)
   */
  async subscribe(notificationType: string): Promise<void> {
    if (!this.connected) {
      throw new Error(`Client not connected to "${this.serverName}"`);
    }

    // Future implementation for subscription management
    console.log(`📢 MCPClient: Subscribing to ${notificationType} on "${this.serverName}"`);
  }

  /**
   * Unsubscribe from server notifications (future feature)
   */
  async unsubscribe(notificationType: string): Promise<void> {
    if (!this.connected) {
      throw new Error(`Client not connected to "${this.serverName}"`);
    }

    // Future implementation for subscription management
    console.log(`📢 MCPClient: Unsubscribing from ${notificationType} on "${this.serverName}"`);
  }
}
