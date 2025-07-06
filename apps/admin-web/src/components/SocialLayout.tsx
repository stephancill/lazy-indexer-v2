import { Link, useLocation } from "react-router-dom";
import { Home, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType, ReactNode } from "react";

interface SocialNavLinkProps {
  to: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}

const SocialNavLink = ({ to, icon: Icon, children }: SocialNavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={cn(
        "flex items-center space-x-3 px-6 py-3 rounded-lg transition-colors hover:bg-gray-100",
        isActive && "bg-blue-50 text-blue-600 font-medium"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{children}</span>
    </Link>
  );
};

interface SocialLayoutProps {
  children: ReactNode;
}

const SocialLayout = ({ children }: SocialLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex max-w-6xl mx-auto">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
          <div className="p-4">
            <h1 className="text-xl font-bold text-blue-600">Farcaster</h1>
          </div>

          <nav className="mt-8 space-y-2">
            <SocialNavLink to="/social" icon={Home}>
              Home
            </SocialNavLink>
            <SocialNavLink to="/social/search" icon={Search}>
              Search
            </SocialNavLink>
            <SocialNavLink to="/dashboard" icon={Settings}>
              Admin
            </SocialNavLink>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-screen">{children}</div>
      </div>
    </div>
  );
};

export default SocialLayout;
