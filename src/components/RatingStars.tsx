export default function RatingStars({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange?: (rating: number) => void;
  size?: number;
}) {
  const interactive = Boolean(onChange);
  return (
    <span className="rating-stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${n <= value ? "filled" : ""} ${interactive ? "interactive" : ""}`}
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
