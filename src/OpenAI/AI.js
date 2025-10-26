import axios from "axios";
import { REACT_APP_OPENAI_API_KEY } from "../constants/OpenAI";

export class OpenAIChat {
  constructor() {
    this.chatMessages = [];
    this.isLoading = false;
    this.useWebSearch = false;
    this.useReasoning = false;
  }

  /**
   * Enable or disable web search functionality
   * @param {boolean} enabled - Whether to enable web search
   */
  setWebSearch(enabled) {
    this.useWebSearch = enabled;
  }

  /**
   * Enable or disable reasoning (thinking) functionality
   * @param {boolean} enabled - Whether to enable reasoning
   * @param {string} effort - Reasoning effort level: "low", "medium", or "high"
   */
  setReasoning(enabled, effort = "medium") {
    this.useReasoning = enabled;
    this.reasoningEffort = effort;
  }

  async ask(input, options = {}) {
    if (!input.trim()) return;

    // Add user message
    this.chatMessages.push({ role: "user", content: input });
    this.isLoading = true;

    try {
      // Choose between Responses API (for web search/tools) or Chat Completions API
      const useResponsesAPI = this.useWebSearch || options.useTools;
      
      if (useResponsesAPI) {
        return await this.askWithResponsesAPI(input, options);
      } else if (this.useReasoning) {
        return await this.askWithReasoning(input, options);
      } else {
        return await this.askStandard(input, options);
      }
    } catch (err) {
      this.isLoading = false;
      console.error("AI Error:", err);
      throw new Error(err.message || "AI request failed");
    }
  }

  /**
   * Standard Chat Completions API call
   */
  async askStandard(input, options = {}) {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: options.model || "gpt-4o",
        messages: this.chatMessages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${REACT_APP_OPENAI_API_KEY}`,
        },
      }
    );

    const aiMessage = response.data.choices[0].message.content;
    this.chatMessages.push({ role: "assistant", content: aiMessage });
    this.isLoading = false;
    return {
      content: aiMessage,
      citations: null,
      reasoningTokens: null
    };
  }

  /**
   * Responses API call with web search and tools
   */
  async askWithResponsesAPI(input, options = {}) {
    const tools = [];
    
    // Add web search tool if enabled
    if (this.useWebSearch) {
      tools.push({
        type: "web_search",
        // Optional filters for web search
        ...(options.searchFilters && { filters: options.searchFilters })
      });
    }

    // Add custom tools if provided
    if (options.tools) {
      tools.push(...options.tools);
    }

    const requestBody = {
      model: options.model || "gpt-4o",
      input: input,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: options.toolChoice || "auto",
      temperature: options.temperature,
      // Include citations in response
      include: ["web_search_call.action.sources"],
    };

    const response = await axios.post(
      "https://api.openai.com/v1/responses",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${REACT_APP_OPENAI_API_KEY}`,
        },
      }
    );

    // Extract text content and citations from response
    const output = response.data.output || [];
    let aiMessage = "";
    let citations = [];
    
    for (const item of output) {
      if (item.type === "message" && item.content) {
        for (const content of item.content) {
          if (content.type === "output_text" || content.type === "text") {
            aiMessage += content.text || content.output_text || '';
          }
          // Extract citations if available
          if (content.annotations) {
            citations.push(...content.annotations.filter(a => a.type === "url_citation"));
          }
        }
      }
    }

    this.chatMessages.push({ role: "assistant", content: aiMessage });
    this.isLoading = false;
    
    return {
      content: aiMessage || "No response generated.",
      citations: citations.length > 0 ? citations : null,
      responseId: response.data.id,
      reasoningTokens: null
    };
  }

  /**
   * Chat Completions API call with reasoning models (o1, o3, etc.)
   */
  async askWithReasoning(input, options = {}) {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: options.model || "o1", // Use o1, o1-mini, o3-mini, or o4-mini
        messages: this.chatMessages,
        // Reasoning effort parameter (only for reasoning models)
        reasoning_effort: this.reasoningEffort,
        // Note: reasoning models don't support temperature, top_p, etc.
        max_completion_tokens: options.maxCompletionTokens || 25000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${REACT_APP_OPENAI_API_KEY}`,
        },
      }
    );

    const aiMessage = response.data.choices[0].message.content;
    const reasoningTokens = response.data.usage?.completion_tokens_details?.reasoning_tokens;
    
    this.chatMessages.push({ role: "assistant", content: aiMessage });
    this.isLoading = false;
    
    return {
      content: aiMessage,
      citations: null,
      reasoningTokens: reasoningTokens, // Hidden "thinking" tokens
      totalTokens: response.data.usage?.total_tokens
    };
  }

  /**
   * Get conversation messages
   */
  getMessages() {
    return this.chatMessages;
  }

  /**
   * Clear conversation history
   */
  clear() {
    this.chatMessages = [];
  }

  /**
   * Get loading state
   */
  getLoadingState() {
    return this.isLoading;
  }
}

// Example usage:
/*
const chat = new OpenAIChat();

// Standard usage
await chat.ask("What is the capital of France?");

// With web search enabled
chat.setWebSearch(true);
const result = await chat.ask("What's the latest news about AI?");
console.log(result.content);
console.log(result.citations); // Array of cited sources

// With reasoning enabled (for complex problems)
chat.setReasoning(true, "high");
const reasoningResult = await chat.ask("Solve this complex math problem: ...");
console.log(reasoningResult.reasoningTokens); // Number of "thinking" tokens used

// With custom search filters
await chat.ask("Latest tech news", {
  searchFilters: {
    allowed_domains: ["techcrunch.com", "theverge.com"],
    location: {
      country: "US",
      city: "San Francisco"
    }
  }
});
*/