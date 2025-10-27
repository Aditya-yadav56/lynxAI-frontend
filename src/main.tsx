// main.tsx or index.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>
);

// Root.tsx
import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useParams, useLocation } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import NavBar from "./NavBar.tsx";
import SideBar from "./SideBar.tsx";
import { ChatScreen } from "./ChatScreen.tsx";
import { SidebarProvider } from "@/components/ui/sidebar";
import { db, auth } from "@/(auth)/firebase";
import { doc, getDoc, onSnapshot, DocumentSnapshot,  } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import type {DocumentData} from "firebase/firestore";
interface ChatRouteProps {
  personality: string;
}

interface Message {
  role: string;
  content: string;
  citations?: Array<{ url: string; title?: string }>;
  reasoningTokens?: number;
  mode?: 'auto' | 'thinking' | 'web_search';
}

interface LocationState {
  initialMessage?: string;
  aiMode?: 'auto' | 'thinking' | 'web_search';
}

interface ConversationData {
  messages?: Message[];
  createdAt?: any;
}

interface PersonalityData {
  prompt?: string;
}

function ChatRoute({ personality }: ChatRouteProps) {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadedMessages, setLoadedMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialMessage, setInitialMessage] = useState("");

  useEffect(() => {
    const state = location.state as LocationState | null;
    
    // Check for initial message from navigation state
    if (state?.initialMessage) {
      setInitialMessage(state.initialMessage);
      setLoading(false);
      // Clear the state after reading it
      window.history.replaceState({}, document.title);
      return;
    }

    if (!conversationId) {
      setLoading(false);
      return;
    }

    const loadConversation = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/");
        return;
      }

      try {
        const docRef = doc(db, "users", user.uid, "conversations", conversationId);
        const docSnap: DocumentSnapshot<DocumentData> = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as ConversationData;
          setLoadedMessages(data.messages || []);
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [conversationId, navigate, location]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">Loading conversation...</div>
      </div>
    );
  }

  return (
    <ChatScreen
      conversationId={conversationId || null}
      initialMessage={initialMessage}
      loadedMessages={loadedMessages}
      onBack={() => navigate("/")}
      onNewChat={() => navigate("/")}
      personality={personality}
    />
  );
}

function Root() {
  const navigate = useNavigate();
  const [aiPersonality, setAiPersonality] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setAiPersonality(""); // Clear personality when logged out
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen to personality changes in real-time
  useEffect(() => {
    if (!userId) return;

    const personalityDocRef = doc(db, "users", userId, "settings", "personality");
    
    // Set up real-time listener for personality changes
    const unsubscribe = onSnapshot(
      personalityDocRef,
      (docSnap: DocumentSnapshot<DocumentData>) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as PersonalityData;
          setAiPersonality(data.prompt || "");
        } else {
          setAiPersonality("");
        }
      },
      (error) => {
        console.error("Error listening to personality changes:", error);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const handleSelectConversation = (conversationId: string) => {
    // Navigate to the conversation URL
    navigate(`/chat/${conversationId}`);
  };


  const handlePersonalityChange = (personality: string) => {
    setAiPersonality(personality);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <SideBar 
          onSelectConversation={handleSelectConversation}
          onPersonalityChange={handlePersonalityChange}
        />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={
              <>
                <NavBar />
                <main className="flex-1">
                  <App personality={aiPersonality} />
                </main>
              </>
            } />
            <Route 
              path="/chat/:conversationId" 
              element={<ChatRoute personality={aiPersonality} />} 
            />
          </Routes>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default Root;