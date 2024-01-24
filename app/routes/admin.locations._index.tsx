import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { getAddresses } from "~/models/address.server";
import { requireUserWithRole } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const addresses = await getAddresses();

  return json({ addresses });
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
          {addresses.map(({ id, streetName, houseNumber, zip, city }) => {
            return (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium leading-none">{`${streetName} ${houseNumber} - ${zip} ${city}`}</span>

                <span className="flex gap-2">
                  <Button variant="secondary" asChild>
                    <Link to={`${id}/edit`}>Edit</Link>
                  </Button>

                  <Form method="POST" action={`${id}/delete`}>
                    <Button type="submit" variant="destructive">
                      Delete
                    </Button>
                  </Form>
                </span>
              </div>
            );
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
