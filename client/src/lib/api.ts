import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getAccessToken } from "./auth";
import { getAdminAccessToken } from "./admin-auth";

const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

setBaseUrl(apiBase);

setAuthTokenGetter((url) => {
  if (url && url.includes("/api/admin/")) {
    return getAdminAccessToken();
  }
  return getAccessToken();
});
