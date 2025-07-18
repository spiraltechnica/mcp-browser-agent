# MCP Browser Agent

A React frontend that runs an AI agent loop in the browser using the Model Context Protocol (MCP) to discover and use in-browser tools.

## 🧠 Architecture

```
📦 mcp-browser-agent
├── frontend (React + MCP SDK + tool registry)
│   ├── MCP agent loop (runs in browser)
│   └── Tools (calculator, DOM query, storage, etc.)
├── backend (Express.js)
│   └── /api/llm → proxies to OpenAI for reasoning
└── Shared context passed into agent
```

## ✨ Features

- **🤖 Intelligent Agent**: AI-powered agent that makes decisions and uses tools autonomously
- **🔧 Browser-Native MCP Server**: True MCP server implementation running entirely in the browser
- **🧮 Safe Calculator**: Secure mathematical expression evaluator (no `eval()` vulnerabilities)
- **🌐 DOM Interaction**: Query and interact with page elements
- **💾 Browser Storage**: Read/write to localStorage
- **🔍 Tool Discovery**: Dynamic tool registration and discovery
- **📊 Real-time Monitoring**: Live stats, logs, and tool visibility
- **🛡️ Robust Error Handling**: Comprehensive error handling and fallback mechanisms

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key

### Installation

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd mcp-browser-agent
   ```

2. **Install dependencies**:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend  
   cd ../frontend
   npm install
   ```

3. **Configure environment**:
   ```bash
   cd ../backend
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

4. **Start the application**:
   ```bash
   # Terminal 1: Start backend
   cd backend
   npm run dev
   
   # Terminal 2: Start frontend
   cd frontend  
   npm run dev
   ```

5. **Open browser**: Navigate to `http://localhost:3000`

## 🔧 Available Tools

The MCP server provides these built-in tools:

### Calculator
- **Purpose**: Safe arithmetic calculations
- **Security**: Input validation, no dangerous `eval()`
- **Usage**: `{ "expression": "2 + 2 * 3" }`

### DOM Query
- **Purpose**: Interact with page elements
- **Actions**: `query`, `click`, `text`, `value`, `exists`
- **Usage**: `{ "selector": "button", "action": "click" }`

### Browser Storage
- **Purpose**: localStorage operations
- **Actions**: `get`, `set`, `remove`, `clear`, `keys`
- **Usage**: `{ "action": "set", "key": "data", "value": "hello" }`

### List Tools
- **Purpose**: Discover available tools
- **Returns**: Tool names, descriptions, and schemas

## 🏗️ Implementation Details

### Security Improvements ✅

- **Safe Calculator**: Replaced dangerous `Function()` constructor with validated expression parser
- **Input Validation**: All tools validate inputs and handle errors gracefully
- **CORS Configuration**: Properly configured CORS for security
- **Error Boundaries**: Comprehensive error handling throughout

### MCP Server Architecture ✅

- **True MCP Server**: Implements proper MCP protocol in the browser
- **Tool Discovery**: Dynamic tool registration and listing
- **Event System**: Tool change notifications and listeners
- **Capability Negotiation**: Proper MCP initialization and capabilities

### Agent Intelligence ✅

- **Decision Making**: LLM-powered decision engine with fallbacks
- **Context Management**: Smart context retention and relevance filtering
- **Error Recovery**: Automatic error handling and recovery strategies
- **Execution Limits**: Prevents infinite loops and runaway execution

### Backend Robustness ✅

- **JSON Parsing**: Multiple fallback strategies for parsing LLM responses
- **Error Handling**: Detailed error reporting and fallback decisions
- **Request Validation**: Input validation and sanitization
- **Health Monitoring**: Health check endpoint and logging

## 🎯 Usage Examples

### Starting the Agent

1. Click "▶️ Start Agent" in the UI
2. Watch the activity log for real-time updates
3. Monitor tool executions and results
4. Use "⏹️ Stop Agent" to halt execution

### Manual Tool Testing

The agent will automatically discover and use tools, but you can also:

1. Check the "Available Tools" panel to see all registered tools
2. Watch the agent's decision-making process in the activity log
3. Monitor execution statistics in real-time

## 🔍 Monitoring & Debugging

### Activity Log
- Real-time agent decisions and tool executions
- Error messages and recovery actions
- Timestamped entries with clear formatting

### Statistics Panel
- Execution count and runtime
- Error count and context size
- Running status indicator

### Tool Discovery Panel
- Live list of available tools
- Tool descriptions and required parameters
- Schema information for each tool

## 🛠️ Development

### Adding New Tools

1. Create a new tool in `frontend/src/tools.ts`:
   ```typescript
   const myTool: MCPTool = {
     name: "my_tool",
     description: "What this tool does",
     inputSchema: {
       type: "object",
       properties: {
         param: { type: "string", description: "Parameter description" }
       },
       required: ["param"]
     },
     handler: async ({ param }) => {
       // Tool implementation
       return { result: "success" };
     }
   };
   ```

2. Register it in the `toolRegistry`:
   ```typescript
   export const toolRegistry: Record<string, MCPTool> = {
     // ... existing tools
     my_tool: myTool,
   };
   ```

### Customizing the Agent

Modify `frontend/src/agent-controller.ts` to:
- Change decision-making prompts
- Adjust execution limits and delays
- Add custom context management logic
- Implement new agent behaviors

## 📝 API Reference

### Backend Endpoints

- `POST /api/llm` - LLM proxy for agent reasoning
- `GET /api/health` - Health check and configuration status

### MCP Server Methods

- `initialize()` - Initialize the MCP server
- `listTools()` - Get available tools
- `callTool(name, args)` - Execute a tool
- `registerTool(tool)` - Add a new tool
- `unregisterTool(name)` - Remove a tool

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Model Context Protocol (MCP) specification
- OpenAI for LLM capabilities
- React and Vite for the frontend framework
