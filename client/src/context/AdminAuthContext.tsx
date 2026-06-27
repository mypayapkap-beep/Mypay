import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetAdminMe, getGetAdminMeQueryKey } from "@workspace/api-client-react";
import { isAdminAuthenticated, clearAdminSession } from "@/lib/admin-auth";

type AdminInfo = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

interface AdminAuthContextType {
  admin: AdminInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuth, setIsAuth] = useState(isAdminAuthenticated());
  
  const { data: adminData, isLoading, error: adminMeError } = useGetAdminMe({
    query: {
      enabled: isAuth,
      retry: false,
      queryKey: getGetAdminMeQueryKey(),
    }
  });

  useEffect(() => {
    if (!adminMeError) return;
    const status = (adminMeError as any)?.status;
    if (status === 401 || status === 403) {
      clearAdminSession();
      setIsAuth(false);
    }
  }, [adminMeError]);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuth(isAdminAuthenticated());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const logout = () => {
    clearAdminSession();
    setIsAuth(false);
    window.location.href = "/admin/login";
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin: adminData?.admin || null,
        isAuthenticated: isAuth,
        isLoading,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuthContext() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuthContext must be used within an AdminAuthProvider");
  }
  return context;
}
