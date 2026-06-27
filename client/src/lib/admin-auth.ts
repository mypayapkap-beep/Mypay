const ADMIN_TOKEN_KEY = "mypay_admin_token";

export const getAdminAccessToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);

export const setAdminSession = (accessToken: string) => {
  localStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
};

export const clearAdminSession = () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
};

export const isAdminAuthenticated = () => !!getAdminAccessToken();