import { Shield, Map, Navigation, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AuthButton from "./AuthButton";

import { useAuth } from "@/contexts/AuthContext";

export function Header() {
  const { user } = useAuth();
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground">SafeRoute AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Home
          </Link>
          <Link to="/navigate" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Navigate
          </Link>
          <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/navigate">
                  <Map className="w-4 h-4" />
                  Open Map
                </Link>
              </Button>
              <Button variant="hero" size="sm" asChild>
                <Link to="/navigate">
                  <Navigation className="w-4 h-4" />
                  Plan Route
                </Link>
              </Button>
            </>
          )}
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
