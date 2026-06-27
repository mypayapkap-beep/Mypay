import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SellUpiRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/app/upi"); }, [setLocation]);
  return null;
}
