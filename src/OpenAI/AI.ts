import axios from "axios";
import type { AxiosResponse } from "axios";
const REACT_APP_OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Interfaces
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Citation {
  type: string;
  url: string;
  title?: string;
}

interface ContentBlock {
  type: string;
  text?: string;
  output_text?: string;
  annotations?: Citation[];
}

interface MessageItem {
  type: string;
  content?: ContentBlock[];
}

interface SearchFilters {
  allowed_domains?: string[];
  blocked_domains?: string[];
  location?: {
    country?: string;
    city?: string;
    region?: string;
  };
}

interface Tool {
  type: string;
  filters?: SearchFilters;
}

interface AskOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxCompletionTokens?: number;
  useTools?: boolean;
  tools?: Tool[];
  toolChoice?: string;
  searchFilters?: SearchFilters;
}

interface AIResponse {
  content: string;
  citations?: Citation[] | null;
  reasoningTokens?: number | null;
  responseId?: string;
  totalTokens?: number;
}

interface OpenAIUsage {
  total_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

interface OpenAIChoice {
  message: {
    content: string;
  };
}

interface OpenAIChatResponse {
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
}

interface OpenAIResponsesAPIResponse {
  id: string;
  output?: MessageItem[];
}

export class OpenAIChat {
  private chatMessages: ChatMessage[];
  private isLoading: boolean;
  private useWebSearch: boolean;
  private useReasoning: boolean;
  private reasoningEffort: "low" | "medium" | "high";

  constructor() {
    this.chatMessages = [];
    this.isLoading = false;
    this.useWebSearch = false;
    this.useReasoning = false;
    this.reasoningEffort = "medium";
  }

  /**
   * Enable or disable web search functionality
   * @param enabled - Whether to enable web search
   */
  setWebSearch(enabled: boolean): void {
    this.useWebSearch = enabled;
  }

  /**
   * Enable or disable reasoning (thinking) functionality
   * @param enabled - Whether to enable reasoning
   * @param effort - Reasoning effort level: "low", "medium", or "high"
   */
  setReasoning(enabled: boolean, effort: "low" | "medium" | "high" = "medium"): void {
    this.useReasoning = enabled;
    this.reasoningEffort = effort;
  }

  async ask(input: string, options: AskOptions = {}): Promise<AIResponse> {
    if (!input.trim()) {
      throw new Error("Input cannot be empty");
    }

    // Add user message
    this.chatMessages.push({ role: "user", content: input });
    this.isLoading = true;

    try {
      // Choose between Responses API (for web search/tools) or Chat Completions API
      const useResponsesAPI = this.useWebSearch || options.useTools;

      if (useResponsesAPI) {
        return await this.askWithResponsesAPI(options);
      } else if (this.useReasoning) {
        return await this.askWithReasoning(options);
      } else {
        return await this.askStandard(options);
      }
    } catch (err) {
      this.isLoading = false;
      const errorMessage = err instanceof Error ? err.message : "AI request failed";
      console.error("AI Error:", err);
      throw new Error(errorMessage);
    }
  }

  /**
   * Standard Chat Completions API call
   */
  private async askStandard(options: AskOptions = {}): Promise<AIResponse> {
    const response: AxiosResponse<OpenAIChatResponse> = await axios.post(
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
      reasoningTokens: null,
    };
  }

  /**
   * Responses API call with web search and tools
   */
  private async askWithResponsesAPI(options: AskOptions = {}): Promise<AIResponse> {
    const tools: Tool[] = [];

    // Add web search tool if enabled
    if (this.useWebSearch) {
      tools.push({
        type: "web_search",
        // Optional filters for web search
        ...(options.searchFilters && { filters: options.searchFilters }),
      });
    }

    // Add custom tools if provided
    if (options.tools) {
      tools.push(...options.tools);
    }

    // Get the last user message
    const lastMessage = this.chatMessages[this.chatMessages.length - 1];

    const requestBody = {
      model: options.model || "gpt-4o",
      input: lastMessage.content,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: options.toolChoice || "auto",
      temperature: options.temperature,
      // Include citations in response
      include: ["web_search_call.action.sources"],
    };

    const response: AxiosResponse<OpenAIResponsesAPIResponse> = await axios.post(
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
    const citations: Citation[] = [];

    for (const item of output) {
      if (item.type === "message" && item.content) {
        for (const content of item.content) {
          if (content.type === "output_text" || content.type === "text") {
            aiMessage += content.text || content.output_text || "";
          }
          // Extract citations if available
          if (content.annotations) {
            citations.push(...content.annotations.filter((a) => a.type === "url_citation"));
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
      reasoningTokens: null,
    };
  }

  /**
   * Chat Completions API call with reasoning models (o1, o3, etc.)
   */
  private async askWithReasoning(options: AskOptions = {}): Promise<AIResponse> {
    const response: AxiosResponse<OpenAIChatResponse> = await axios.post(
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
      reasoningTokens: reasoningTokens || null,
      totalTokens: response.data.usage?.total_tokens,
    };
  }

  /**
   * Get conversation messages
   */
  getMessages(): ChatMessage[] {
    return this.chatMessages;
  }

  /**
   * Clear conversation history
   */
  clear(): void {
    this.chatMessages = [];
  }

  /**
   * Get loading state
   */
  getLoadingState(): boolean {
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