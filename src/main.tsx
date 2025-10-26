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
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface ChatRouteProps {
  personality: string;
}

function ChatRoute({ personality }: ChatRouteProps) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadedMessages, setLoadedMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialMessage, setInitialMessage] = useState("");

  useEffect(() => {
    // Check for initial message from navigation state
    if (location.state?.initialMessage) {
      setInitialMessage(location.state.initialMessage);
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
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
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

  const handleSelectConversation = (conversationId: string, messages: any[]) => {
    // Navigate to the conversation URL
    navigate(`/chat/${conversationId}`);
  };

  const handleNewChat = () => {
    navigate("/");
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