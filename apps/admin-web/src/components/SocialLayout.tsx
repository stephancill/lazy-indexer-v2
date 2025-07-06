import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Home,
  Search,
  Settings,
  LogOut,
  MessageSquare,
  TrendingUp,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
} from "./ui/sidebar";
import type { ReactNode } from "react";

interface SocialLayoutProps {
  children: ReactNode;
}

const SocialLayout = ({ children }: SocialLayoutProps) => {
  const { logout } = useAuth();

  const navigation = [
    { name: "Home", href: "/social", icon: Home },
    { name: "Search", href: "/social/search", icon: Search },
    { name: "Profile", href: "/social/profile/1", icon: User },
    { name: "Trending", href: "/social/trending", icon: TrendingUp },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <div className="flex items-center">
                    <MessageSquare className="h-8 w-8 text-blue-600" />
                    <span className="ml-2 text-xl font-bold text-gray-900">
                      Farcaster
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        className={({ isActive }) =>
                          isActive ? "bg-blue-100 text-blue-700" : ""
                        }
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            <SidebarSeparator className="my-4" />

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      isActive ? "bg-gray-100 text-gray-700" : "text-gray-600"
                    }
                  >
                    <Settings className="h-5 w-5" />
                    <span>Admin Panel</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter>
            <SidebarSeparator />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col relative">
          <SidebarTrigger className="absolute top-4 left-4 z-50 bg-white shadow-md rounded-md border" />
          <main className="flex-1 p-0 md:px-6">
            <div className="max-w-lg mx-auto w-full">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default SocialLayout;
