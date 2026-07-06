import { PersonIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Link, useFetcher } from "react-router";

import type { Route } from "./+types/admin.users._index";

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSearchField,
  FilterChip,
  InitialsAvatar,
} from "~/components/admin-ui";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { listUsersWithRoleName } from "~/models/user.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["admin"]);

  const users = await listUsersWithRoleName();

  return { users };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Users" }];
};

const ROLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "admin", label: "Admin" },
  { id: "moderator", label: "Moderator" },
  { id: "user", label: "User" },
] as const;

type RoleFilter = (typeof ROLE_FILTERS)[number]["id"];

export default function AdminUsersPage({ loaderData }: Route.ComponentProps) {
  const { users } = loaderData;
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const q = query.trim().toLowerCase();
  const visible = users
    .filter((user) => roleFilter === "all" || user.role.name === roleFilter)
    .filter((user) => !q || user.email.toLowerCase().includes(q));

  return (
    <div className="animate-page-in">
      <AdminPageHeader eyebrow={`${users.length} accounts`} title="Users" />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <AdminSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search by email"
        />
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map(({ id, label }) => (
            <FilterChip
              key={id}
              active={roleFilter === id}
              onClick={() => setRoleFilter(id)}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visible.map((user, index) => (
            <UserCard key={user.id} user={user} seed={index} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<PersonIcon className="size-6" />}
          title="No users match"
          description="Try a different search or role filter."
        />
      )}
    </div>
  );
}

type User = Awaited<ReturnType<typeof loader>>["users"][number];

const ROLE_TEXT: Record<string, { label: string; className: string }> = {
  admin: { label: "administrator", className: "text-accent-light" },
  moderator: { label: "moderator", className: "text-muted-foreground" },
  user: { label: "user", className: "text-foreground/40" },
};

function UserCard({ user, seed }: { user: User; seed: number }) {
  const deleteFetcher = useFetcher();
  const { id, email, role } = user;
  const isAdmin = role.name === "admin";
  const isDeleting = deleteFetcher.state !== "idle";
  const roleText = ROLE_TEXT[role.name] ?? {
    label: role.name,
    className: "text-foreground/40",
  };

  return (
    <div className="border-border bg-card hover:border-primary/30 flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors">
      <InitialsAvatar name={email} seed={seed} className="size-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{email}</p>
        <p className={cn("mt-0.5 text-sm", roleText.className)}>
          {roleText.label}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>
        <deleteFetcher.Form method="POST" action={`${id}/delete`}>
          <Button
            type="submit"
            size="sm"
            variant="destructive-outline"
            // admin accounts can't be deleted
            disabled={isAdmin || isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </deleteFetcher.Form>
      </div>
    </div>
  );
}
