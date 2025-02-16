import type { Address } from "@prisma/client";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";

import { Button } from "~/components/ui/button";
import { getAddresses } from "~/models/address.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const addresses = await getAddresses();

  return { addresses };
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Locations" }];
};

export default function DinnersPage() {
  const { addresses } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-2">
      {addresses.length > 0 ? (
        <div className="flex flex-col gap-4">
          {addresses.map((address) => {
            return <Location key={address.id} {...address} />;
          })}
        </div>
      ) : (
        <p>There are currently no locations</p>
      )}

      <Button asChild>
        <Link to="new">Create new location</Link>
      </Button>
    </div>
  );
}

function Location({ id, streetName, houseNumber, zip, city }: Address) {
  const deleteFetcher = useFetcher();
  const isDeleting = deleteFetcher.state !== "idle";

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium leading-none">{`${streetName} ${houseNumber} - ${zip} ${city}`}</span>

      <span className="flex gap-2">
        <Button variant="secondary" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>

        <deleteFetcher.Form method="POST" action={`${id}/delete`}>
          <Button type="submit" variant="destructive" disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </deleteFetcher.Form>
      </span>
    </div>
  );
}
