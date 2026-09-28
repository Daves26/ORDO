"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; name: string; email: string; active: boolean; version: number; roles: { role: { code: string } }[] };
const roles = ["ASESOR", "BACK_OFFICE", "CONTABILIDAD", "GERENTE", "ADMINISTRADOR"] as const;
const codes = (user: User) => user.roles.map(({ role }) => role.code);

export function UsersAdmin({ ownId }: { ownId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [createError, setCreateError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedUser = users.find((user) => user.id === selectedId);
  const roleChanged = !!selectedUser && [...codes(selectedUser)].sort().join("|") !== [...selectedRoles].sort().join("|");

  const load = useCallback(async () => {
    const response = await fetch("/api/users");
    if (response.ok) setUsers((await response.json()).users);
  }, []);
  useEffect(() => { void load(); }, [load]);

  function edit(user: User) {
    setSelectedId(user.id); setSelectedRoles(codes(user)); setRoleError(""); setReason(""); setMessage("");
  }

  async function updateRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !roleChanged || !selectedRoles.length) return;
    setBusy(true); setRoleError(""); setMessage("");
    try {
      const response = await fetch(`/api/users/${selectedUser.id}/roles`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: selectedUser.version, roles: selectedRoles, reason }),
      });
      const result = await response.json();
      if (!response.ok) { setRoleError(result.error ?? "No se pudieron guardar los roles."); return; }
      await load(); setSelectedId(null); setReason(""); setMessage(`Roles de ${selectedUser.name} actualizados.`);
      if (selectedUser.id === ownId) router.refresh();
    } catch { setRoleError("No se pudo conectar. Comprueba los roles antes de reintentar."); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setCreateError(""); setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password: data.get("password"), roles: data.getAll("roles") }) });
      if (!response.ok) { setCreateError((await response.json()).error); return; }
      form.reset(); setMessage("Usuario creado. Entrégale sus credenciales por un canal seguro."); await load();
    } catch { setCreateError("No fue posible crear el usuario."); }
    finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">Administración técnica</span><h1>Usuarios y roles</h1><p className="muted">El rol de administrador gestiona accesos; las funciones operativas requieren asignar sus roles.</p></div></div>
    {message && <p role="status" className="notice success">{message}</p>}
    <div className="grid split"><section className="card"><h2>Equipo</h2>
      {users.map((user) => <div key={user.id} className="list-row"><span><strong>{user.name}{user.id === ownId ? " · Mi cuenta" : ""}</strong><br /><span className="muted small">{user.email}</span><br /><span className="small">{codes(user).join(" · ")}</span></span><button type="button" className="btn" onClick={() => edit(user)} disabled={busy} aria-label={`Editar roles de ${user.name}`}>Editar roles</button></div>)}
      {selectedUser && <form onSubmit={updateRoles} style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 20 }}>
        <h2>Roles de {selectedUser.name}{selectedUser.id === ownId ? " (mi cuenta)" : ""}</h2>
        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 9, padding: 14 }}><legend style={{ fontWeight: 700 }}>Roles asignados</legend>{roles.map((role) => <label key={role} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}><input type="checkbox" name="rolesEdit" value={role} checked={selectedRoles.includes(role)} onChange={(event) => setSelectedRoles((previous) => event.target.checked ? [...previous, role] : previous.filter((code) => code !== role))} />{role.replaceAll("_", " ")}</label>)}</fieldset>
        <div className="field" style={{ marginTop: 15 }}><label htmlFor="role-reason">Motivo del cambio *</label><textarea id="role-reason" rows={2} minLength={3} maxLength={300} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Cambio de responsabilidades" /></div>
        {roleError && <p role="alert" className="notice error">{roleError}</p>}
        <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={() => setSelectedId(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy || !roleChanged || !selectedRoles.length || reason.trim().length < 3}>{busy ? "Guardando…" : "Guardar roles"}</button></div>
      </form>}
    </section>
    <section className="card"><h2>Nuevo usuario</h2><form onSubmit={create}>
      <div className="field"><label htmlFor="user-name">Nombre *</label><input id="user-name" name="name" required minLength={2} /></div>
      <div className="field" style={{ marginTop: 14 }}><label htmlFor="user-email">Correo *</label><input id="user-email" name="email" type="email" required /></div>
      <div className="field" style={{ marginTop: 14 }}><label htmlFor="user-password">Contraseña inicial *</label><input id="user-password" name="password" type="password" minLength={12} required autoComplete="new-password" /></div>
      <fieldset style={{ border: "1px solid var(--border)", borderRadius: 9, marginTop: 18, padding: 14 }}><legend style={{ fontWeight: 700 }}>Roles *</legend>{roles.map((role) => <label key={role} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}><input type="checkbox" name="roles" value={role} />{role.replaceAll("_", " ")}</label>)}</fieldset>
      {createError && <p role="alert" className="notice error">{createError}</p>}
      <div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Creando…" : "Crear usuario"}</button></div>
    </form></section></div>
  </>;
}
