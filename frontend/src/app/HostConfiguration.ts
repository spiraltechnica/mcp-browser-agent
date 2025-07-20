/**
 * Host Configuration for MCP Browser Agent
 * Centralized configuration management
 */

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  apiKey?: string;
}

export interface AgentConfig {
  maxErrors: number;
  maxConversationLength: number;
  defaultTimeout: number;
}

export interface LoggingConfig {
  maxLogEntries: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ServerConfig {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    prompts?: { listChanged?: boolean };
    sampling?: {};
  };
}

export interface ApiConfig {
  llmEndpoint: string;
}

export interface HostConfig {
  llmConfig: LLMConfig;
  agentConfig: AgentConfig;
  loggingConfig: LoggingConfig;
  serverConfig: ServerConfig;
  apiConfig: ApiConfig;
}

/**
 * Default configuration
 */
const defaultConfig: HostConfig = {
  llmConfig: {
    model: "gpt-4.1-mini",
    temperature: 0.3,
    maxTokens: 2000,
    timeout: 30000
  },
  agentConfig: {
    maxErrors: 10,
    maxConversationLength: 50,
    defaultTimeout: 30000
  },
  loggingConfig: {
    maxLogEntries: 1000,
    logLevel: 'info'
  },
  serverConfig: {
    name: "mcp-browser-agent",
    version: "1.0.0",
    protocolVersion: "2025-06-18",
    capabilities: {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      sampling: {}
    }
  },
  apiConfig: {
    llmEndpoint: "/api/llm"
  }
};

/**
 * Configuration manager
 */
export class HostConfiguration {
  private config: HostConfig;

  constructor(config?: Partial<HostConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  get llmConfig(): LLMConfig {
    return this.config.llmConfig;
  }

  get agentConfig(): AgentConfig {
    return this.config.agentConfig;
  }

  get loggingConfig(): LoggingConfig {
    return this.config.loggingConfig;
  }

  get serverConfig(): ServerConfig {
    return this.config.serverConfig;
  }

  get apiConfig(): ApiConfig {
    return this.config.apiConfig;
  }

  get hasApiKey(): boolean {
    // Frontend doesn't need to check API key - backend handles this
    // Always return true since API key is configured in backend .env
    return true;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<HostConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get configuration summary
   */
  getSummary(): any {
    return {
      model: this.config.llmConfig.model,
      maxErrors: this.config.agentConfig.maxErrors,
      logLevel: this.config.loggingConfig.logLevel,
      serverName: this.config.serverConfig.name,
      protocolVersion: this.config.serverConfig.protocolVersion
    };
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.llmConfig.model) {
      errors.push('LLM model is required');
    }

    if (this.config.llmConfig.temperature < 0 || this.config.llmConfig.temperature > 2) {
      errors.push('LLM temperature must be between 0 and 2');
    }

    if (this.config.agentConfig.maxErrors < 1) {
      errors.push('Max errors must be at least 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Global configuration instance
 */
let globalConfig: HostConfiguration | null = null;

/**
 * Get the global configuration instance
 */
export function getConfig(): HostConfiguration {
  if (!globalConfig) {
    globalConfig = new HostConfiguration();
  }
  return globalConfig;
}

/**
 * Set the global configuration
 */
export function setConfig(config: Partial<HostConfig>): void {
  if (!globalConfig) {
    globalConfig = new HostConfiguration(config);
  } else {
    globalConfig.updateConfig(config);
  }
}

/**
 * Reset the global configuration
 */
export function resetConfig(): void {
  globalConfig = null;
}
