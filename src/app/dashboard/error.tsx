"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 max-w-md">
      <h2 className="text-lg font-bold text-black mb-2">Something went wrong</h2>
      <p className="text-gray-500 text-sm mb-4">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
