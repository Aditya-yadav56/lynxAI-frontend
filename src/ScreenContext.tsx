// ScreenContext.tsx
import { createContext, useContext, useState, ReactNode } from "react";

type Screen = "home" | "chat";

interface ScreenContextType {
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
}

const ScreenContext = createContext<ScreenContextType | undefined>(undefined);

export const ScreenProvider = ({ children }: { children: ReactNode }) => {
  const [currentScreen, setCurrentScreen] = useState<Screen>("home");

  return (
    <ScreenContext.Provider value={{ currentScreen, setCurrentScreen }}>
      {children}
    </ScreenContext.Provider>
  );
};

export const useScreen = () => {
  const context = useContext(ScreenContext);
  if (!context) throw new Error("useScreen must be used within ScreenProvider");
  return context;
};
