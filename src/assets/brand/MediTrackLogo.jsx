export function MediTrackMark({ size = 40, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="MediTrack Clinic" {...props}>
      <defs>
        <linearGradient id="mtGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5FE3D1" />
          <stop offset="1" stopColor="#0D8FA2" />
        </linearGradient>
        <mask id="mtMask">
          <rect x="0" y="0" width="200" height="200" fill="#fff" />
          <rect x="20" y="56" width="160" height="10" rx="5" fill="#000" />
          <rect x="86" y="82" width="28" height="88" rx="14" fill="#000" />
          <rect x="56" y="112" width="88" height="28" rx="14" fill="#000" />
          <rect x="64" y="20" width="15" height="30" rx="7.5" fill="#000" />
          <rect x="121" y="20" width="15" height="30" rx="7.5" fill="#000" />
        </mask>
      </defs>
      <rect x="14" y="30" width="172" height="156" rx="42" fill="url(#mtGrad)" mask="url(#mtMask)" />
    </svg>
  );
}

export function MediTrackLogo({ size = 48, tone = "dark" }) {
  const word = tone === "dark" ? "#FFFFFF" : "#0B2A2B";
  const sub = tone === "dark" ? "#2DD4BF" : "#0F9488";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.34, fontFamily: "Poppins, Helvetica, sans-serif" }}>
      <MediTrackMark size={size} />
      <div style={{ display: "flex", flexDirection: "column", gap: size * 0.08 }}>
        <span style={{ fontSize: size * 0.72, fontWeight: 600, color: word, lineHeight: 1 }}>MediTrack</span>
        <span style={{ fontSize: size * 0.26, fontWeight: 500, letterSpacing: "0.4em", color: sub, lineHeight: 1 }}>CLINIC</span>
      </div>
    </div>
  );
}
