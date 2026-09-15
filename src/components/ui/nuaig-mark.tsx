/** The NuAIg square mark (from the wordmark). `inverted` swaps the ink part to white for dark surfaces. */
export function NuaigMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="26 17 101 101" className={className} role="img" aria-label="NuAIg">
      <polygon
        fill={inverted ? "#F2F5F8" : "#111111"}
        points="122.872,67.785 110.112,55.025 110.112,101.648 42.834,101.648 42.834,34.37 89.458,34.37 76.698,21.611 30.074,21.611 30.074,114.408 122.872,114.408"
      />
      <polygon
        fill="#069BDF"
        points="110.112,34.37 110.112,42.372 122.872,55.133 122.872,21.611 89.352,21.611 102.11,34.37"
      />
    </svg>
  );
}
