import { PlusIcon, SewingPinIcon } from "@radix-ui/react-icons";
import { Link, useFetcher } from "react-router";

import type { Route } from "./+types/admin.locations._index";

import { AdminEmptyState, AdminPageHeader } from "~/components/admin-ui";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getAddresses, type Address } from "~/models/address.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const addresses = await getAddresses();

  return { addresses };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Locations" }];
};

export default function AdminLocationsPage({
  loaderData,
}: Route.ComponentProps) {
  const { addresses } = loaderData;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1.5 duration-300">
      <AdminPageHeader
        eyebrow={`${addresses.length} total`}
        title="Locations"
        actions={
          <Button asChild>
            <Link to="new">
              <PlusIcon className="mr-2 size-[17px]" />
              New location
            </Link>
          </Button>
        }
      />

      {addresses.length > 0 ? (
        <div className="grid gap-3.5 md:grid-cols-2">
          {addresses.map((address) => (
            <LocationCard key={address.id} address={address} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<SewingPinIcon className="size-6.5" />}
          title="No locations yet"
          description="Add the first venue address so dinners have somewhere to happen."
          action={
            <Button asChild>
              <Link to="new">New location</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

function LocationCard({ address }: { address: Address }) {
  const deleteFetcher = useFetcher();
  const isDeleting = deleteFetcher.state !== "idle";
  const { id, streetName, houseNumber, zip, city } = address;

  return (
    <Card className="hover:border-primary/30 rounded-[14px] p-4.5 transition-colors">
      <div className="flex items-start gap-3.5">
        <div className="bg-primary/12 flex size-10 shrink-0 items-center justify-center rounded-[10px]">
          <SewingPinIcon className="text-primary size-[19px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold tracking-[-.01em]">
            {streetName} {houseNumber}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {zip} {city}
          </p>
        </div>
      </div>
      <div className="border-foreground/10 mt-4.5 flex gap-2 border-t pt-4">
        <Button size="sm" variant="outline" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>
        <deleteFetcher.Form method="POST" action={`${id}/delete`}>
          <Button
            type="submit"
            size="sm"
            variant="destructive-outline"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </deleteFetcher.Form>
      </div>
    </Card>
  );
}
