import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { isAuthenticated, clearSession, getAccessToken, getRefreshToken, setSession } from "@/lib/auth";

const _apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

type User = {
  id?: string;
  name?: string;
  mobile?: string;
  referralCode?: string;
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuth, setIsAuth] = useState(isAuthenticated());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = (accessToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const expiry = getJwtExpiry(accessToken);
    if (!expiry) return;
    const refreshIn = expiry - Date.now() - 2 * 60 * 1000;
    if (refreshIn <= 0) {
      doRefresh();
      return;
    }
    refreshTimerRef.current = setTimeout(doRefresh, refreshIn);
  };

  const doRefresh = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) { logout(); return; }
    try {
      const res = await fetch(`${_apiBase}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) { logout(); return; }
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) { logout(); return; }
      const data = await res.json() as { session?: { accessToken: string; refreshToken: string } };
      if (data.session?.accessToken) {
        setSession(data.session.accessToken, data.session.refreshToken);
        scheduleRefresh(data.session.accessToken);
      } else {
        logout();
      }
    } catch {
      logout();
    }
  };

  const { data: meData, isLoading } = useGetMe({
    query: {
      enabled: isAuth,
      retry: false,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    const token = getAccessToken();
    if (token) scheduleRefresh(token);
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); };
  }, [isAuth]);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuth(isAuthenticated());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = (accessToken: string, refreshToken?: string) => {
    setSession(accessToken, refreshToken);
    setIsAuth(true);
    scheduleRefresh(accessToken);
  };

  const logout = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    clearSession();
    setIsAuth(false);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user: meData?.user || null,
        isAuthenticated: isAuth,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
