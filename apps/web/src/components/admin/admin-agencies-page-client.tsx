"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  createAgency,
  deactivateAgency,
  fetchAgencies,
  reparentAgency,
  updateAgencyName,
} from "@/lib/admin-agencies/api";
import { getAgencyCopy } from "@/lib/admin-agencies/messages";
import { agencyCreateFormSchema, agencyManageIsPlatformHint, type AgencyCreateFormValues } from "@/lib/admin-agencies/schema";
import type { AgencyRecord } from "@/lib/admin-agencies/types";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";
import { getMemorySession } from "@/lib/auth/state";

function messageFor(error: unknown, copy: ReturnType<typeof getAgencyCopy>): string {
  if (!(error instanceof ApiError)) return copy.unavailable;
  if (error.status === 401 || error.status === 403) return copy.forbidden;
  if (error.status === 404) return copy.notFound;
  if (error.status === 409) {
    const details = error.details as { activeChildren?: number; activeUsers?: number } | null;
    if (details && ((details.activeChildren ?? 0) > 0 || (details.activeUsers ?? 0) > 0)) return copy.dependency;
    return copy.conflict;
  }
  return copy.unavailable;
}

export function AdminAgenciesPageClient() {
  const queryClient = useQueryClient();
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getAgencyCopy(locale);
  const canManage = agencyManageIsPlatformHint(getMemorySession()?.user.roleKey);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AgencyRecord | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const directory = useQuery({
    queryKey: ["admin-agencies", page, q, status, type],
    queryFn: () => fetchAgencies({ page, q, status, type }),
    retry: false,
  });

  const form = useForm<AgencyCreateFormValues>({
    resolver: zodResolver(agencyCreateFormSchema),
    defaultValues: { code: "", name: "", type: "DEPARTMENT", parentAgencyId: "" },
  });

  function refresh(agency?: AgencyRecord) {
    if (agency) {
      setSelected(agency);
      setName(agency.name);
      setParentId(agency.parentAgencyId ?? "");
    }
    return queryClient.invalidateQueries({ queryKey: ["admin-agencies"] });
  }

  const createMutation = useMutation({
    mutationFn: createAgency,
    retry: false,
    onSuccess: (agency) => {
      form.reset();
      setBanner(null);
      return refresh(agency);
    },
    onError: (error) => setBanner(messageFor(error, copy)),
  });
  const nameMutation = useMutation({
    mutationFn: (agency: AgencyRecord) => updateAgencyName(agency.id, { name, revision: agency.revision }),
    retry: false,
    onSuccess: (agency) => refresh(agency),
    onError: (error) => setBanner(messageFor(error, copy)),
  });
  const parentMutation = useMutation({
    mutationFn: (agency: AgencyRecord) =>
      reparentAgency(agency.id, { parentAgencyId: parentId || null, revision: agency.revision }),
    retry: false,
    onSuccess: (agency) => refresh(agency),
    onError: (error) => setBanner(messageFor(error, copy)),
  });
  const deactivateMutation = useMutation({
    mutationFn: (agency: AgencyRecord) => deactivateAgency(agency.id, agency.revision),
    retry: false,
    onSuccess: (agency) => {
      setConfirm(false);
      return refresh(agency);
    },
    onError: (error) => setBanner(messageFor(error, copy)),
  });

  const loadError = directory.error ? messageFor(directory.error, copy) : null;
  const byId = new Map((directory.data?.agencies ?? []).map((agency) => [agency.id, agency.code]));

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <section className="auth-access-card" aria-labelledby="agency-locale">
        <p id="agency-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Agency language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={locale === code ? "auth-access-chip is-active" : "auth-access-chip"}
              onClick={() => setLocale(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="auth-access-hint">{copy.nativeReview}</p>
        <p className="auth-access-banner error" role="status">{copy.readOnly}</p>
      </section>
      {banner ? <p className="auth-access-banner error" role="alert">{banner}</p> : null}
      {loadError ? (
        <p className="auth-access-status" role="alert">
          {loadError}
          <Button type="button" variant="outline" onClick={() => void directory.refetch()}>Retry</Button>
        </p>
      ) : null}
      <section className="auth-access-card" aria-labelledby="agency-search">
        <h2 id="agency-search" className="auth-access-section-title">{copy.search}</h2>
        <form
          className="auth-access-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPage(1);
            setQ(String(data.get("q") ?? "").trim());
            setStatus(String(data.get("status") ?? ""));
            setType(String(data.get("type") ?? ""));
          }}
        >
          <label htmlFor="agency-q">{copy.search}</label>
          <Input id="agency-q" name="q" defaultValue={q} autoComplete="off" />
          <label htmlFor="agency-status">Status</label>
          <select id="agency-status" name="status" className="auth-access-input" defaultValue={status}>
            <option value="">Any</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <label htmlFor="agency-type">Type</label>
          <select id="agency-type" name="type" className="auth-access-input" defaultValue={type}>
            <option value="">Any</option>
            <option value="MINISTRY">MINISTRY</option>
            <option value="DEPARTMENT">DEPARTMENT</option>
            <option value="ROAD">ROAD</option>
          </select>
          <Button type="submit">Search</Button>
        </form>
        {directory.isLoading ? <p role="status">Loading…</p> : null}
        {directory.data && directory.data.agencies.length === 0 ? <p role="status">{copy.empty}</p> : null}
        {directory.data && directory.data.agencies.length > 0 ? (
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Parent</th>
                </tr>
              </thead>
              <tbody>
                {directory.data.agencies.map((agency) => (
                  <tr key={agency.id}>
                    <td>
                      <button type="button" className="auth-access-link" onClick={() => {
                        setSelected(agency);
                        setName(agency.name);
                        setParentId(agency.parentAgencyId ?? "");
                        setConfirm(false);
                        setBanner(null);
                      }}>
                        {agency.code}
                      </button>
                    </td>
                    <td>{agency.name}</td>
                    <td><span className="admin-users-badge">{agency.type}</span></td>
                    <td><span className="admin-users-badge">{agency.status}</span></td>
                    <td>{agency.parentAgencyId ? (byId.get(agency.parentAgencyId) ?? agency.parentAgencyId) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="auth-access-actions">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <Button
            type="button"
            variant="outline"
            disabled={!directory.data || page * directory.data.pageSize >= directory.data.total}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </section>
      {canManage ? (
        <section className="auth-access-card" aria-labelledby="agency-create">
          <h2 id="agency-create" className="auth-access-section-title">{copy.create}</h2>
          <Form {...form}>
            <form
              className="auth-access-form"
              noValidate
              onSubmit={form.handleSubmit((values) =>
                createMutation.mutate({
                  code: values.code,
                  name: values.name,
                  type: values.type,
                  parentAgencyId: values.parentAgencyId || null,
                }),
              )}
            >
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl><Input {...field} autoComplete="off" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} autoComplete="off" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <select {...field} className="auth-access-input">
                      <option value="MINISTRY">Ministry</option>
                      <option value="DEPARTMENT">Department</option>
                      <option value="ROAD">Road</option>
                      <option value="WATER">Water</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="parentAgencyId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent id</FormLabel>
                  <FormControl><Input {...field} autoComplete="off" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={createMutation.isPending}>{copy.create}</Button>
            </form>
          </Form>
        </section>
      ) : null}
      {selected ? (
        <section className="auth-access-card" aria-labelledby="agency-detail">
          <h2 id="agency-detail" className="auth-access-section-title">{selected.code}</h2>
          <dl className="auth-access-dl">
            <div><dt>Name</dt><dd>{selected.name}</dd></div>
            <div><dt>Type</dt><dd>{selected.type}</dd></div>
            <div><dt>Status</dt><dd>{selected.status}</dd></div>
            <div><dt>Parent</dt><dd>{selected.parentAgencyId ?? "—"}</dd></div>
          </dl>
          {canManage ? (
            <div className="auth-access-form">
              <label htmlFor="agency-name">Name</label>
              <Input id="agency-name" value={name} onChange={(event) => setName(event.target.value)} />
              <Button type="button" disabled={nameMutation.isPending} onClick={() => nameMutation.mutate(selected)}>{copy.save}</Button>
              <label htmlFor="agency-parent">Parent id</label>
              <Input id="agency-parent" value={parentId} onChange={(event) => setParentId(event.target.value)} />
              <Button type="button" variant="outline" disabled={parentMutation.isPending} onClick={() => parentMutation.mutate(selected)}>{copy.reparent}</Button>
              {confirm ? (
                <>
                  <p role="alert">{copy.confirmDeactivate}</p>
                  <Button type="button" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(selected)}>Confirm</Button>
                  <Button type="button" variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
                </>
              ) : (
                <Button type="button" variant="outline" onClick={() => setConfirm(true)}>{copy.deactivate}</Button>
              )}
            </div>
          ) : (
            <p role="status">{copy.readOnly}</p>
          )}
        </section>
      ) : null}
    </StaffWorkspaceShell>
  );
}
