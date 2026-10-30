import { redirect } from "next/navigation";
import type { WorkspaceResolution } from "@/lib/workspace";

export function enforceRegistrarTaskOnlyAccess(
  workspace: WorkspaceResolution,
): void {
  if (
    workspace.type === "SCHOOL" &&
    workspace.schoolRole === "REGISTRAR"
  ) {
    redirect("/registrar/tasks");
  }
}
