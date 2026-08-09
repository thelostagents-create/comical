type IconName = "library" | "search" | "feed" | "user" | "back" | "plus" | "check";

const paths: Record<IconName, string> = {
  library: "M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z",
  search: "M10 4a6 6 0 104.47 10.03l4.75 4.75 1.42-1.42-4.75-4.75A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z",
  feed: "M4 4h2v16H4zM9 4h11v2H9zM9 9h11v2H9zM9 14h11v2H9zM9 19h7v2H9z",
  user: "M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-8 2.24-8 5v1h16v-1c0-2.76-3.6-5-8-5z",
  back: "M15 4l-8 8 8 8 1.4-1.4L9.8 12l6.6-6.6z",
  plus: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z",
  check: "M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.4-1.4z",
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
