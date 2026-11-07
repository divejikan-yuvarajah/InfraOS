"use client";

import { ArchiveIcon, CopyIcon, EyeIcon, HandshakeIcon, MoreHorizontalIcon, PauseCircleIcon, PencilIcon, PlayCircleIcon, MinusCircleIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Copy } from "@/lib/contractors/messages";
import type { DirectoryRow } from "@/lib/contractors/types";

import type { StatusTarget } from "./contractor-dialogs";

export type RowIntent = { kind: "assign"; row: DirectoryRow } | { kind: "status"; row: DirectoryRow; target: StatusTarget };

/** Every item opens a real page or dialog. Items the viewer cannot use are not rendered; the server re-checks everything anyway. */
export function RowActions({ row, copy, roleKey, onIntent }: { row: DirectoryRow; copy: Copy; roleKey: string; onIntent: (intent: RowIntent) => void }) {
  const [open, setOpen] = useState(false);
  const run = (intent: RowIntent) => { setOpen(false); onIntent(intent); };
  const canReactivate = row.canManage && (row.status === "SUSPENDED" || row.status === "INACTIVE" || (row.status === "ARCHIVED" && roleKey === "SUPER_ADMIN"));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="ctr-btn is-ghost" aria-label={copy.directory.rowActions.replace("{name}", row.name)}><MoreHorizontalIcon aria-hidden="true" /></button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="ctr-menu" role="menu" aria-label={copy.directory.rowActions.replace("{name}", row.name)}>
          <Link role="menuitem" href={`/contractors/${row.id}`}><EyeIcon aria-hidden="true" />{copy.directory.openProfile}</Link>
          <button type="button" role="menuitem" onClick={async () => { setOpen(false); try { await navigator.clipboard.writeText(row.registrationNumber); toast.success(copy.common.copied); } catch { toast.error(copy.common.errorGeneric); } }}><CopyIcon aria-hidden="true" />{copy.directory.copyReg}</button>
          {row.canManage ? <Link role="menuitem" href={`/contractors/${row.id}/edit`}><PencilIcon aria-hidden="true" />{copy.common.edit}</Link> : null}
          {row.canManage && row.status === "ACTIVE" ? <button type="button" role="menuitem" onClick={() => run({ kind: "assign", row })}><HandshakeIcon aria-hidden="true" />{copy.directory.assignTo}</button> : null}
          {row.canManage && row.status === "ACTIVE" ? <button type="button" role="menuitem" onClick={() => run({ kind: "status", row, target: "SUSPENDED" })}><PauseCircleIcon aria-hidden="true" />{copy.directory.suspend}</button> : null}
          {row.canManage && (row.status === "ACTIVE" || row.status === "SUSPENDED") ? <button type="button" role="menuitem" onClick={() => run({ kind: "status", row, target: "INACTIVE" })}><MinusCircleIcon aria-hidden="true" />{copy.directory.inactivate}</button> : null}
          {canReactivate ? <button type="button" role="menuitem" onClick={() => run({ kind: "status", row, target: "ACTIVE" })}><PlayCircleIcon aria-hidden="true" />{copy.directory.reactivate}</button> : null}
          {row.canManage && row.status !== "ARCHIVED" ? <button type="button" role="menuitem" onClick={() => run({ kind: "status", row, target: "ARCHIVED" })}><ArchiveIcon aria-hidden="true" />{copy.directory.archive}</button> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
