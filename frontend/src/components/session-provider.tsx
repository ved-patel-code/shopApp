"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

// Define the shape of our context
interface SessionContextType {
  token: string | null;
  isLoading: boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// This is a custom hook to easily access the session context
export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

// This is the main provider component
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // On component mount, check if a token exists in localStorage
    const storedToken = localStorage.getItem("accessToken");
    if (storedToken) {
      setToken(storedToken);
    } else {
      // If no token, redirect to login page
      router.push("/login");
    }
    setIsLoading(false);
  }, [router]);

  const logout = () => {
    // Clear token from state and localStorage, then redirect
    setToken(null);
    localStorage.removeItem("accessToken");
    router.push("/login");
  };

  // While loading, we can show a spinner or a blank screen
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        {/* You can use a more sophisticated spinner component here if you like */}
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"></div>
      </div>
    );
  }

  // If there's no token after checking, the redirect has already been triggered,
  // but we can return null to prevent rendering the children.
  if (!token) {
    return null;
  }

  return (
    <SessionContext.Provider value={{ token, isLoading, logout }}>
      {children}
    </SessionContext.Provider>
  );
}
