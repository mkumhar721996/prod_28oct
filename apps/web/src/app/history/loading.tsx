export default function HistoryLoading() {
  return (
    <div className="narrow stack stack-4">
      <h1>History</h1>
      <div className="stack stack-2" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="skeleton" />
        ))}
      </div>
    </div>
  );
}
