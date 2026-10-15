export default function CustomerLoading() {
  return <div role="status" aria-label="Cargando ficha de cliente" className="grid" style={{ gap: 20 }}>
    <div className="skeleton" style={{ height: 36, width: "min(340px,80%)" }} />
    <div className="grid split"><div className="card skeleton" style={{ height: 280 }} /><div className="card skeleton" style={{ height: 280 }} /></div>
    <span className="sr-only">Cargando ficha de cliente…</span>
  </div>;
}
