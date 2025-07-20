require('dotenv').config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY environment variable is required");
  process.exit(1);
}


// MCP-compatible LLM proxy endpoint with detailed logging and function calling support
app.post("/api/llm", async (req, res) => {
  const { messages, model, temperature, max_tokens, tools, tool_choice, response_format } = req.body;
  const requestId = Math.random().toString(36).substr(2, 9);
  const startTime = Date.now();
  
  console.log(`\n🚀 [${requestId}] === NEW LLM REQUEST ===`);
  console.log(`🔑 [${requestId}] API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes (***' + process.env.OPENAI_API_KEY.slice(-4) + ')' : 'No'}`);

  let requestPayload;

  // Handle new message-based requests (enhanced system with MCP function calling)
  if (messages && Array.isArray(messages)) {
    console.log(`📝 [${requestId}] Message-based request with ${messages.length} messages`);
    console.log(`📝 [${requestId}] Messages:`, JSON.stringify(messages, null, 2));
    
    requestPayload = {
      model: model || "gpt-4.1-mini",
      messages: messages,
      temperature: temperature || 0.3,
      max_tokens: max_tokens || 1000
    };

    // Add MCP function calling support
    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestPayload.tools = tools;
      requestPayload.tool_choice = tool_choice || "auto";
      console.log(`🔧 [${requestId}] Function calling enabled with ${tools.length} tools`);
      console.log(`🔧 [${requestId}] Tools:`, tools.map(t => t.function.name));
      console.log(`🔧 [${requestId}] Tool choice: ${requestPayload.tool_choice}`);
    }

    // Add response format if specified
    if (response_format) {
      requestPayload.response_format = response_format;
      console.log(`📝 [${requestId}] Response format: ${response_format.type}`);
    }
  }
  // Invalid request
  else {
    console.log(`❌ [${requestId}] Invalid request: 'messages' array is required`);
    return res.status(400).json({ 
      error: "Invalid request: 'messages' array is required" 
    });
  }

  console.log(`⚙️ [${requestId}] Request config:`, {
    model: requestPayload.model,
    temperature: requestPayload.temperature,
    max_tokens: requestPayload.max_tokens,
    response_format: requestPayload.response_format,
    messages_count: requestPayload.messages.length
  });

  try {
    console.log(`🌐 [${requestId}] Sending request to OpenAI...`);
    
    const response = await axios.post("https://api.openai.com/v1/chat/completions", requestPayload, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 30000 // 30 second timeout
    });

    const responseTime = Date.now() - startTime;
    const reply = response.data.choices[0].message.content;
    const usage = response.data.usage;

    console.log(`✅ [${requestId}] OpenAI Response received in ${responseTime}ms`);
    console.log(`📊 [${requestId}] Token usage:`, {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens
    });
    console.log(`🤖 [${requestId}] Raw response:\n${reply}`);
    
    const choice = response.data.choices[0];
    const message = choice.message;
    
    console.log(`💬 [${requestId}] Returning MCP-compatible response`);
    
    // Log function calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 [${requestId}] Function calls detected: ${message.tool_calls.length}`);
      console.log(`🔧 [${requestId}] Tool calls:`, message.tool_calls.map(tc => tc.function.name));
    }
    
    console.log(`⏱️ [${requestId}] Total request time: ${responseTime}ms\n`);
    
    // Return the full OpenAI response format for MCP compatibility
    res.json({
      choices: [{
        message: {
          role: message.role,
          content: message.content,
          tool_calls: message.tool_calls || undefined
        },
        finish_reason: choice.finish_reason
      }],
      usage: usage,
      model: response.data.model
    });
    
  } catch (err) {
    const responseTime = Date.now() - startTime;
    console.error(`\n❌ [${requestId}] === LLM API ERROR ===`);
    console.error(`❌ [${requestId}] Error after ${responseTime}ms:`, err.message);
    
    // Detailed error logging
    if (err.response) {
      console.error(`❌ [${requestId}] HTTP Status: ${err.response.status}`);
      console.error(`❌ [${requestId}] Response headers:`, err.response.headers);
      console.error(`❌ [${requestId}] Response data:`, err.response.data);
      
      if (err.response.data?.error) {
        console.error(`❌ [${requestId}] OpenAI Error Details:`, {
          type: err.response.data.error.type,
          code: err.response.data.error.code,
          message: err.response.data.error.message
        });
      }
    } else if (err.request) {
      console.error(`❌ [${requestId}] No response received:`, err.request);
    } else {
      console.error(`❌ [${requestId}] Request setup error:`, err.message);
    }
    
    // Provide detailed error information
    let errorDetails = err.message;
    if (err.response) {
      const openaiError = err.response.data?.error;
      if (openaiError) {
        errorDetails = `OpenAI API Error: ${openaiError.message} (${openaiError.type})`;
      } else {
        errorDetails = `HTTP ${err.response.status}: ${err.response.statusText}`;
      }
    } else if (err.code === 'ECONNABORTED') {
      errorDetails = "Request timeout - OpenAI API took too long to respond";
    } else if (err.code === 'ENOTFOUND') {
      errorDetails = "Network error - Unable to reach OpenAI API";
    }
    
    console.error(`❌ [${requestId}] Final error: ${errorDetails}\n`);
    
    // Return standard error response
    res.status(500).json({
      error: errorDetails,
      requestId: requestId,
      responseTime: responseTime
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    openai_configured: !!process.env.OPENAI_API_KEY
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: "Internal server error"
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 MCP backend running on http://localhost:${PORT}`);
  console.log(`✅ OpenAI API key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
});
