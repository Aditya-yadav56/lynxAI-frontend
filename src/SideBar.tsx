import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Home, Bot, Key, Settings, ChevronLeft, Sparkles } from "lucide-react";
import { db, auth } from "@/(auth)/firebase";
import { collection, onSnapshot, orderBy, query, doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const items = [
  { title: "Home", url: "#", icon: Home },
  { title: "Your AIs", url: "#", icon: Bot, action: "personality" },
  { title: "API", url: "#", icon: Key },
  { title: "Settings", url: "#", icon: Settings },
];

interface SideBarProps {
  onSelectConversation: (conversationId: string, messages: any[]) => void;
  currentConversationId?: string | null;
  onPersonalityChange?: (personality: string) => void;
}

const SideBar = ({ 
  onSelectConversation, 
  currentConversationId,
  onPersonalityChange 
}: SideBarProps) => {
  const { toggleSidebar, open } = useSidebar();
  const [conversations, setConversations] = useState<
    { id: string; title: string; messages: any[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showPersonalityDialog, setShowPersonalityDialog] = useState(false);
  const [showSignUpDialog, setShowSignUpDialog] = useState(false);
  const [personality, setPersonality] = useState("");
  const [savingPersonality, setSavingPersonality] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Predefined personality templates
  const personalityTemplates = [
    {
      name: "Professional",
      description: "Formal and business-focused",
      prompt: "You are a professional AI assistant. Be formal, concise, and business-oriented in your responses."
    },
    {
      name: "Friendly",
      description: "Warm and conversational",
      prompt: "You are a friendly AI assistant. Be warm, approachable, and conversational while maintaining helpfulness."
    },
    {
      name: "Technical",
      description: "Detailed and precise",
      prompt: "You are a technical AI assistant. Provide detailed, precise explanations with technical accuracy and examples."
    },
    {
      name: "Creative",
      description: "Imaginative and inspiring",
      prompt: "You are a creative AI assistant. Think outside the box, provide imaginative solutions, and inspire creativity."
    },
    {
      name: "Tutor",
      description: "Patient and educational",
      prompt: "You are a patient tutor. Break down complex topics into simple steps, ask guiding questions, and ensure understanding."
    }
  ];

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        loadPersonality(user.uid);
      } else {
        setUserId(null);
        setConversations([]);
        setPersonality("");
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Load user's saved personality
  const loadPersonality = async (uid: string) => {
    try {
      const personalityDoc = await getDoc(doc(db, "users", uid, "settings", "personality"));
      if (personalityDoc.exists()) {
        const savedPersonality = personalityDoc.data().prompt || "";
        setPersonality(savedPersonality);
        if (onPersonalityChange) {
          onPersonalityChange(savedPersonality);
        }
      }
    } catch (error) {
      console.error("Error loading personality:", error);
    }
  };

  // Save personality to Firestore
  const savePersonality = async () => {
    if (!userId) return;

    setSavingPersonality(true);
    try {
      await setDoc(doc(db, "users", userId, "settings", "personality"), {
        prompt: personality,
        updatedAt: new Date(),
      });

      if (onPersonalityChange) {
        onPersonalityChange(personality);
      }

      setShowPersonalityDialog(false);
    } catch (error) {
      console.error("Error saving personality:", error);
      alert("Failed to save personality. Please try again.");
    } finally {
      setSavingPersonality(false);
    }
  };

  // Load conversations with real-time updates
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setLoading(true);

    const q = query(
      collection(db, "users", userId, "conversations"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      {
        includeMetadataChanges: true,
      },
      (snapshot) => {
        const convos = snapshot.docs.map((doc) => {
          const data = doc.data();
          const messages = data.messages || [];
          const firstMessage = messages[0]?.content || "";
          
          return {
            id: doc.id,
            messages: messages,
            title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "") || "New Chat",
          };
        });
        
        setConversations(convos);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading conversations:", error);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userId]);

  const handleSidebarClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) return;
    toggleSidebar();
  };

  const handleConversationClick = (conversationId: string, messages: any[]) => {
    onSelectConversation(conversationId, messages);
  };

  const handleItemClick = (item: typeof items[0], e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (item.action === "personality") {
      if (!userId) {
        setShowSignUpDialog(true);
      } else {
        setShowPersonalityDialog(true);
      }
    }
  };

  const applyTemplate = (template: typeof personalityTemplates[0]) => {
    setPersonality(template.prompt);
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="cursor-ew-resize [&_button]:cursor-pointer [&_a]:cursor-pointer [&>div]:bg-[#070707]"
        onClick={handleSidebarClick}
      >
        <SidebarHeader>
          <div className="flex items-center justify-between p-2">
            <h2 className="text-lg font-semibold"></h2>
            {open && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSidebar();
                }}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <ChevronLeft size={20} />
              </button>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a 
                        href={item.url}
                        onClick={(e) => handleItemClick(item, e)}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>
              Chats {conversations.length > 0 && `(${conversations.length})`}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {loading ? (
                <div className="px-4 py-2 text-sm text-gray-400">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-400">No chats yet</div>
              ) : (
                <SidebarMenu>
                  {conversations.map((conv) => (
                    <SidebarMenuItem key={conv.id}>
                      <SidebarMenuButton 
                        asChild
                        isActive={currentConversationId === conv.id}
                      >
                        <button
                          className="w-full text-left truncate"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConversationClick(conv.id, conv.messages);
                          }}
                        >
                          <span className="truncate">{conv.title}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* AI Personality Dialog */}
      <Dialog open={showPersonalityDialog} onOpenChange={setShowPersonalityDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Customize Your AI Personality
            </DialogTitle>
            <DialogDescription>
              Define how your AI assistant should behave and respond. This will apply to all your conversations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Personality Templates */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Quick Templates</Label>
              <div className="grid grid-cols-2 gap-2">
                {personalityTemplates.map((template) => (
                  <Button
                    key={template.name}
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(template)}
                    className="justify-start h-auto py-2 px-3"
                  >
                    <div className="text-left">
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-gray-500">{template.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Personality Input */}
            <div>
              <Label htmlFor="personality" className="text-sm font-medium mb-2 block">
                Custom Personality
              </Label>
              <Textarea
                id="personality"
                placeholder="Example: You are a helpful assistant who loves to explain things with analogies and real-world examples. Be encouraging and supportive..."
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                className="min-h-[150px] resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Describe how you want your AI to behave, its tone, style, and any specific guidelines.
              </p>
            </div>

            {/* Current Status */}
            {personality && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-purple-400 mb-1">Active Personality</div>
                    <div className="text-gray-400 line-clamp-2">{personality}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPersonalityDialog(false)}
              disabled={savingPersonality}
            >
              Cancel
            </Button>
            <Button
              onClick={savePersonality}
              disabled={savingPersonality || !personality.trim()}
            >
              {savingPersonality ? "Saving..." : "Save Personality"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Up Dialog */}
      <Dialog open={showSignUpDialog} onOpenChange={setShowSignUpDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Sign Up Required</DialogTitle>
            <DialogDescription>
              You need to be signed in to customize your AI personality and save your preferences.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <div className="font-medium">Custom AI Personalities</div>
                  <div className="text-gray-500 text-xs">Define how your AI behaves</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="font-medium">Save Conversations</div>
                  <div className="text-gray-500 text-xs">Access your chats anywhere</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <div className="font-medium">Sync Across Devices</div>
                  <div className="text-gray-500 text-xs">Seamless experience everywhere</div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button 
              className="w-full"
              onClick={() => {
                // Redirect to sign up page
                window.location.href = "/signup";
              }}
            >
              Sign Up Now
            </Button>
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => setShowSignUpDialog(false)}
            >
              Maybe Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SideBar;