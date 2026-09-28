"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteDialog } from "@/components/delete-dialog";

export function DeleteCustomer({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return <><button className="btn btn-danger" type="button" onClick={() => setOpen(true)}>Eliminar cliente y ventas</button>
    {open && <DeleteDialog endpoint={`/api/customers/${id}/delete`} close={() => setOpen(false)} deleted={async () => { router.replace("/clientes"); router.refresh(); }} />}
  </>;
}
