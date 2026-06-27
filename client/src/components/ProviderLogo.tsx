interface ProviderLogoProps {
  provider: string;
  size?: number;
  className?: string;
}

const LOGOS: Record<string, (size: number) => React.ReactNode> = {
  phonepe: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#5F259F"/>
      <path d="M27.5 10H18C16.9 10 16 10.9 16 12V36C16 37.1 16.9 38 18 38H30C31.1 38 32 37.1 32 36V18.5L27.5 10Z" fill="white"/>
      <path d="M27.5 10V18.5H32L27.5 10Z" fill="#D1B3FF"/>
      <circle cx="24" cy="27" r="5" fill="#5F259F"/>
      <circle cx="24" cy="27" r="3" fill="white"/>
      <rect x="24" y="22" width="2" height="10" rx="1" fill="#5F259F"/>
    </svg>
  ),
  paytm: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#002970"/>
      <rect x="8" y="20" width="32" height="8" rx="2" fill="#00B9F1"/>
      <text x="24" y="17" fontFamily="Arial" fontWeight="900" fontSize="12" fill="white" textAnchor="middle">pay</text>
      <text x="24" y="34" fontFamily="Arial" fontWeight="900" fontSize="7" fill="#00B9F1" textAnchor="middle">TM</text>
    </svg>
  ),
  mobikwik: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#1A3FAA"/>
      <text x="24" y="30" fontFamily="Arial" fontWeight="900" fontSize="20" fill="white" textAnchor="middle">MK</text>
      <rect x="12" y="34" width="24" height="2" rx="1" fill="#5BC4FF"/>
    </svg>
  ),
  airtel: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#E40000"/>
      <path d="M24 12C17.4 12 12 17.4 12 24C12 30.6 17.4 36 24 36C28.8 36 32.8 33.3 34.9 29.4" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
      <path d="M30 14L36 14L36 20" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24 18C20.7 18 18 20.7 18 24C18 27.3 20.7 30 24 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </svg>
  ),
  freecharge: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#00A650"/>
      <path d="M26 10L18 26H24L20 38L34 20H26L30 10H26Z" fill="white"/>
    </svg>
  ),
  navi: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="12" fill="#00A1E4"/>
      <text x="24" y="31" fontFamily="Arial" fontWeight="900" fontSize="18" fill="white" textAnchor="middle">navi</text>
    </svg>
  ),
};

const FALLBACK_COLORS: Record<string, string> = {
  phonepe: "#5F259F",
  paytm: "#002970",
  mobikwik: "#1A3FAA",
  airtel: "#E40000",
  freecharge: "#00A650",
};

export function ProviderLogo({ provider, size = 40, className }: ProviderLogoProps) {
  const logoFn = LOGOS[provider?.toLowerCase()];

  if (logoFn) {
    return (
      <span className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {logoFn(size)}
      </span>
    );
  }

  const color = FALLBACK_COLORS[provider?.toLowerCase()] ?? "#6B7280";
  const letter = (provider ?? "?")[0]?.toUpperCase() ?? "?";
  const radius = Math.round(size * 0.25);

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width={size} height={size} rx={radius} fill={color} />
        <text
          x={size / 2}
          y={size / 2 + size * 0.12}
          fontFamily="Arial"
          fontWeight="700"
          fontSize={size * 0.45}
          fill="white"
          textAnchor="middle"
        >
          {letter}
        </text>
      </svg>
    </span>
  );
}

export const PROVIDER_INFO: Record<string, { name: string; color: string; suffix: string }> = {
  phonepe: { name: "PhonePe", color: "#5F259F", suffix: "@ybl" },
  paytm: { name: "Paytm", color: "#002970", suffix: "@paytm" },
  mobikwik: { name: "MobiKwik", color: "#1A3FAA", suffix: "@ikwik" },
  airtel: { name: "Airtel Money", color: "#E40000", suffix: "@airtel" },
  freecharge: { name: "Freecharge", color: "#00A650", suffix: "@freecharge" },
  navi: { name: "Navi", color: "#00A1E4", suffix: "@naviaxis" },
};

export function getProviderName(provider: string): string {
  return PROVIDER_INFO[provider?.toLowerCase()]?.name ?? provider?.toUpperCase() ?? "Unknown";
}
