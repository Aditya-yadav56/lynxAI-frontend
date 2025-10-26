import './App.css'
import { ArrowUpIcon, Brain, Sparkles } from "lucide-react"
import { IconPlus } from "@tabler/icons-react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from './components/ui/input-group'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './components/ui/dropdown-menu'
import { Separator } from './components/ui/separator'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '@/(auth)/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import { Dialog, DialogContent, DialogTitle, DialogClose, DialogFooter } from './components/ui/dialog'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { collection, doc } from 'firebase/firestore'
import { db } from '@/(auth)/firebase'

interface AppProps {
  personality?: string;
}

type AIMode = 'auto' | 'thinking' | 'web_search';

function App({ personality = "" }: AppProps) {
  document.documentElement.classList.add('dark');
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [user, setUser] = useState(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [aiMode, setAiMode] = useState<AIMode>('auto');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSend = () => {
    console.log("handleSend called", { user, input, aiMode });
    
    if (!user) {
      console.log("No user, opening sign in dialog");
      setSignInOpen(true);
      return;
    }
    
    if (!input.trim()) {
      console.log("Empty input, returning");
      return;
    }

    // Create a new conversation ID
    const newConversationId = doc(collection(db, "users", user.uid, "conversations")).id;
    
    console.log("Navigating to chat:", {
      conversationId: newConversationId,
      initialMessage: input,
      aiMode: aiMode
    });
    
    // Navigate to chat with the message and mode as URL state
    navigate(`/chat/${newConversationId}`, { 
      state: { 
        initialMessage: input,
        aiMode: aiMode 
      } 
    });
    
    setInput("");
  };

  const handleSignIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setSignInOpen(false);
      setEmail("");
      setPassword("");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

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

  const handleModeChange = (mode: AIMode) => {
    setAiMode(mode);
  };

  return (
    <>
      <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Sign In to Continue</DialogTitle>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="name@example.com"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSignIn();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Enter your password"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSignIn();
                }}
              />
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Save conversations across devices
              </p>
              <p className="flex items-center gap-2">
                <Brain className="w-3 h-3 text-blue-400" />
                Customize AI personality
              </p>
            </div>
          </div>
          <DialogFooter >
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSignIn}>Sign In</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className='flex flex-col min-h-screen justify-end pb-40 items-center'>
        <div className="text-center mb-10 space-y-4">
          <h1 className='font-coolvetica text-3xl'>
            "See beyond the obvious."
          </h1>
          
          {/* Personality indicator */}
          {personality && user && (
            <div className="inline-flex items-center gap-2 text-sm text-purple-400 bg-purple-500/10 px-4 py-2 rounded-full animate-in fade-in slide-in-from-top-2 duration-500">
              <Sparkles className="w-4 h-4" />
              <span>Custom personality active</span>
            </div>
          )}

          {/* User status */}
          {user && (
            <p className="text-xs text-gray-500">
              Signed in as {user.email}
            </p>
          )}
        </div>

        <div className='w-1/2'>
          <InputGroup className='rounded-[1.5rem] shadow-lg'>
            <InputGroupTextarea 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message Lynx"
              className='mt-2 ml-5' 
            />
            <InputGroupAddon align="block-end">
              <InputGroupButton
                variant="outline"
                className="rounded-full"
                size="icon-xs"
              >
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
                  <DropdownMenuItem 
                    className='cursor-pointer'
                    onClick={() => handleModeChange('auto')}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">Auto</span>
                      <span className="text-[10px] text-gray-500">Standard GPT-4o</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className='cursor-pointer'
                    onClick={() => handleModeChange('thinking')}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        Thinking
                      </span>
                      <span className="text-[10px] text-gray-500">Deep reasoning for complex tasks</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className='cursor-pointer'
                    onClick={() => handleModeChange('web_search')}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
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
                disabled={!input}
                onClick={handleSend}
              > 
                <ArrowUpIcon />
                <span className="sr-only">Send</span>
              </InputGroupButton> 
            </InputGroupAddon>
          </InputGroup>

          {/* Mode indicator below input */}
          {aiMode !== 'auto' && (
            <div className="mt-2 text-center">
              <span className="text-xs text-gray-500">
                {aiMode === 'thinking' && '🧠 Using reasoning mode'}
                {aiMode === 'web_search' && '🌐 Web search enabled'}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className='flex justify-center mb-5'>
        <p className='text-[10px] text-muted-foreground absolute'>
          By Using Lynx you agree to the Terms and Privacy
        </p>
      </div>
    </> 
  )
}

export default App