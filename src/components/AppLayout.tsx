import { Outlet, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AuroraBackground } from "./AuroraBackground";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsButton } from "./NotificationsButton";
import { AiAssistant } from "./AiAssistant";

export function AppLayout() {
  const location = useLocation();
  return (
    <SidebarProvider>
      <AuroraBackground />
      <div className="relative flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/40 bg-background/40 px-4 backdrop-blur-xl md:px-6">
            <SidebarTrigger className="text-muted-foreground hover:text-primary" />

            <GlobalSearch />

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden md:block">
                <NotificationsButton />
              </div>
              <ConnectButton
                showBalance={{ smallScreen: false, largeScreen: true }}
                chainStatus="icon"
                accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
              />
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden p-4 md:p-8">
            {/* Re-mount on route change so the pop-in animation replays smoothly */}
            <div key={location.pathname} className="mx-auto max-w-7xl animate-pop-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <AiAssistant />
    </SidebarProvider>
  );
}
