/**
 * Enhanced MCP Browser Agent - Main Export Index
 * Provides easy access to all enhanced components
 */

// Configuration
export { 
  HostConfiguration, 
  getConfig, 
  type LLMConfig,
  type AgentConfig,
  type ServerConfig
} from '../app/HostConfiguration';

// Tools
export { 
  Tool, 
  type ToolResult
} from '../mcp-tools/Tool';

export { 
  ToolRegistry, 
  getToolRegistry, 
  resetToolRegistry,
  type ToolInfo
} from '../mcp-tools/ToolRegistry';

export { 
  enhancedTools
} from '../mcp-tools/ServerTools';

// LLM Client
export { 
  LLMClient, 
  getLLMClient, 
  resetLLMClient,
  LLMError,
  ConfigurationError,
  type Message,
  type LLMResponse,
  type LLMRequestOptions
} from '../llm/LLMClient';

// MCP Core
export { 
  MCPClient
} from '../mcp-core/MCPClient';

export { 
  MCPServer, 
  getMCPServer, 
  resetMCPServer,
  type MCPCapabilities,
  type MCPServerInfo,
  type MCPToolInfo,
  type MCPCallToolResult
} from '../mcp-core/MCPServer';

export { 
  MCPHost,
  getMCPHost,
  resetMCPHost,
  type MCPContext,
  type ToolResult as MCPToolResult,
  type ServerStatus
} from '../mcp-core/MCPHost';

// Application
export {
  ApplicationHost
} from '../app/ApplicationHost';

// Import the functions we need for utility functions
import { getConfig } from '../app/HostConfiguration';
import { getMCPServer } from '../mcp-core/MCPServer';
import { getToolRegistry } from '../mcp-tools/ToolRegistry';
import { getLLMClient } from '../llm/LLMClient';
import { getMCPHost, resetMCPHost } from '../mcp-core/MCPHost';
import { resetMCPServer } from '../mcp-core/MCPServer';
import { resetToolRegistry } from '../mcp-tools/ToolRegistry';
import { resetLLMClient } from '../llm/LLMClient';

// Convenience function to initialize the entire enhanced system
export async function initializeEnhancedSystem(onLog: (message: string) => void) {
  const config = getConfig();
  const server = getMCPServer();
  const toolRegistry = getToolRegistry();
  const llmClient = getLLMClient();
  const mcpHost = getMCPHost();

  // Initialize server
  await server.initialize();

  return {
    config,
    server,
    toolRegistry,
    llmClient,
    mcpHost
  };
}

// Health check function
export function getSystemHealth() {
  const config = getConfig();
  const server = getMCPServer();
  const toolRegistry = getToolRegistry();
  const llmClient = getLLMClient();
  const mcpHost = getMCPHost();

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
    mcpHost: {
      serverCount: mcpHost.getServerCount(),
      hasConnectedServers: mcpHost.hasConnectedServers()
    }
  };
}

// System reset function (useful for testing)
export function resetEnhancedSystem() {
  resetMCPHost();
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
