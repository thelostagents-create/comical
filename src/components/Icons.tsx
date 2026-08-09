type IconName =
  | "library"
  | "search"
  | "feed"
  | "user"
  | "back"
  | "plus"
  | "check"
  | "star"
  | "book"
  | "sparkle"
  | "palette"
  | "userplus";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "library":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="17" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="17" rx="1.5" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="19.5" y1="19.5" x2="15.2" y2="15.2" />
        </svg>
      );
    case "feed":
      return (
        <svg {...common}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="14" y2="18" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
        </svg>
      );
    case "back":
      return (
        <svg {...common}>
          <polyline points="15 4 7 12 15 20" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <polyline points="4.5 12.5 9.5 17.5 19.5 6.5" />
        </svg>
      );
    case "star":
      return (
        <svg {...{ ...common, fill: "currentColor", stroke: "none" }}>
          <path d="M12 2.5l2.9 6.2 6.7.7-5 4.6 1.4 6.7L12 17.6 6 20.7l1.4-6.7-5-4.6 6.7-.7z" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M5 4.5h9.5A2.5 2.5 0 0117 7v13H7.5A2.5 2.5 0 015 17.5v-13z" />
          <line x1="5" y1="17.5" x2="17" y2="17.5" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...{ ...common, fill: "currentColor", stroke: "none" }}>
          <path d="M12 2.5l1.8 5.7 5.7 1.8-5.7 1.8L12 17.5l-1.8-5.7L4.5 10l5.7-1.8z" />
          <path d="M19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z" />
        </svg>
      );
    case "palette":
      return (
        <svg {...common}>
          <path d="M12 3.5a8.5 8.5 0 100 17c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.7-.5-1.2 0-1 .8-1.7 1.7-1.7H16a4 4 0 004-4c0-4.1-3.6-7-8-7z" />
          <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
          <circle cx="9.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="14" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "userplus":
      return (
        <svg {...common}>
          <circle cx="9.5" cy="8" r="3.3" />
          <path d="M2.8 19c1.3-3.3 4-5 6.7-5s5.4 1.7 6.7 5" />
          <line x1="18" y1="5" x2="18" y2="11" />
          <line x1="15" y1="8" x2="21" y2="8" />
        </svg>
      );
  }
}
