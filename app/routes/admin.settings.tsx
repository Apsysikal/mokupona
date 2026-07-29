import { parseWithZod } from "@conform-to/zod/v4";
import { Form } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/admin.settings";

import { AdminPageHeader } from "~/components/admin-ui";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { requireResolvedUserRoleMiddleware } from "~/features/auth/middleware.server";
import {
  SIGNUP_METHOD_COPY,
  SIGNUP_METHODS,
  type SignupMethod,
  type SignupSettings,
} from "~/features/auth/signup-settings";
import {
  getSignupSettings,
  setSignupEnabled,
} from "~/features/auth/signup-settings.server";
import { logger } from "~/logger.server";
import { redirectWithToast } from "~/utils/toast.server";

export const middleware: Route.MiddlewareFunction[] = [
  requireResolvedUserRoleMiddleware(["admin"]),
];

const schema = z.object({
  method: z.enum(SIGNUP_METHODS),
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export async function loader() {
  return { signupSettings: getSignupSettings() };
}

export async function action({ request }: Route.ActionArgs) {
  const submission = parseWithZod(await request.formData(), { schema });

  // Two buttons per row, both server-rendered — a submission that misses the
  // schema was hand-made, so there is no form state worth replying into.
  if (submission.status !== "success" || !submission.value) {
    throw new Response("Bad request", { status: 400 });
  }

  const { method, enabled } = submission.value;
  setSignupEnabled(method, enabled);

  logger.info("Self-signup setting changed", { method, enabled });

  return redirectWithToast("/admin/settings", {
    title: `${SIGNUP_METHOD_COPY[method].label} sign-ups ${enabled ? "enabled" : "disabled"}`,
    type: "success",
  });
}

export const meta: Route.MetaFunction = () => [{ title: "Admin - Settings" }];

export default function AdminSettingsPage({
  loaderData,
}: Route.ComponentProps) {
  const { signupSettings } = loaderData;

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow="settings"
        title="Sign-ups"
        subtitle="Decide how people can create an account on their own. Invitations keep working either way."
      />

      <Card className="p-4 md:p-5">
        <h2 className="text-base font-semibold">Self-signup</h2>
        <p className="text-foreground/50 mt-1 text-sm">
          These switches reset to enabled whenever the server restarts.
        </p>

        <div className="mt-3 flex flex-col">
          {SIGNUP_METHODS.map((method) => (
            <SignupMethodRow
              key={method}
              method={method}
              settings={signupSettings}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function SignupMethodRow({
  method,
  settings,
}: {
  method: SignupMethod;
  settings: SignupSettings;
}) {
  const enabled = settings[method];

  return (
    <div className="flex flex-wrap items-center gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">
            {SIGNUP_METHOD_COPY[method].label}
          </p>
          <Badge variant={enabled ? "info" : "secondary"} pill>
            {enabled ? "open" : "closed"}
          </Badge>
        </div>
        <p className="text-foreground/65 mt-1 text-sm">
          {SIGNUP_METHOD_COPY[method].description}
        </p>
      </div>

      <Form method="post" replace>
        <input type="hidden" name="method" value={method} />
        <input
          type="hidden"
          name="enabled"
          value={enabled ? "false" : "true"}
        />
        <Button
          type="submit"
          size="sm"
          variant={enabled ? "destructive-outline" : "outline"}
        >
          {enabled ? "disable" : "enable"}
        </Button>
      </Form>
    </div>
  );
}
