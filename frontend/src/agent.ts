import { BrowserMCPServer } from './mcp-server';
import { MCPAgent } from './agent-controller';

let currentAgent: MCPAgent | null = null;

export async function startAgent(setLog: (msg: string) => void) {
  // Stop any existing agent
  if (currentAgent) {
    currentAgent.stop();
  }

  try {
    // Create MCP server instance
    const mcpServer = new BrowserMCPServer();
    
    // Create and start the agent
    currentAgent = new MCPAgent(mcpServer, setLog);
    
    setLog("🚀 Starting MCP Browser Agent...");
    await currentAgent.start();
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    setLog(`❌ Failed to start agent: ${errorMsg}`);
    console.error('Agent startup error:', error);
  }
}

export function stopAgent() {
  if (currentAgent) {
    currentAgent.stop();
    currentAgent = null;
  }
}

export function getAgentStats() {
  return currentAgent ? currentAgent.getStats() : null;
}

export function isAgentRunning(): boolean {
  return currentAgent ? currentAgent.isActive() : false;
}
