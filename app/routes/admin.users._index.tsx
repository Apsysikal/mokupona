import {
  type FieldMetadata,
  getCollectionProps,
  getFormProps,
  getInputProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import {
  EnvelopeClosedIcon,
  PersonIcon,
  PlusIcon,
} from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { data, Link, useFetcher } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import type { Route } from "./+types/admin.users._index";

import { AdminDeleteButton } from "~/components/admin-delete-button";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSearchField,
  FilterChip,
  InitialsAvatar,
} from "~/components/admin-ui";
import { ErrorList, Field } from "~/components/forms";
import { SectionDivider } from "~/components/section";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { emailSchema } from "~/features/auth/form-schemas";
import { userContext } from "~/features/auth/middleware.server";
import {
  isAdminRole,
  ROLE_FILTER_OPTIONS,
  roleLabel,
  type RoleName,
} from "~/features/auth/roles";
import {
  createAndSendInvite,
  resendInvite,
} from "~/features/users/invite.server";
import {
  INVITABLE_ROLES,
  type InvitableRole,
} from "~/features/users/invite.shared";
import { cn } from "~/lib/utils";
import { listPendingInvites, revokeInvite } from "~/models/invite.server";
import { listUsersWithRoleName } from "~/models/user.server";
import { getDomainUrl, unknownIntent } from "~/shared/http.server";

const inviteSchema = z.object({
  intent: z.literal("invite"),
  email: emailSchema,
  // admin is not offered and rejected here — ceiling "moderator" (design §6)
  role: z.enum(INVITABLE_ROLES, { error: "Pick a role" }),
});

export async function loader() {
  const [users, invites] = await Promise.all([
    listUsersWithRoleName(),
    listPendingInvites(),
  ]);

  return {
    users,
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      roleName: invite.roleName,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const admin = context.get(userContext);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "invite") {
    const submission = parseWithZod(formData, { schema: inviteSchema });
    if (submission.status !== "success") {
      return data({ result: submission.reply(), sentTo: null });
    }

    const { email, role } = submission.value;
    await createAndSendInvite({
      email,
      roleName: role,
      createdById: admin.id,
      origin: getDomainUrl(request),
    });
    return data({
      result: submission.reply({ resetForm: true }),
      sentTo: email,
    });
  }

  if (intent === "revoke") {
    const id = formData.get("inviteId");
    if (typeof id === "string") await revokeInvite(id);
    return data({ result: null, sentTo: null });
  }

  if (intent === "resend") {
    const id = formData.get("inviteId");
    if (typeof id === "string") {
      await resendInvite({ id, origin: getDomainUrl(request) });
    }
    return data({ result: null, sentTo: null });
  }

  throw unknownIntent();
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Users" }];
};

const ROLE_FILTERS = [
  { id: "all", label: "All" },
  ...ROLE_FILTER_OPTIONS.map(({ label, value }) => ({ id: value, label })),
] satisfies ReadonlyArray<{ id: "all" | RoleName; label: string }>;

type RoleFilter = "all" | RoleName;

export default function AdminUsersPage({ loaderData }: Route.ComponentProps) {
  const { users, invites } = loaderData;
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const q = query.trim().toLowerCase();
  const visible = users
    .filter((user) => roleFilter === "all" || user.role.name === roleFilter)
    .filter((user) => !q || user.email.toLowerCase().includes(q));

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${users.length} accounts`}
        title="Users"
        actions={<InviteDialog />}
      />

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

      {invites.length > 0 ? (
        <>
          <SectionDivider className="mb-4">pending invites</SectionDivider>
          <div className="mb-6 flex flex-col gap-3">
            {invites.map((invite) => (
              <PendingInviteRow key={invite.id} invite={invite} />
            ))}
          </div>
          <SectionDivider className="mb-4">accounts</SectionDivider>
        </>
      ) : null}

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

function InviteDialog() {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    lastResult: fetcher.data?.result ?? null,
    constraint: getZodConstraint(inviteSchema),
    defaultValue: { role: "user" },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: inviteSchema });
    },
  });

  // fetcher.data is a fresh object per submission, so re-inviting the same
  // address still closes the dialog
  const { data: fetcherData, state: fetcherState } = fetcher;
  useEffect(() => {
    if (fetcherData?.sentTo && fetcherState === "idle") {
      setOpen(false);
      toast.success(`Invite sent to ${fetcherData.sentTo}`);
    }
  }, [fetcherData, fetcherState]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="size-4" />Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex flex-col gap-1.5">
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            We&apos;ll email a single-use link that expires in 7 days.
          </DialogDescription>
        </div>

        <fetcher.Form
          method="post"
          className="flex flex-col gap-4"
          {...getFormProps(form)}
        >
          <input type="hidden" name="intent" value="invite" />

          <Field
            labelProps={{ children: "Email address" }}
            inputProps={{
              ...getInputProps(fields.email, { type: "email" }),
              placeholder: "name@example.com",
            }}
            errors={fields.email.errors}
          />

          <RolePicker meta={fields.role} />

          <div className="mt-1 flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="flex-1">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="flex-1"
              disabled={fetcher.state !== "idle"}
            >
              {fetcher.state !== "idle" ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function RolePicker({ meta }: { meta: FieldMetadata<InvitableRole> }) {
  const labelId = `${meta.id}-label`;

  return (
    <div className="flex flex-col gap-2">
      <Label asChild>
        <span id={labelId}>Role</span>
      </Label>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="bg-foreground/5 flex rounded-lg border p-1"
      >
        {getCollectionProps(meta, {
          type: "radio",
          options: [...INVITABLE_ROLES],
        }).map(({ key, ...props }) => (
          <label
            key={key}
            className={cn(
              "flex h-9 flex-1 cursor-pointer items-center justify-center rounded-md text-sm capitalize transition-colors",
              "text-foreground/65 hover:text-foreground font-medium",
              "has-checked:bg-primary has-checked:text-primary-foreground has-checked:font-semibold",
            )}
          >
            <input {...props} className="sr-only" />
            {props.value}
          </label>
        ))}
      </div>
      <ErrorList id={meta.errorId} errors={meta.errors} />
    </div>
  );
}

type InviteRow = Awaited<ReturnType<typeof loader>>["invites"][number];

const DAY_MS = 24 * 60 * 60 * 1000;

function inviteMeta(invite: InviteRow) {
  const invitedDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(invite.createdAt).getTime()) / DAY_MS),
  );
  const invitedText =
    invitedDays === 0
      ? "invited today"
      : invitedDays === 1
        ? "invited 1 day ago"
        : `invited ${invitedDays} days ago`;

  const msLeft = new Date(invite.expiresAt).getTime() - Date.now();
  const expired = msLeft <= 0;
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  const expiresText = expired
    ? "expired"
    : daysLeft === 1
      ? "expires in 1 day"
      : `expires in ${daysLeft} days`;

  return {
    expired,
    text: `${invite.roleName} · ${invitedText} · ${expiresText}`,
  };
}

function PendingInviteRow({ invite }: { invite: InviteRow }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const { expired, text } = inviteMeta(invite);

  return (
    <div className="border-foreground/20 bg-foreground/5 flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3">
      <span
        aria-hidden
        className="bg-foreground/10 text-foreground/65 flex size-10 shrink-0 items-center justify-center rounded-full"
      >
        <EnvelopeClosedIcon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{invite.email}</p>
        <p
          className={cn(
            "mt-0.5 text-sm",
            expired ? "text-destructive-light" : "text-foreground/50",
          )}
        >
          {text}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="resend" />
          <input type="hidden" name="inviteId" value={invite.id} />
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            {busy ? "Sending…" : "Re-send"}
          </Button>
        </fetcher.Form>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="revoke" />
          <input type="hidden" name="inviteId" value={invite.id} />
          <Button
            type="submit"
            size="sm"
            variant="destructive-outline"
            disabled={busy}
          >
            Revoke
          </Button>
        </fetcher.Form>
      </div>
    </div>
  );
}

type User = Awaited<ReturnType<typeof loader>>["users"][number];

const ROLE_CLASS_NAMES: Record<string, string> = {
  admin: "text-accent-light",
  moderator: "text-muted-foreground",
  user: "text-foreground/40",
};

function UserCard({ user, seed }: { user: User; seed: number }) {
  const { id, email, role } = user;
  const isAdmin = isAdminRole(role.name);
  const roleClassName = ROLE_CLASS_NAMES[role.name] ?? "text-foreground/40";

  return (
    <Card interactive className="flex items-center gap-3 px-4 py-3">
      <InitialsAvatar name={email} seed={seed} className="size-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{email}</p>
        <p className={cn("mt-0.5 text-sm", roleClassName)}>
          {roleLabel(role.name)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>
        <AdminDeleteButton action={`${id}/delete`} disabled={isAdmin} />
      </div>
    </Card>
  );
}
