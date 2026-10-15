export default function SaleLoading() {
  return <div role="status" aria-label="Cargando expediente" className="grid" style={{ gap: 20 }}>
    <div className="skeleton" style={{ height: 36, width: "min(280px,80%)" }} />
    <div className="grid stats"><div className="card skeleton" style={{ height: 134 }} /><div className="card skeleton" style={{ height: 134 }} /><div className="card skeleton" style={{ height: 134 }} /></div>
    <div className="grid split"><div className="card skeleton" style={{ height: 300 }} /><div className="card skeleton" style={{ height: 300 }} /></div>
    <span className="sr-only">Cargando expediente…</span>
  </div>;
}
