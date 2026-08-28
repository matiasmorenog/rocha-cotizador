import { redirect } from "next/navigation";

/** Legacy path — account lives under Configuración. */
export default function AdminAccountPage() {
  redirect("/admin/configuracion?tab=cuenta");
}
