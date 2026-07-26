import { PlusIcon, SewingPinIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";

import type { Route } from "./+types/admin.locations._index";

import { AdminDeleteButton } from "~/components/admin-delete-button";
import { AdminEmptyState, AdminPageHeader } from "~/components/admin-ui";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getAddressesWithEventCount } from "~/models/address.server";

export async function loader() {
  const addresses = await getAddressesWithEventCount();

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
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${addresses.length} total`}
        title="Locations"
        actions={
          <Button asChild>
            <Link to="new">
              <PlusIcon className="size-4" />
              New location
            </Link>
          </Button>
        }
      />

      {addresses.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {addresses.map((address) => (
            <LocationCard key={address.id} address={address} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<SewingPinIcon className="size-6" />}
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

type AddressWithEventCount = Awaited<
  ReturnType<typeof loader>
>["addresses"][number];

function LocationCard({ address }: { address: AddressWithEventCount }) {
  const { id, streetName, houseNumber, zip, city, eventCount } = address;
  const inUse = eventCount > 0;

  return (
    <Card interactive className="p-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-lg">
          <SewingPinIcon className="text-primary size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">
            {streetName} {houseNumber}
          </h2>
          <p className="text-foreground/65 mt-1 text-sm">
            {zip} {city}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2 border-t pt-4">
        <Button size="sm" variant="outline" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>
        <AdminDeleteButton action={`${id}/delete`} disabled={inUse} />
        {inUse ? (
          <span className="text-foreground/50 self-center text-xs">
            hosts {eventCount} {eventCount === 1 ? "dinner" : "dinners"}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
