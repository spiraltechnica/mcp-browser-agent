/**
 * MCP Host following the Python implementation pattern
 * Integrates all the new architecture components
 */

import { MCPClient, SessionStats } from '../mcp/MCPClient';
import { MCPServer, getMCPServer } from '../mcp-server/MCPServer';
import { ToolRegistry, getToolRegistry } from '../mcp-server/ToolRegistry';
import { LLMClient, getLLMClient } from '../llm/LLMClient';
import { getConfig } from './HostConfiguration';

export interface AgentStats {
  isRunning: boolean;
  executionCount: number;
  errorCount: number;
  runtime: number;
  contextSize: number;
  sessionStats?: SessionStats;
}

/**
 * MCP Host that orchestrates the entire system
 * Similar to the Python main function and ChatSession orchestration
 */
export class MCPHost {
  private isActive = false;
  private mcpClient: MCPClient | null = null;
  private mcpServer: MCPServer;
  private toolRegistry: ToolRegistry;
  private llmClient: LLMClient;
  private onLog: (message: string) => void;
  private config = getConfig();
  private startTime = 0;

  constructor(onLog: (message: string) => void) {
    this.onLog = onLog;
    this.mcpServer = getMCPServer();
    this.toolRegistry = getToolRegistry();
    this.llmClient = getLLMClient();
  }

  /**
   * Start the enhanced agent
   * Similar to Python's main function initialization
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.log("Enhanced Agent is already running");
      return;
    }

    this.startTime = Date.now();
    this.log("🚀 Starting Enhanced MCP Agent...");

    try {
      // Initialize MCP server
      this.log("🔧 Initializing MCP server...");
      await this.mcpServer.initialize();
      this.log(`✅ MCP server initialized with ${this.mcpServer.getToolCount()} tools`);

      // Check LLM configuration
      if (!this.llmClient.isConfigured()) {
        this.log("⚠️ LLM client not configured. Some features may not work.");
      } else {
        this.log("✅ LLM client configured");
      }

      // Create MCP client
      this.log("💬 Creating MCP client...");
      this.mcpClient = new MCPClient(
        this.toolRegistry,
        this.llmClient,
        this.onLog
      );

      // Start the MCP client
      await this.mcpClient.start();

      this.isActive = true;
      this.log("✅ Enhanced MCP Agent started successfully");

      // Log system summary
      this.logSystemSummary();

    } catch (error) {
      this.log(`❌ Failed to start Enhanced Agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the enhanced agent
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      this.log("Enhanced Agent is not running");
      return;
    }

    this.log("🛑 Stopping Enhanced MCP Agent...");
    await this.cleanup();
    this.log("✅ Enhanced MCP Agent stopped");
  }

  /**
   * Process a user message through the MCP client
   */
  async processMessage(message: string): Promise<string> {
    if (!this.isActive || !this.mcpClient) {
      throw new Error("Agent is not active. Call start() first.");
    }

    try {
      return await this.mcpClient.processMessage(message);
    } catch (error) {
      this.log(`❌ Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    const runtime = Math.round((Date.now() - this.startTime) / 1000);
    const sessionStats = this.mcpClient?.getStats();
    const toolStats = this.toolRegistry.getExecutionStats();

    return {
      isRunning: this.isActive,
      executionCount: toolStats.totalExecutions,
      errorCount: toolStats.failedExecutions,
      runtime,
      contextSize: sessionStats?.messageCount || 0,
      sessionStats
    };
  }

  /**
   * Check if agent is active
   */
  isAgentActive(): boolean {
    return this.isActive;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): any[] {
    return this.mcpClient?.getConversationHistory() || [];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.mcpClient?.clearHistory();
    this.toolRegistry.clearHistory();
    this.log("🗑️ Agent history cleared");
  }

  /**
   * Get recent errors
   */
  getRecentErrors(): string[] {
    return this.mcpClient?.getRecentErrors() || [];
  }

  /**
   * Get tool execution history
   */
  getToolExecutionHistory(): any[] {
    return this.toolRegistry.getExecutionHistory();
  }

  /**
   * Get server health status
   */
  getHealthStatus(): any {
    return {
      agent: {
        isActive: this.isActive,
        runtime: Math.round((Date.now() - this.startTime) / 1000),
        hasSession: !!this.mcpClient
      },
      server: this.mcpServer.healthCheck(),
      llm: {
        configured: this.llmClient.isConfigured(),
        config: this.llmClient.getConfigSummary()
      },
      tools: this.toolRegistry.getExecutionStats(),
      config: this.config.getSummary()
    };
  }

  /**
   * Restart the agent
   */
  async restart(): Promise<void> {
    this.log("🔄 Restarting Enhanced MCP Agent...");
    
    await this.stop();
    await this.start();
    
    this.log("✅ Enhanced MCP Agent restarted");
  }

  /**
   * Add a custom tool to the agent
   */
  addTool(tool: any): void {
    this.mcpServer.registerTool(tool);
    
    // Update session system prompt if active
    if (this.mcpClient && this.isActive) {
      this.mcpClient.updateSystemPrompt();
    }
    
    this.log(`🔧 Tool added: ${tool.name}`);
  }

  /**
   * Remove a tool from the agent
   */
  removeTool(toolName: string): boolean {
    const result = this.mcpServer.unregisterTool(toolName);
    
    if (result) {
      // Update session system prompt if active
      if (this.mcpClient && this.isActive) {
        this.mcpClient.updateSystemPrompt();
      }
      
      this.log(`🗑️ Tool removed: ${toolName}`);
    }
    
    return result;
  }

  /**
   * Search available tools
   */
  searchTools(query: string): any[] {
    return this.mcpServer.searchTools(query).map(tool => ({
      name: tool.name,
      description: tool.description,
      title: tool.title
    }));
  }

  /**
   * Get available tools
   */
  getAvailableTools(): any[] {
    return this.toolRegistry.getToolsInfo();
  }

  /**
   * Execute a tool directly (for testing/debugging)
   */
  async executeTool(toolName: string, parameters: any): Promise<any> {
    if (!this.isActive) {
      throw new Error("Agent is not active");
    }

    return await this.toolRegistry.executeTool(toolName, parameters);
  }

  /**
   * Get system context summary
   */
  getSystemContext(): any {
    return {
      agent: this.getStats(),
      session: this.mcpClient?.getContextSummary(),
      server: this.mcpServer.getStats(),
      config: this.config.getSummary()
    };
  }

  /**
   * Log system summary
   */
  private logSystemSummary(): void {
    const stats = this.getStats();
    const health = this.getHealthStatus();
    
    this.log("📊 System Summary:");
    this.log(`   • Tools: ${health.server.toolCount}`);
    this.log(`   • LLM: ${health.llm.configured ? 'Configured' : 'Not configured'}`);
    this.log(`   • Server: ${health.server.status}`);
    this.log(`   • Runtime: ${stats.runtime}s`);
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.mcpClient) {
        this.mcpClient.stop();
        this.mcpClient = null;
      }

      // Don't cleanup global instances, just clear state
      this.toolRegistry.clearHistory();
      
      this.isActive = false;
      
    } catch (error) {
      this.log(`⚠️ Warning during cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    this.onLog(logMessage);
    console.log(logMessage);
  }
}

/**
 * Global MCP host instance
 */
let globalMCPHost: MCPHost | null = null;

/**
 * Create or get the MCP host instance
 */
export function createEnhancedAgent(onLog: (message: string) => void): MCPHost {
  if (globalMCPHost) {
    // Update the log function
    (globalMCPHost as any).onLog = onLog;
    return globalMCPHost;
  }
  
  globalMCPHost = new MCPHost(onLog);
  return globalMCPHost;
}

/**
 * Get the global MCP host instance
 */
export function getEnhancedAgent(): MCPHost | null {
  return globalMCPHost;
}

/**
 * Reset the global MCP host (useful for testing)
 */
export function resetEnhancedAgent(): void {
  if (globalMCPHost) {
    globalMCPHost.stop();
  }
  globalMCPHost = null;
}

/**
 * Start the MCP host (convenience function)
 */
export async function startEnhancedAgent(onLog: (message: string) => void): Promise<MCPHost> {
  const agent = createEnhancedAgent(onLog);
  await agent.start();
  return agent;
}

/**
 * Stop the MCP host (convenience function)
 */
export async function stopEnhancedAgent(): Promise<void> {
  if (globalMCPHost) {
    await globalMCPHost.stop();
  }
}

/**
 * Check if MCP host is running
 */
export function isEnhancedAgentRunning(): boolean {
  return globalMCPHost?.isAgentActive() || false;
}

/**
 * Get MCP host stats
 */
export function getEnhancedAgentStats(): AgentStats | null {
  return globalMCPHost?.getStats() || null;
}
