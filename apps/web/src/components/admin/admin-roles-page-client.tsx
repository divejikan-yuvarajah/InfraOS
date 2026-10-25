"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { StaffWorkspaceShell } from "@/components/auth/staff-workspace-shell";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { fetchPermissionCatalog, fetchRoles, updateRoleGrants, updateRoleText } from "@/lib/admin-roles/api";
import { getRoleCopy } from "@/lib/admin-roles/messages";
import { roleManageIsPlatformHint, roleMetadataFormSchema, rolePermissionsFormSchema } from "@/lib/admin-roles/schema";
import type { RoleRecord } from "@/lib/admin-roles/types";
import { ADMIN_ROLES_QUERY_KEY, bannerFromStatus, grantChangePreview, roleBannerMessage, visibleRoleGrants } from "@/lib/admin-roles/view-state";
import { ApiError } from "@/lib/api/client";
import { getMemorySession } from "@/lib/auth/state";
import type { AuthLocale } from "@/lib/auth/types";

export function AdminRolesPageClient() {
  const queryClient = useQueryClient();
  const [locale, setLocale] = useState<AuthLocale>("en");
  const copy = getRoleCopy(locale);
  const canEdit = roleManageIsPlatformHint(getMemorySession()?.user.roleKey);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; permissions: string[] } | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [banner, setBanner] = useState<ReturnType<typeof bannerFromStatus> | "saved" | null>(null);

  const roles = useQuery({
    queryKey: ADMIN_ROLES_QUERY_KEY,
    queryFn: fetchRoles,
    retry: false,
  });
  const catalog = useQuery({
    queryKey: [...ADMIN_ROLES_QUERY_KEY, "catalog"],
    queryFn: fetchPermissionCatalog,
    retry: false,
    enabled: roles.isSuccess,
  });

  const selected = roles.data?.find((role) => role.id === selectedId) ?? roles.data?.[0] ?? null;
  const grants = visibleRoleGrants(selected, draft);
  const preview = useMemo(
    () => (selected ? grantChangePreview(selected.permissions, grants) : { added: [], removed: [] }),
    [grants, selected],
  );

  const textForm = useForm<{ name: string; description: string }>({
    resolver: zodResolver(roleMetadataFormSchema),
    values: { name: selected?.name ?? "", description: selected?.description ?? "" },
  });

  function showError(error: unknown) {
    setBanner(error instanceof ApiError ? bannerFromStatus(error.status) : "unavailable");
  }

  async function refresh(role?: RoleRecord) {
    if (role) {
      setSelectedId(role.id);
      setDraft({ id: role.id, permissions: role.permissions });
    }
    await queryClient.invalidateQueries({ queryKey: ADMIN_ROLES_QUERY_KEY });
  }

  const textMutation = useMutation({
    mutationFn: (role: RoleRecord) =>
      updateRoleText(role.id, {
        name: textForm.getValues("name"),
        description: textForm.getValues("description"),
        revision: role.revision,
      }),
    retry: false,
    onSuccess: (role) => {
      setBanner("saved");
      return refresh(role);
    },
    onError: showError,
  });
  const grantMutation = useMutation({
    mutationFn: (role: RoleRecord) => {
      const parsed = rolePermissionsFormSchema.safeParse({ permissions: grants, reason });
      if (!parsed.success) throw new ApiError("request could not be completed", 400, { code: "VALIDATION_ERROR" });
      return updateRoleGrants(role.id, { permissions: parsed.data.permissions, revision: role.revision, reason: parsed.data.reason });
    },
    retry: false,
    onSuccess: (role) => {
      setConfirm(false);
      setReason("");
      setBanner("saved");
      return refresh(role);
    },
    onError: showError,
  });

  const loadError = roles.error ? roleBannerMessage(bannerFromStatus(roles.error instanceof ApiError ? roles.error.status : 503), copy) : null;
  const bannerText = roleBannerMessage(banner, copy);

  return (
    <StaffWorkspaceShell title={copy.title} description={copy.subtitle} wide>
      <section className="auth-access-card" aria-labelledby="role-locale">
        <p id="role-locale" className="auth-access-field-label">View language (draft)</p>
        <div className="auth-access-locale-row" role="group" aria-label="Role language">
          {(["en", "si", "ta"] as const).map((code) => (
            <button key={code} type="button" className="auth-access-button" aria-pressed={locale === code} onClick={() => setLocale(code)}>
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="auth-access-status" role="status">{copy.nativeReview}</p>
        <p className="auth-access-copy">{copy.readOnly}</p>
      </section>
      {loadError ? <p className="auth-access-banner error" role="alert">{loadError}</p> : null}
      {bannerText ? (
        <p
          className={banner === "saved" ? "auth-access-banner ok" : "auth-access-banner error"}
          role={banner === "saved" ? "status" : "alert"}
        >
          {bannerText}
        </p>
      ) : null}
      <div className="admin-roles-layout">
        <ul className="admin-roles-list" aria-label="System roles">
          {(roles.data ?? []).map((role) => (
            <li key={role.id}>
              <button
                type="button"
                className="auth-access-link"
                aria-current={selected?.id === role.id ? "true" : undefined}
                onClick={() => {
                  setSelectedId(role.id);
                  setDraft({ id: role.id, permissions: role.permissions });
                  setConfirm(false);
                  setBanner(null);
                }}
              >
                {role.name}
              </button>
            </li>
          ))}
        </ul>
        {selected ? (
          <section className="auth-access-card" aria-labelledby="role-detail">
            <h2 id="role-detail">{selected.name}</h2>
            <p>{selected.description}</p>
            <p>Key {selected.key}. Scope {selected.scopeType}. Revision {selected.revision}. Assigned accounts {selected.assignedUserCount}.</p>
            {canEdit ? (
              <Form {...textForm}>
                <form
                  onSubmit={textForm.handleSubmit(() => {
                    void textMutation.mutate(selected);
                  })}
                >
                  <FormField
                    control={textForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={textForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={textMutation.isPending}>{copy.saveText}</Button>
                </form>
              </Form>
            ) : null}
            <h3>Catalog</h3>
            {(catalog.data ?? []).map((group) => (
              <fieldset key={group.module}>
                <legend>{group.module}</legend>
                <ul>
                  {group.permissions.map((permission) => {
                    const held = grants.includes(permission);
                    return (
                      <li key={permission}>
                        {canEdit ? (
                          <label>
                            <input
                              type="checkbox"
                              checked={held}
                              onChange={(event) => {
                                const next = event.target.checked
                                  ? [...grants, permission]
                                  : grants.filter((value) => value !== permission);
                                setDraft({ id: selected.id, permissions: next });
                              }}
                            />
                            {permission}
                          </label>
                        ) : (
                          <span>{held ? permission : `${permission} (not granted)`}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))}
            {canEdit ? (
              <div>
                <p aria-live="polite">
                  Add {preview.added.join(", ") || "nothing"}. Remove {preview.removed.join(", ") || "nothing"}.
                </p>
                <label htmlFor="role-grant-reason">
                  {copy.reason}
                  <Input id="role-grant-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
                <label>
                  <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
                  Confirm grant change
                </label>
                <Button
                  type="button"
                  disabled={!confirm || grantMutation.isPending || (preview.added.length === 0 && preview.removed.length === 0)}
                  onClick={() => {
                    const parsed = rolePermissionsFormSchema.safeParse({ permissions: grants, reason });
                    if (!parsed.success) {
                      setBanner("unavailable");
                      return;
                    }
                    grantMutation.mutate(selected);
                  }}
                >
                  {copy.saveGrants}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </StaffWorkspaceShell>
  );
}
