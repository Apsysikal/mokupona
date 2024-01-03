import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";

import { getAddresses } from "~/models/address.server";
import { requireUserId } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const addresses = await getAddresses();

  return json({ addresses });
}

export default function DinnersPage() {
  const { addresses } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to="new">Create new location</Link>
      {addresses.length > 0 ? (
        <div className="flex flex-col gap-4">
          {addresses.map(({ id, streetName, houseNumber, zip, city }) => {
            return (
              <div key={id} className="flex gap-2">
                <span>{`${streetName} ${houseNumber} - ${zip} ${city}`}</span>
                <Link to={`${id}/edit`}>Edit</Link>
                <Form method="POST" action={`${id}/delete`}>
                  <button type="submit">Delete</button>
                </Form>
              </div>
            );
          })}
        </div>
      ) : (
        <p>There are currently no locations available</p>
      )}
    </>
  );
}
