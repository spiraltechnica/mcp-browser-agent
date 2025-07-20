/**
 * Agent Manager for handling multiple agent instances
 * Manages the lifecycle and coordination of multiple Enhanced Agents
 */

import { MCPHost } from './MCPHost';
import { ToolRegistry, getToolRegistry } from '../mcp-server/ToolRegistry';
import { MCPServer, getMCPServer } from '../mcp-server/MCPServer';
import { LLMClient, getLLMClient } from '../llm/LLMClient';

export interface AgentInstance {
  id: string;
  name: string;
  agent: MCPHost;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface AgentManagerStats {
  totalAgents: number;
  activeAgents: number;
  totalExecutions: number;
  totalErrors: number;
  uptime: number;
}

/**
 * Manages multiple agent instances with shared resources
 */
export class AgentManager {
  private agents: Map<string, AgentInstance> = new Map();
  private sharedToolRegistry: ToolRegistry;
  private sharedMCPServer: MCPServer;
  private sharedLLMClient: LLMClient;
  private onLog: (agentId: string, message: string) => void;
  private startTime = Date.now();
  private maxAgents = 5; // Reasonable limit

  constructor(onLog: (agentId: string, message: string) => void) {
    this.onLog = onLog;
    this.sharedToolRegistry = getToolRegistry();
    this.sharedMCPServer = getMCPServer();
    this.sharedLLMClient = getLLMClient();
  }

  /**
   * Create a new agent instance
   */
  async createAgent(name?: string): Promise<string> {
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Maximum number of agents (${this.maxAgents}) reached`);
    }

    const agentId = this.generateAgentId();
    const agentName = name || `Agent ${this.agents.size + 1}`;

    this.log(agentId, `🚀 Creating new agent: ${agentName}`);

    try {
      // Create agent with instance-specific logging
      const agent = new MCPHost((message: string) => {
        this.onLog(agentId, message);
      });

      const agentInstance: AgentInstance = {
        id: agentId,
        name: agentName,
        agent,
        isActive: false,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.agents.set(agentId, agentInstance);
      this.log(agentId, `✅ Agent created successfully: ${agentName}`);

      return agentId;
    } catch (error) {
      this.log(agentId, `❌ Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Start an agent
   */
  async startAgent(agentId: string): Promise<void> {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (instance.isActive) {
      this.log(agentId, `⚠️ Agent ${instance.name} is already active`);
      return;
    }

    try {
      await instance.agent.start();
      instance.isActive = true;
      instance.lastActivity = new Date();
      this.log(agentId, `✅ Agent ${instance.name} started successfully`);
    } catch (error) {
      this.log(agentId, `❌ Failed to start agent ${instance.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<void> {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!instance.isActive) {
      this.log(agentId, `⚠️ Agent ${instance.name} is already stopped`);
      return;
    }

    try {
      await instance.agent.stop();
      instance.isActive = false;
      instance.lastActivity = new Date();
      this.log(agentId, `🛑 Agent ${instance.name} stopped successfully`);
    } catch (error) {
      this.log(agentId, `❌ Failed to stop agent ${instance.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Remove an agent instance
   */
  async removeAgent(agentId: string): Promise<void> {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      // Stop the agent if it's active
      if (instance.isActive) {
        await this.stopAgent(agentId);
      }

      this.agents.delete(agentId);
      this.log(agentId, `🗑️ Agent ${instance.name} removed successfully`);
    } catch (error) {
      this.log(agentId, `❌ Failed to remove agent ${instance.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Process a message with a specific agent
   */
  async processMessage(agentId: string, message: string): Promise<string> {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (!instance.isActive) {
      throw new Error(`Agent ${instance.name} is not active. Start the agent first.`);
    }

    try {
      instance.lastActivity = new Date();
      const response = await instance.agent.processMessage(message);
      return response;
    } catch (error) {
      this.log(agentId, `❌ Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get agent instance
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agent instances
   */
  getAllAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get active agents
   */
  getActiveAgents(): AgentInstance[] {
    return Array.from(this.agents.values()).filter(agent => agent.isActive);
  }

  /**
   * Rename an agent
   */
  renameAgent(agentId: string, newName: string): void {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const oldName = instance.name;
    instance.name = newName;
    this.log(agentId, `📝 Agent renamed from "${oldName}" to "${newName}"`);
  }

  /**
   * Get agent statistics
   */
  getAgentStats(agentId: string): any {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return {
      ...instance.agent.getStats(),
      name: instance.name,
      createdAt: instance.createdAt,
      lastActivity: instance.lastActivity
    };
  }

  /**
   * Get manager statistics
   */
  getManagerStats(): AgentManagerStats {
    const agents = Array.from(this.agents.values());
    const activeAgents = agents.filter(a => a.isActive);
    
    let totalExecutions = 0;
    let totalErrors = 0;
    
    agents.forEach(instance => {
      const stats = instance.agent.getStats();
      totalExecutions += stats.executionCount;
      totalErrors += stats.errorCount;
    });

    return {
      totalAgents: this.agents.size,
      activeAgents: activeAgents.length,
      totalExecutions,
      totalErrors,
      uptime: Math.round((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * Stop all agents
   */
  async stopAllAgents(): Promise<void> {
    const activeAgents = this.getActiveAgents();
    
    for (const instance of activeAgents) {
      try {
        await this.stopAgent(instance.id);
      } catch (error) {
        this.log(instance.id, `❌ Error stopping agent during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Clear conversation history for an agent
   */
  clearAgentHistory(agentId: string): void {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    instance.agent.clearHistory();
    this.log(agentId, `🗑️ Conversation history cleared for ${instance.name}`);
  }

  /**
   * Get conversation history for an agent
   */
  getAgentHistory(agentId: string): any[] {
    const instance = this.agents.get(agentId);
    if (!instance) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return instance.agent.getConversationHistory();
  }

  /**
   * Check if agent exists
   */
  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get shared resources status
   */
  getSharedResourcesStatus(): any {
    return {
      toolRegistry: {
        toolCount: this.sharedToolRegistry.getToolCount(),
        executionStats: this.sharedToolRegistry.getExecutionStats()
      },
      mcpServer: {
        status: this.sharedMCPServer.healthCheck(),
        stats: this.sharedMCPServer.getStats()
      },
      llmClient: {
        configured: this.sharedLLMClient.isConfigured(),
        config: this.sharedLLMClient.getConfigSummary()
      }
    };
  }

  /**
   * Set maximum number of agents
   */
  setMaxAgents(max: number): void {
    if (max < 1) {
      throw new Error('Maximum agents must be at least 1');
    }
    
    this.maxAgents = max;
    this.log('manager', `📊 Maximum agents set to ${max}`);
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log message with agent context
   */
  private log(agentId: string, message: string): void {
    this.onLog(agentId, message);
  }
}

/**
 * Global agent manager instance
 */
let globalAgentManager: AgentManager | null = null;

/**
 * Create or get the agent manager instance
 */
export function createAgentManager(onLog: (agentId: string, message: string) => void): AgentManager {
  if (globalAgentManager) {
    // Update the log function
    (globalAgentManager as any).onLog = onLog;
    return globalAgentManager;
  }
  
  globalAgentManager = new AgentManager(onLog);
  return globalAgentManager;
}

/**
 * Get the global agent manager instance
 */
export function getAgentManager(): AgentManager | null {
  return globalAgentManager;
}

/**
 * Reset the global agent manager (useful for testing)
 */
export async function resetAgentManager(): Promise<void> {
  if (globalAgentManager) {
    await globalAgentManager.stopAllAgents();
  }
  globalAgentManager = null;
}
