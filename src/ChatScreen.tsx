import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUpIcon } from "lucide-react";
import { IconPlus } from "@tabler/icons-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from './components/ui/input-group';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './components/ui/dropdown-menu';
import { Separator } from './components/ui/separator';
import { Button } from './components/ui/button';
import { OpenAIChat } from './OpenAI/AI';
import { TypewriterText } from './component/Typewriter';
import { Copy, RotateCcw, Volume2, Pause, Share, ExternalLink, Brain } from 'lucide-react';
import { collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from '@/(auth)/firebase';
import { setDoc, doc } from 'firebase/firestore';

interface ChatScreenProps {
  conversationId: string | null;
  initialMessage: string;
  loadedMessages: any[];
  onBack: () => void;
  onNewChat: () => void;
  personality?: string;
}

type AIMode = 'auto' | 'thinking' | 'web_search';

interface Message {
  role: string;
  content: string;
  citations?: Array<{ url: string; title?: string }>;
  reasoningTokens?: number;
  mode?: AIMode;
}

export function ChatScreen({ 
  conversationId: propsConversationId, 
  initialMessage, 
  loadedMessages, 
  onBack, 
  onNewChat,
  personality 
}: ChatScreenProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatService] = useState(new OpenAIChat());
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [speechSynthesisInstance, setSpeechSynthesisInstance] = useState<SpeechSynthesisUtterance | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(propsConversationId);
  const [hasProcessedInitial, setHasProcessedInitial] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const startNewChat = () => {
    if (!auth.currentUser) return;

    const newId = doc(collection(db, "users", auth.currentUser.uid, "conversations")).id;
    setConversationId(newId);
    setMessages([]);
    setHasProcessedInitial(false);
  };

  // Smooth scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const saveConversation = async (uid: string, conversationId: string, messages: any[]) => {
    if (!uid || !conversationId) return;

    // Clean messages to remove undefined fields
    const cleanMessages = messages.map(msg => {
      const cleanMsg: any = {
        role: msg.role,
        content: msg.content
      };

      // Only add optional fields if they exist
      if (msg.citations && msg.citations.length > 0) {
        cleanMsg.citations = msg.citations;
      }
      if (msg.reasoningTokens !== undefined && msg.reasoningTokens !== null) {
        cleanMsg.reasoningTokens = msg.reasoningTokens;
      }
      if (msg.mode) {
        cleanMsg.mode = msg.mode;
      }

      return cleanMsg;
    });

    await setDoc(doc(db, "users", uid, "conversations", conversationId), {
      messages: cleanMessages,
      createdAt: serverTimestamp(),
    });
  };

  const handleSpeak = (text: string, index: number) => {
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    utterance.onend = () => {
      setSpeakingIndex(null);
    };

    setSpeechSynthesisInstance(utterance);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleRegenerate = async (index: number) => {
    const prevUserMessage = messages
      .slice(0, index)
      .reverse()
      .find((m) => m.role === "user")?.content;

    if (!prevUserMessage) return;
    
    setMessages(prev => prev.slice(0, index));
    
    await handleAIResponse(prevUserMessage);
  };

  const handleShare = (text: string) => {
    if (navigator.share) {
      navigator.share({ title: "AI Message", text });
    } else {
      navigator.clipboard.writeText(text);
      alert("Copied to clipboard (no share support)");
    }
  };

  const handleAIResponse = async (userMessage: string) => {
    setIsLoading(true);
    try {
      // Configure AI service based on selected mode
      if (aiMode === 'thinking') {
        chatService.setWebSearch(false);
        chatService.setReasoning(true, 'medium');
      } else if (aiMode === 'web_search') {
        chatService.setWebSearch(true);
        chatService.setReasoning(false);
      } else {
        // Auto mode - disable both, use standard model
        chatService.setWebSearch(false);
        chatService.setReasoning(false);
      }

      // Prepend personality to the user message if set
      const messageWithPersonality = personality 
        ? `[System instruction: ${personality}]\n\nUser: ${userMessage}`
        : userMessage;

      const response = await chatService.ask(messageWithPersonality);

      // Extract text content from response
      let contentText = '';
      if (typeof response === 'string') {
        contentText = response;
      } else if (response.content) {
        // Handle structured response
        if (typeof response.content === 'string') {
          contentText = response.content;
        } else if (Array.isArray(response.content)) {
          // Extract text from array of content blocks
          contentText = response.content
            .map(item => {
              if (typeof item === 'string') return item;
              if (item.type === 'text') return item.text;
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }
      }

      setMessages(prev => {
        const newMessages: Message[] = [
          ...prev, 
          { 
            role: "assistant", 
            content: contentText || "Sorry, I couldn't generate a response.",
            citations: response.citations,
            reasoningTokens: response.reasoningTokens,
            mode: aiMode
          }
        ];

        const user = auth.currentUser;
        if (user && conversationId) {
          saveConversation(user.uid, conversationId, newMessages);
        }

        return newMessages;
      });
    } catch (error) {
      console.error("AI Response error:", error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          mode: aiMode
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!conversationId) {
      startNewChat();
      if (!auth.currentUser) return;
    }

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    await handleAIResponse(userMessage);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    startNewChat();
    if (onNewChat) {
      onNewChat();
    }
  };

  const handleModeChange = (mode: AIMode) => {
    setAiMode(mode);
  };

  // Load existing conversation if provided
  useEffect(() => {
    if (loadedMessages && loadedMessages.length > 0 && propsConversationId) {
      setMessages(loadedMessages);
      setConversationId(propsConversationId);
      setHasProcessedInitial(true);
    }
  }, [loadedMessages, propsConversationId]);

  // Handle initial message for new conversations
  useEffect(() => {
    const hasLoadedMessages = loadedMessages && loadedMessages.length > 0;
    
    if (initialMessage && !hasProcessedInitial && !hasLoadedMessages) {
      if (!conversationId) {
        startNewChat();
      }
      
      setMessages([{ role: "user", content: initialMessage }]);
      handleAIResponse(initialMessage);
      setHasProcessedInitial(true);
    }
  }, [initialMessage, hasProcessedInitial, conversationId, loadedMessages]);

  const getModeLabel = () => {
    switch (aiMode) {
      case 'thinking':
        return 'Thinking';
      case 'web_search':
        return 'Web Search';
      default:
        return 'Auto';
    }
  };

  const getModeIcon = (mode?: AIMode) => {
    if (mode === 'thinking') return <Brain size={12} className="inline mr-1" />;
    if (mode === 'web_search') return <ExternalLink size={12} className="inline mr-1" />;
    return null;
  };

  return (
    <div className='flex flex-col h-screen bg-background'>
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
        >
          New Chat
        </Button>
      </div>

      <div className='flex items-center p-4 border-border'>
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowUpIcon className="rotate-90" size={16} />
          Back
        </Button>
        
        {/* Show personality indicator if set */}
        {personality && (
          <div className="ml-auto flex items-center gap-2 text-xs text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full">
            <Brain size={12} />
            <span>Custom personality active</span>
          </div>
        )}
      </div>

      <div className='flex-1 overflow-y-auto p-6 space-y-4' ref={messagesContainerRef}>
        <div className='max-w-2xl mx-auto space-y-4'>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-full rounded-lg font-Inter p-3 ${
                  message.role === 'user'
                    ? 'bg-[#131313] text-white border'
                    : 'text-[#cccccc]'
                }`}
              >
                {/* Mode indicator for assistant messages */}
                {message.role === "assistant" && message.mode && (
                  <div className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                    {getModeIcon(message.mode)}
                    {message.mode === 'thinking' && 'Reasoning mode'}
                    {message.mode === 'web_search' && 'Web search enabled'}
                  </div>
                )}

                {message.role === "assistant" && index === messages.length - 1 && isLoading === false ? (
                  <TypewriterText text={message.content} />
                ) : (
                  message.content
                )}

                {/* Show reasoning token count if available */}
                {message.role === "assistant" && message.reasoningTokens && (
                  <div className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                    <Brain size={10} />
                    {message.reasoningTokens.toLocaleString()} reasoning tokens used
                  </div>
                )}

                {/* Show citations if available */}
                {message.role === "assistant" && message.citations && message.citations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Sources:</div>
                    <div className="space-y-1">
                      {message.citations.map((citation, idx) => (
                        <a
                          key={idx}
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                        >
                          <ExternalLink size={10} />
                          {citation.title || citation.url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {message.role === "assistant" && (
                  <div className="flex gap-3 mt-2 text-xs text-gray-400">
                    <button onClick={() => handleCopy(message.content)} className="hover:text-white transition">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => handleRegenerate(index)} className="hover:text-white transition">
                      <RotateCcw size={14} />
                    </button>
                    <button
                      onClick={() => handleSpeak(message.content, index)}
                      className="hover:text-white transition"
                    >
                      {speakingIndex === index ? (
                        <Pause size={14} />
                      ) : (
                        <Volume2 size={14} />
                      )}
                    </button>
                    <button onClick={() => handleShare(message.content)} className="hover:text-white transition">
                      <Share size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  {aiMode === 'thinking' && (
                    <span className="text-[10px] text-gray-500 ml-2">Thinking...</span>
                  )}
                  {aiMode === 'web_search' && (
                    <span className="text-[10px] text-gray-500 ml-2">Searching web...</span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className='sticky bottom-0 bg-background p-4 border-border'>
        <div className='max-w-2xl mx-auto'>
          <InputGroup className='rounded-[1.5rem] shadow-lg'>
            <InputGroupTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message Lynx"
              className='mt-2 ml-5'
            />
            <InputGroupAddon align="block-end">
              <InputGroupButton variant="outline" className="rounded-full" size="icon-xs">
                <IconPlus />
              </InputGroupButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton className='cursor-pointer' variant="ghost">
                    {getModeLabel()}
                  </InputGroupButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="[--radius:0.95rem]"
                >
                  <DropdownMenuItem onClick={() => handleModeChange('auto')}>
                    <div className="flex flex-col">
                      <span className="font-medium">Auto</span>
                      <span className="text-[10px] text-gray-500">Standard GPT-4o</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleModeChange('thinking')}>
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-1">
                        <Brain size={12} />
                        Thinking
                      </span>
                      <span className="text-[10px] text-gray-500">Deep reasoning for complex tasks</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleModeChange('web_search')}>
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-1">
                        <ExternalLink size={12} />
                        Web Search
                      </span>
                      <span className="text-[10px] text-gray-500">Search the web for current info</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <InputGroupText className="ml-auto"></InputGroupText>
              <Separator orientation="vertical" className="!h-4" />
              <InputGroupButton
                variant="default"
                className="rounded-full cursor-pointer"
                size="icon-xs"
                disabled={!input || isLoading}
                onClick={handleSend}
              >
                <ArrowUpIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </div>
  );
}