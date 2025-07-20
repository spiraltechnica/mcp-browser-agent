/**
 * Enhanced MCP Browser Agent - Main Export Index
 * Provides easy access to all enhanced components
 */

// Configuration
export { 
  Configuration, 
  getConfig, 
  ConfigurationError,
  type LLMConfig,
  type AgentConfig,
  type ServerConfig
} from '../mcp-host/HostConfiguration';

// Tools
export { 
  Tool, 
  createTool, 
  ToolExecutionError,
  type ToolInputSchema,
  type ToolResult,
  type ToolHandler
} from '../mcp-server/Tool';

export { 
  ToolRegistry, 
  getToolRegistry, 
  resetToolRegistry,
  type ToolInfo
} from '../mcp-server/ToolRegistry';

export { 
  calculatorTool,
  domQueryTool,
  browserStorageTool,
  listToolsTool,
  enhancedTools,
  enhancedToolsMap
} from '../mcp-server/ServerTools';

// LLM Client
export { 
  LLMClient, 
  getLLMClient, 
  resetLLMClient,
  LLMError,
  type Message,
  type LLMResponse,
  type LLMRequestOptions
} from '../llm/LLMClient';

// Session Management
export { 
  MCPClient,
  type SessionContext,
  type SessionStats
} from '../mcp/MCPClient';

// Server
export { 
  MCPServer, 
  getMCPServer, 
  resetMCPServer,
  type MCPCapabilities,
  type MCPServerInfo,
  type MCPToolInfo,
  type MCPCallToolResult
} from '../mcp-server/MCPServer';

// Agent
export { 
  MCPHost,
  createEnhancedAgent,
  getEnhancedAgent,
  resetEnhancedAgent,
  startEnhancedAgent,
  stopEnhancedAgent,
  isEnhancedAgentRunning,
  getEnhancedAgentStats,
  type AgentStats
} from '../mcp-host/MCPHost';

// Import the functions we need for utility functions
import { getConfig } from '../mcp-host/HostConfiguration';
import { getMCPServer } from '../mcp-server/MCPServer';
import { getToolRegistry } from '../mcp-server/ToolRegistry';
import { getLLMClient } from '../llm/LLMClient';
import { createEnhancedAgent, getEnhancedAgent, resetEnhancedAgent } from '../mcp-host/MCPHost';
import { resetMCPServer } from '../mcp-server/MCPServer';
import { resetToolRegistry } from '../mcp-server/ToolRegistry';
import { resetLLMClient } from '../llm/LLMClient';

// Convenience function to initialize the entire enhanced system
export async function initializeEnhancedSystem(onLog: (message: string) => void) {
  const config = getConfig();
  const server = getMCPServer();
  const toolRegistry = getToolRegistry();
  const llmClient = getLLMClient();
  const agent = createEnhancedAgent(onLog);

  // Initialize server
  await server.initialize();

  return {
    config,
    server,
    toolRegistry,
    llmClient,
    agent
  };
}

// Health check function
export function getSystemHealth() {
  const config = getConfig();
  const server = getMCPServer();
  const toolRegistry = getToolRegistry();
  const llmClient = getLLMClient();
  const agent = getEnhancedAgent();

  return {
    timestamp: new Date().toISOString(),
    config: {
      hasApiKey: config.hasApiKey,
      summary: config.getSummary()
    },
    server: {
      initialized: server.isInitialized(),
      toolCount: server.getToolCount(),
      health: server.healthCheck()
    },
    tools: {
      count: toolRegistry.getToolCount(),
      stats: toolRegistry.getExecutionStats(),
      validation: toolRegistry.validateAllTools()
    },
    llm: {
      configured: llmClient.isConfigured(),
      config: llmClient.getConfigSummary()
    },
    agent: {
      exists: !!agent,
      active: agent?.isAgentActive() || false,
      stats: agent?.getStats() || null
    }
  };
}

// System reset function (useful for testing)
export function resetEnhancedSystem() {
  resetEnhancedAgent();
  resetMCPServer();
  resetToolRegistry();
  resetLLMClient();
}

// Version information
export const ENHANCED_SYSTEM_VERSION = '1.0.0';
export const ENHANCED_SYSTEM_NAME = 'Enhanced MCP Browser Agent';

// System information
export function getSystemInfo() {
  return {
    name: ENHANCED_SYSTEM_NAME,
    version: ENHANCED_SYSTEM_VERSION,
    description: 'Enhanced MCP Browser Agent following Python implementation patterns',
    features: [
      'Centralized Configuration Management',
      'Enhanced Tool Abstraction Layer',
      'Sophisticated LLM Client with Error Handling',
      'Session-based Chat Management',
      'Comprehensive Server Management',
      'Integrated Agent Orchestration',
      'Python-inspired Architecture Patterns'
    ],
    architecture: {
      config: 'Singleton configuration management with validation',
      tools: 'Tool abstraction with LLM-optimized formatting',
      llm: 'Enhanced LLM client with retry logic and error handling',
      session: 'Chat session orchestration with context management',
      server: 'Enhanced MCP server with resource management',
      agent: 'Integrated agent orchestrating all components'
    }
  };
}
