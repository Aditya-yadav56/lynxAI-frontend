import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import NavBar from './NavBar.tsx'
import SideBar from './SideBar.tsx'
import { SidebarProvider } from "@/components/ui/sidebar"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <SideBar />
        <div className="flex-1 flex flex-col">
          <NavBar />
          <main className="flex-1">
            <App />
          </main>
        </div>
      </div>
    </SidebarProvider>
  </StrictMode>,
)