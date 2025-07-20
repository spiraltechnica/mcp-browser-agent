/**
 * Multi-Agent Manager - Manages multiple ApplicationHost instances
 * Provides shared MCP infrastructure with independent conversations
 * Application-level multi-agent coordination
 */

import { ApplicationHost, ApplicationStats } from './ApplicationHost';
import { getMCPHost } from '../mcp-core/MCPHost';
import { Message } from './ConversationManager';

export interface AgentInfo {
  id: string;
  name: string;
  created: number;
  lastActivity: number;
  isActive: boolean;
  stats: ApplicationStats;
}

export interface MultiAgentStats {
  totalAgents: number;
  activeAgents: number;
  totalMessages: number;
  totalErrors: number;
  sharedMCPServers: number;
  uptime: number;
}

/**
 * Manages multiple AI agents with shared MCP infrastructure
 * Each agent has independent conversation but shares tools
 */
export class MultiAgentManager {
  private agents: Map<string, ApplicationHost> = new Map();
  private agentInfo: Map<string, AgentInfo> = new Map();
  private sharedMCPHost = getMCPHost();
  private startTime = Date.now();
  private onLog: (message: string) => void;
  private maxAgents = 5;

  constructor(onLog: (message: string) => void) {
    this.onLog = onLog;
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

    try {
      this.log(`🤖 Creating agent: ${agentName} (${agentId})`);

      // Create new ApplicationHost instance
      const agent = new ApplicationHost((message: string) => {
        // Prefix agent logs with agent name
        this.onLog(`[${agentName}] ${message}`);
      });

      // Store agent and info
      this.agents.set(agentId, agent);
      this.agentInfo.set(agentId, {
        id: agentId,
        name: agentName,
        created: Date.now(),
        lastActivity: Date.now(),
        isActive: false,
        stats: agent.getStats()
      });

      this.log(`✅ Agent created: ${agentName} (${agentId})`);
      return agentId;

    } catch (error) {
      this.log(`❌ Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Start an agent
   */
  async startAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    const info = this.agentInfo.get(agentId);

    if (!agent || !info) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    try {
      this.log(`▶️ Starting agent: ${info.name} (${agentId})`);

      await agent.initialize();
      
      // Update agent info
      info.isActive = true;
      info.lastActivity = Date.now();
      info.stats = agent.getStats();

      this.log(`✅ Agent started: ${info.name} (${agentId})`);

    } catch (error) {
      this.log(`❌ Failed to start agent ${info.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    const info = this.agentInfo.get(agentId);

    if (!agent || !info) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    try {
      this.log(`⏹️ Stopping agent: ${info.name} (${agentId})`);

      await agent.stop();
      
      // Update agent info
      info.isActive = false;
      info.lastActivity = Date.now();
      info.stats = agent.getStats();

      this.log(`✅ Agent stopped: ${info.name} (${agentId})`);

    } catch (error) {
      this.log(`❌ Failed to stop agent ${info.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Remove an agent
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    const info = this.agentInfo.get(agentId);

    if (!agent || !info) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    try {
      this.log(`🗑️ Removing agent: ${info.name} (${agentId})`);

      // Stop agent if running
      if (info.isActive) {
        await agent.stop();
      }

      // Remove from maps
      this.agents.delete(agentId);
      this.agentInfo.delete(agentId);

      this.log(`✅ Agent removed: ${info.name} (${agentId})`);

    } catch (error) {
      this.log(`❌ Failed to remove agent ${info.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Process a message for a specific agent
   */
  async processMessage(agentId: string, message: string): Promise<string> {
    const agent = this.agents.get(agentId);
    const info = this.agentInfo.get(agentId);

    if (!agent || !info) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (!info.isActive) {
      throw new Error(`Agent is not active: ${info.name}`);
    }

    try {
      // Process message through agent
      const response = await agent.processMessage(message);
      
      // Update agent info
      info.lastActivity = Date.now();
      info.stats = agent.getStats();

      return response;

    } catch (error) {
      this.log(`❌ Error processing message for agent ${info.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Rename an agent
   */
  renameAgent(agentId: string, newName: string): void {
    const info = this.agentInfo.get(agentId);

    if (!info) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const oldName = info.name;
    info.name = newName;
    
    this.log(`📝 Agent renamed: ${oldName} → ${newName} (${agentId})`);
  }

  /**
   * Get agent information
   */
  getAgentInfo(agentId: string): AgentInfo | undefined {
    const info = this.agentInfo.get(agentId);
    if (!info) return undefined;

    const agent = this.agents.get(agentId);
    if (agent) {
      // Update stats
      info.stats = agent.getStats();
    }

    return { ...info };
  }

  /**
   * Get all agents information
   */
  getAllAgents(): AgentInfo[] {
    return Array.from(this.agentInfo.values()).map(info => {
      const agent = this.agents.get(info.id);
      if (agent) {
        // Update stats
        info.stats = agent.getStats();
      }
      return { ...info };
    });
  }

  /**
   * Get conversation history for an agent
   */
  getAgentConversation(agentId: string): Message[] {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent.getConversationHistory();
  }

  /**
   * Clear conversation history for an agent
   */
  clearAgentHistory(agentId: string): void {
    const agent = this.agents.get(agentId);
    const info = this.agentInfo.get(agentId);

    if (!agent || !info) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.clearHistory();
    info.lastActivity = Date.now();
    
    this.log(`🗑️ Cleared history for agent: ${info.name} (${agentId})`);
  }

  /**
   * Get multi-agent statistics
   */
  getStats(): MultiAgentStats {
    const agents = this.getAllAgents();
    const activeAgents = agents.filter(a => a.isActive).length;
    const totalMessages = agents.reduce((sum, a) => sum + a.stats.executionCount, 0);
    const totalErrors = agents.reduce((sum, a) => sum + a.stats.errorCount, 0);

    return {
      totalAgents: agents.length,
      activeAgents,
      totalMessages,
      totalErrors,
      sharedMCPServers: this.sharedMCPHost.getServerCount(),
      uptime: Math.round((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * Start all agents
   */
  async startAllAgents(): Promise<void> {
    this.log("▶️ Starting all agents...");

    const startPromises = Array.from(this.agentInfo.keys()).map(async (agentId) => {
      const info = this.agentInfo.get(agentId)!;
      if (!info.isActive) {
        try {
          await this.startAgent(agentId);
        } catch (error) {
          this.log(`❌ Failed to start agent ${info.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    });

    await Promise.all(startPromises);
    this.log("✅ All agents start process completed");
  }

  /**
   * Stop all agents
   */
  async stopAllAgents(): Promise<void> {
    this.log("⏹️ Stopping all agents...");

    const stopPromises = Array.from(this.agentInfo.keys()).map(async (agentId) => {
      const info = this.agentInfo.get(agentId)!;
      if (info.isActive) {
        try {
          await this.stopAgent(agentId);
        } catch (error) {
          this.log(`❌ Failed to stop agent ${info.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    });

    await Promise.all(stopPromises);
    this.log("✅ All agents stop process completed");
  }

  /**
   * Remove all agents
   */
  async removeAllAgents(): Promise<void> {
    this.log("🗑️ Removing all agents...");

    const agentIds = Array.from(this.agentInfo.keys());
    for (const agentId of agentIds) {
      try {
        await this.removeAgent(agentId);
      } catch (error) {
        this.log(`❌ Failed to remove agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    this.log("✅ All agents removed");
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Get active agent count
   */
  getActiveAgentCount(): number {
    return Array.from(this.agentInfo.values()).filter(info => info.isActive).length;
  }

  /**
   * Check if agent exists
   */
  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Check if agent is active
   */
  isAgentActive(agentId: string): boolean {
    const info = this.agentInfo.get(agentId);
    return info?.isActive || false;
  }

  /**
   * Get maximum number of agents
   */
  getMaxAgents(): number {
    return this.maxAgents;
  }

  /**
   * Set maximum number of agents
   */
  setMaxAgents(maxAgents: number): void {
    if (maxAgents < 1) {
      throw new Error("Maximum agents must be at least 1");
    }

    this.maxAgents = maxAgents;
    this.log(`📊 Maximum agents set to: ${maxAgents}`);

    // Remove excess agents if necessary
    if (this.agents.size > maxAgents) {
      const agentIds = Array.from(this.agentInfo.keys());
      const excessAgents = agentIds.slice(maxAgents);
      
      for (const agentId of excessAgents) {
        this.removeAgent(agentId).catch(error => {
          this.log(`❌ Failed to remove excess agent ${agentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
      }
    }
  }

  /**
   * Get shared MCP host health
   */
  async getSharedMCPHealth(): Promise<any> {
    return await this.sharedMCPHost.healthCheck();
  }

  /**
   * Export all agent data
   */
  exportData(): {
    agents: Array<{
      info: AgentInfo;
      conversation: Message[];
    }>;
    metadata: {
      exportTime: number;
      totalAgents: number;
      activeAgents: number;
      uptime: number;
    };
  } {
    const agents = Array.from(this.agentInfo.values()).map(info => {
      const agent = this.agents.get(info.id);
      return {
        info: { ...info },
        conversation: agent ? agent.getConversationHistory() : []
      };
    });

    const stats = this.getStats();

    return {
      agents,
      metadata: {
        exportTime: Date.now(),
        totalAgents: stats.totalAgents,
        activeAgents: stats.activeAgents,
        uptime: stats.uptime
      }
    };
  }

  /**
   * Private helper methods
   */
  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    this.onLog(logMessage);
    console.log(logMessage);
  }

  /**
   * Cleanup all agents and resources
   */
  async cleanup(): Promise<void> {
    this.log("🧹 Cleaning up MultiAgentManager...");

    try {
      await this.stopAllAgents();
      await this.removeAllAgents();
      
      this.log("✅ MultiAgentManager cleanup completed");
      
    } catch (error) {
      this.log(`❌ Error during cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get system summary
   */
  getSummary(): string {
    const stats = this.getStats();
    return `MultiAgent: ${stats.totalAgents} agents (${stats.activeAgents} active), ${stats.totalMessages} messages, ${stats.uptime}s uptime`;
  }
}
