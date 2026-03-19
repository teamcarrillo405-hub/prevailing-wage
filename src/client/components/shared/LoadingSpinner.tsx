export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <svg
        className="animate-spin"
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        aria-label="Loading"
      >
        <circle
          cx="20"
          cy="20"
          r="16"
          stroke="#e5e7eb"
          strokeWidth="4"
        />
        <path
          d="M20 4a16 16 0 0 1 16 16"
          stroke="#F5C518"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
