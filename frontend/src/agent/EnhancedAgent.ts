/**
 * Enhanced Agent following the Python implementation pattern
 * Integrates all the new architecture components
 */

import { ChatSession, SessionStats } from '../session/ChatSession';
import { EnhancedMCPServer, getEnhancedMCPServer } from '../server/EnhancedMCPServer';
import { ToolManager, getToolManager } from '../tools/ToolManager';
import { LLMClient, getLLMClient } from '../llm/LLMClient';
import { getConfig } from '../config/Configuration';

export interface AgentStats {
  isRunning: boolean;
  executionCount: number;
  errorCount: number;
  runtime: number;
  contextSize: number;
  sessionStats?: SessionStats;
}

/**
 * Enhanced Agent that orchestrates the entire system
 * Similar to the Python main function and ChatSession orchestration
 */
export class EnhancedAgent {
  private isActive = false;
  private chatSession: ChatSession | null = null;
  private mcpServer: EnhancedMCPServer;
  private toolManager: ToolManager;
  private llmClient: LLMClient;
  private onLog: (message: string) => void;
  private config = getConfig();
  private startTime = 0;

  constructor(onLog: (message: string) => void) {
    this.onLog = onLog;
    this.mcpServer = getEnhancedMCPServer();
    this.toolManager = getToolManager();
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

      // Create chat session
      this.log("💬 Creating chat session...");
      this.chatSession = new ChatSession(
        this.toolManager,
        this.llmClient,
        this.onLog
      );

      // Start the chat session
      await this.chatSession.start();

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
   * Process a user message through the chat session
   */
  async processMessage(message: string): Promise<string> {
    if (!this.isActive || !this.chatSession) {
      throw new Error("Agent is not active. Call start() first.");
    }

    try {
      return await this.chatSession.processMessage(message);
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
    const sessionStats = this.chatSession?.getStats();
    const toolStats = this.toolManager.getExecutionStats();

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
    return this.chatSession?.getConversationHistory() || [];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.chatSession?.clearHistory();
    this.toolManager.clearHistory();
    this.log("🗑️ Agent history cleared");
  }

  /**
   * Get recent errors
   */
  getRecentErrors(): string[] {
    return this.chatSession?.getRecentErrors() || [];
  }

  /**
   * Get tool execution history
   */
  getToolExecutionHistory(): any[] {
    return this.toolManager.getExecutionHistory();
  }

  /**
   * Get server health status
   */
  getHealthStatus(): any {
    return {
      agent: {
        isActive: this.isActive,
        runtime: Math.round((Date.now() - this.startTime) / 1000),
        hasSession: !!this.chatSession
      },
      server: this.mcpServer.healthCheck(),
      llm: {
        configured: this.llmClient.isConfigured(),
        config: this.llmClient.getConfigSummary()
      },
      tools: this.toolManager.getExecutionStats(),
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
    if (this.chatSession && this.isActive) {
      this.chatSession.updateSystemPrompt();
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
      if (this.chatSession && this.isActive) {
        this.chatSession.updateSystemPrompt();
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
    return this.toolManager.getToolsInfo();
  }

  /**
   * Execute a tool directly (for testing/debugging)
   */
  async executeTool(toolName: string, parameters: any): Promise<any> {
    if (!this.isActive) {
      throw new Error("Agent is not active");
    }

    return await this.toolManager.executeTool(toolName, parameters);
  }

  /**
   * Get system context summary
   */
  getSystemContext(): any {
    return {
      agent: this.getStats(),
      session: this.chatSession?.getContextSummary(),
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
      if (this.chatSession) {
        this.chatSession.stop();
        this.chatSession = null;
      }

      // Don't cleanup global instances, just clear state
      this.toolManager.clearHistory();
      
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
 * Global enhanced agent instance
 */
let globalEnhancedAgent: EnhancedAgent | null = null;

/**
 * Create or get the enhanced agent instance
 */
export function createEnhancedAgent(onLog: (message: string) => void): EnhancedAgent {
  if (globalEnhancedAgent) {
    // Update the log function
    (globalEnhancedAgent as any).onLog = onLog;
    return globalEnhancedAgent;
  }
  
  globalEnhancedAgent = new EnhancedAgent(onLog);
  return globalEnhancedAgent;
}

/**
 * Get the global enhanced agent instance
 */
export function getEnhancedAgent(): EnhancedAgent | null {
  return globalEnhancedAgent;
}

/**
 * Reset the global enhanced agent (useful for testing)
 */
export function resetEnhancedAgent(): void {
  if (globalEnhancedAgent) {
    globalEnhancedAgent.stop();
  }
  globalEnhancedAgent = null;
}

/**
 * Start the enhanced agent (convenience function)
 */
export async function startEnhancedAgent(onLog: (message: string) => void): Promise<EnhancedAgent> {
  const agent = createEnhancedAgent(onLog);
  await agent.start();
  return agent;
}

/**
 * Stop the enhanced agent (convenience function)
 */
export async function stopEnhancedAgent(): Promise<void> {
  if (globalEnhancedAgent) {
    await globalEnhancedAgent.stop();
  }
}

/**
 * Check if enhanced agent is running
 */
export function isEnhancedAgentRunning(): boolean {
  return globalEnhancedAgent?.isAgentActive() || false;
}

/**
 * Get enhanced agent stats
 */
export function getEnhancedAgentStats(): AgentStats | null {
  return globalEnhancedAgent?.getStats() || null;
}
