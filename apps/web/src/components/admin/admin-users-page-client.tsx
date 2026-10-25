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
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  fetchAdminUsers,
  updateAdminUserName,
} from "@/lib/admin-users/api";
import { getAdminUsersCopy } from "@/lib/admin-users/messages";
import { adminUserCreateFormSchema, type AdminUserCreateFormValues } from "@/lib/admin-users/schema";
import type { AdminUserRecord } from "@/lib/admin-users/types";
import { ApiError } from "@/lib/api/client";
import type { AuthLocale } from "@/lib/auth/types";

function messageFor(error: unknown, copy: ReturnType<typeof getAdminUsersCopy>): string {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return copy.forbidden;
  if (error instanceof ApiError && error.status === 404) return copy.notFound;
  if (error instanceof ApiError && error.status === 409) return copy.conflict;
  return copy.unavailable;
}

export function AdminUsersPageClient() {
  const queryClient = useQueryClient();
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getAdminUsersCopy(locale);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminUserRecord | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"disable" | "enable" | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");

  const directory = useQuery({
    queryKey: ["admin-users", page, q],
    queryFn: () => fetchAdminUsers({ page, q }),
    retry: false,
  });

  const form = useForm<AdminUserCreateFormValues>({
    resolver: zodResolver(adminUserCreateFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      roleKey: "AGENCY_OFFICER",
      agencyCode: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createAdminUser,
    retry: false,
    onSuccess: async () => {
      form.reset();
      setBanner(copy.activationBlocked);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => setBanner(messageFor(error, copy)),
  });

  const nameMutation = useMutation({
    mutationFn: (user: AdminUserRecord) =>
      updateAdminUserName(user.id, { firstName: editFirst, lastName: editLast, revision: user.revision }),
    retry: false,
    onSuccess: async (user) => {
      setSelected(user);
      setBanner(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => setBanner(messageFor(error, copy)),
  });

  const lifeMutation = useMutation({
    mutationFn: async (action: "disable" | "enable") => {
      if (!selected) throw new ApiError("missing", 404, { code: "NOT_FOUND" });
      return action === "disable"
        ? disableAdminUser(selected.id, selected.revision)
        : enableAdminUser(selected.id, selected.revision);
    },
    retry: false,
    onSuccess: async (user) => {
      setSelected(user);
      setConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => setBanner(messageFor(error, copy)),
  });

  function choose(user: AdminUserRecord) {
    setSelected(user);
    setEditFirst(user.firstName);
    setEditLast(user.lastName);
    setConfirm(null);
    setBanner(null);
  }

  const loadError = directory.error ? messageFor(directory.error, copy) : null;

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <section className="auth-access-card" aria-labelledby="admin-locale">
        <p id="admin-locale" className="auth-access-field-label">
          View language (draft)
        </p>
        <div className="auth-access-locale-row" role="group" aria-label="Directory language">
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
        <p className="auth-access-banner error" role="status">
          {copy.activationBlocked}
        </p>
      </section>

      {banner ? (
        <p className="auth-access-banner error" role="alert">
          {banner}
        </p>
      ) : null}
      {loadError ? (
        <p className="auth-access-status" role="alert">
          {loadError}
          <Button type="button" variant="outline" onClick={() => void directory.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}

      <section className="auth-access-card" aria-labelledby="staff-search">
        <h2 id="staff-search" className="auth-access-section-title">
          {copy.search}
        </h2>
        <form
          className="auth-access-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPage(1);
            setQ(String(data.get("q") ?? "").trim());
          }}
        >
          <label className="auth-access-field-label" htmlFor="staff-q">
            {copy.search}
          </label>
          <Input id="staff-q" name="q" defaultValue={q} autoComplete="off" />
          <Button type="submit">Search</Button>
        </form>
        {directory.isLoading ? <p role="status">Loading…</p> : null}
        {directory.data && directory.data.users.length === 0 ? <p role="status">{copy.empty}</p> : null}
        {directory.data && directory.data.users.length > 0 ? (
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Agency</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {directory.data.users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <button type="button" className="auth-access-link" onClick={() => choose(user)}>
                        {user.displayName}
                      </button>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className="admin-users-badge">{user.roleKey.replaceAll("_", " ")}</span>
                    </td>
                    <td>{user.agencyName ?? "—"}</td>
                    <td>
                      <span className="admin-users-badge">{user.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="auth-access-actions">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </Button>
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

      <section className="auth-access-card" aria-labelledby="staff-create">
        <h2 id="staff-create" className="auth-access-section-title">
          {copy.create}
        </h2>
        <Form {...form}>
          <form
            className="auth-access-form"
            noValidate
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial password</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <select {...field} className="auth-access-input">
                      <option value="AGENCY_OFFICER">Agency officer</option>
                      <option value="PROJECT_MANAGER">Project manager</option>
                      <option value="CONTRACTOR">Contractor</option>
                      <option value="INSPECTOR">Inspector</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agencyCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agency code</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={createMutation.isPending}>
              {copy.create}
            </Button>
          </form>
        </Form>
      </section>

      {selected ? (
        <section className="auth-access-card" aria-labelledby="staff-detail">
          <h2 id="staff-detail" className="auth-access-section-title">
            {selected.displayName}
          </h2>
          <dl className="auth-access-dl">
            <div>
              <dt>Email</dt>
              <dd>{selected.email}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
            <div>
              <dt>Verified</dt>
              <dd>{selected.emailVerified ? "Yes" : "No"}</dd>
            </div>
          </dl>
          <div className="auth-access-form">
            <label htmlFor="edit-first">First name</label>
            <Input id="edit-first" value={editFirst} onChange={(event) => setEditFirst(event.target.value)} />
            <label htmlFor="edit-last">Last name</label>
            <Input id="edit-last" value={editLast} onChange={(event) => setEditLast(event.target.value)} />
            <Button type="button" disabled={nameMutation.isPending} onClick={() => nameMutation.mutate(selected)}>
              {copy.save}
            </Button>
          </div>
          <div className="auth-access-actions">
            {confirm === null ? (
              <>
                <Button type="button" variant="outline" onClick={() => setConfirm("disable")}>
                  {copy.disable}
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirm("enable")}>
                  {copy.enable}
                </Button>
              </>
            ) : (
              <>
                <p role="alert">{confirm === "disable" ? copy.confirmDisable : copy.confirmEnable}</p>
                <Button type="button" disabled={lifeMutation.isPending} onClick={() => lifeMutation.mutate(confirm)}>
                  Confirm
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </section>
      ) : null}
    </StaffWorkspaceShell>
  );
}
