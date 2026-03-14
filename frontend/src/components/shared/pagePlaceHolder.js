export default function PagePlaceholder({ title, description, points = [] }) {
  return (
    <div className="stack">
      <div className="page-header">
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>

      <section className="page-card">
        <h2>What this page will do next</h2>
        <ul className="placeholder-list">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
