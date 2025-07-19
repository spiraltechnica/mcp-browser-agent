/**
 * Centralized configuration management for the MCP Browser Agent
 * Handles environment variables, validation, and application settings
 */
export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  responseFormat?: { type: string };
  timeout: number;
}

export interface AgentConfig {
  maxExecutions: number;
  executionDelay: number;
  maxContextEntries: number;
  maxErrors: number;
}

export interface ServerConfig {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
  };
}

export class Configuration {
  private static instance: Configuration;
  private _apiKey: string | null = null;

  private constructor() {
    this.loadEnvironment();
    this.validateConfiguration();
  }

  /**
   * Get singleton instance of Configuration
   */
  static getInstance(): Configuration {
    if (!Configuration.instance) {
      Configuration.instance = new Configuration();
    }
    return Configuration.instance;
  }

  /**
   * Load environment variables
   */
  private loadEnvironment(): void {
    // Load from Vite environment variables (optional for frontend)
    this._apiKey = import.meta.env.VITE_OPENAI_API_KEY || null;
  }

  /**
   * Validate configuration and environment
   */
  private validateConfiguration(): void {
    // Frontend doesn't require API key since we use backend proxy
    // Just log if frontend API key is available
    if (this._apiKey) {
      console.log("✅ Frontend API key configured (will be ignored, using backend proxy)");
    } else {
      console.log("ℹ️ No frontend API key configured (using backend proxy)");
    }
  }

  /**
   * Get the LLM API key (not used in frontend, kept for compatibility)
   */
  get llmApiKey(): string {
    if (!this._apiKey) {
      // Return empty string since we use backend proxy
      return "";
    }
    return this._apiKey;
  }

  /**
   * Check if API key is configured (always true since we use backend proxy)
   */
  get hasApiKey(): boolean {
    // Always return true since we use backend proxy
    return true;
  }

  /**
   * Get LLM configuration
   */
  get llmConfig(): LLMConfig {
    return {
      model: "gpt-4.1-mini",
      temperature: 0.3,
      maxTokens: 1000,
      timeout: 30000
    };
  }

  /**
   * Get agent configuration
   */
  get agentConfig(): AgentConfig {
    return {
      maxExecutions: 100,
      executionDelay: 3000,
      maxContextEntries: 50,
      maxErrors: 10
    };
  }

  /**
   * Get server configuration
   */
  get serverConfig(): ServerConfig {
    return {
      name: "browser-mcp-server",
      version: "1.0.0",
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true }
      }
    };
  }

  /**
   * Get API endpoints configuration
   */
  get apiConfig() {
    return {
      llmEndpoint: "/api/llm",
      healthEndpoint: "/api/health",
      baseUrl: typeof window !== 'undefined' ? window.location.origin : "http://localhost:3001"
    };
  }

  /**
   * Get logging configuration
   */
  get loggingConfig() {
    return {
      level: "info",
      enableConsole: true,
      enableTimestamps: true,
      maxLogEntries: 1000
    };
  }

  /**
   * Reload configuration (useful for testing or dynamic updates)
   */
  reload(): void {
    this.loadEnvironment();
    this.validateConfiguration();
  }

  /**
   * Get configuration summary for debugging
   */
  getSummary(): Record<string, any> {
    return {
      hasApiKey: this.hasApiKey,
      llmModel: this.llmConfig.model,
      maxExecutions: this.agentConfig.maxExecutions,
      serverName: this.serverConfig.name,
      apiEndpoint: this.apiConfig.llmEndpoint
    };
  }
}

/**
 * Convenience function to get configuration instance
 */
export const getConfig = () => Configuration.getInstance();

/**
 * Configuration error class
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
