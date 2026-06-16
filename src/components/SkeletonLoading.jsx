export function CallCardSkeleton({ count = 6 }) {
  return (
    <div className="skeletonGrid" aria-label="Çağrılar yükleniyor">
      {Array.from({ length: count }).map((_, index) => (
        <article className="skeletonCard" key={index}>
          <div className="skeletonLine short"></div>
          <div className="skeletonLine title"></div>
          <div className="skeletonLine"></div>
          <div className="skeletonLine wide"></div>
          <div className="skeletonFacts">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </article>
      ))}
    </div>
  );
}
