// Shown the moment you tap a tab while the next page loads (after Neon has been idle that can take a
// couple of seconds), so the tap never feels ignored.
export default function Loading() {
  return (
    <div className="space-y-4 motion-safe:animate-pulse" role="status" aria-label="Loading">
      <div className="h-8 w-40 rounded-xl bg-gray-100" />
      <div className="h-24 rounded-2xl bg-gray-100" />
      <div className="h-24 rounded-2xl bg-gray-100" />
      <div className="h-24 rounded-2xl bg-gray-100" />
    </div>
  );
}
