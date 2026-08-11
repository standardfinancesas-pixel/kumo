export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2 font-heading font-extrabold text-brand-deep">
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <rect width="100" height="100" rx="24" fill="#5D5491" />
        <g transform="translate(30,34)">
          <path
            d="M8 20a10 10 0 0 1 0-20h14a9 9 0 0 1 3 17.5A8 8 0 0 1 30 32H8a6 6 0 0 1 0-12z"
            fill="none"
            stroke="#E1FB62"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <span style={{ fontSize: size * 0.62 }}>Kumo</span>
    </span>
  );
}
