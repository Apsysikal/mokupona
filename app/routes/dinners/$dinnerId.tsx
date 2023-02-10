import { ActionArgs, json, LoaderArgs } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { NavBar } from "~/components/navbar";
import { prisma } from "~/utilities/prisma.server";

export const loader = async ({ params }: LoaderArgs) => {
  const dinnerId = params.dinnerId;
  invariant(dinnerId, "dinnerId must be defined");

  const event = await prisma.event.findUnique({
    where: { id: dinnerId },
    select: {
      title: true,
      subtitle: true,
      date: true,
      tags: true,
      imageUrl: true,
      location: true,
      price: true,
      description: true,
    },
  });

  if (!event) throw new Response("Event not found", { status: 404 });

  return json({
    event,
  });
};

export const action = async ({ params, request }: ActionArgs) => {
  const formData = await request.formData();

  console.log(formData);

  const name = formData.get("name") as string;
  const phoneNumber = formData.get("phone-number") as string;
  const preferredMessenger = formData.get("preferred-messenger") as string;
};

export default function DinnerRoute() {
  const { event } = useLoaderData<typeof loader>();
  const parsedDate = new Date(Date.parse(event.date));

  return (
    <>
      <header>
        <NavBar className="text-white bg-emerald-800" />
      </header>
      <main className="flex flex-col max-w-3xl gap-5 grow mx-auto text-gray-800 px-2 py-4">
        <div className="flex flex-col gap-2">
          <p className="text-xl text-emerald-600">{event.subtitle}</p>
          <h1 className="text-4xl font-bold text-gray-900">{event.title}</h1>
        </div>
        {event.tags.length > 0 ? (
          <>
            <div>
              <div className="flex gap-1">
                {event.tags.map((tag) => {
                  return (
                    <span className="rounded-full bg-emerald-200/50 px-2 py-1 text-xs uppercase text-emerald-800">
                      {tag}
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
        <img
          src={event.imageUrl}
          alt=""
          width={1200}
          height={800}
          className="max-h-28 w-full object-cover rounded-xl shadow-xl"
        />
        <div className="font-semibold text-emerald-600">
          <time>
            {`${parsedDate.toLocaleDateString()} - ${parsedDate.toLocaleTimeString()}`}
          </time>
          <p>{event.location.street}</p>
          <p>{`${event.location.zipCode} ${event.location.zipName}`}</p>
        </div>
        <div className="font-semibold text-emerald-600">
          <p>{`Cost, ${event.price} CHF (Non-Profit)`}</p>
        </div>
        <div>
          <p className="whitespace-pre-line">{event.description}</p>
        </div>
        <Form method="post">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="font-semibold">
                Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                defaultValue={""}
                aria-invalid={false}
                aria-errormessage={""}
                className="border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 rounded-md shadow-md"
              />
              {/** Error message */}
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <label htmlFor="phone-number" className="font-semibold">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone-number"
                  id="phone-number"
                  defaultValue={""}
                  aria-invalid={false}
                  aria-errormessage={""}
                  className="border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 rounded-md shadow-md"
                />
                {/** Error message */}
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Preferred Messenger</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name="preferred-messenger"
                    id="preferred-messenger-signal"
                    value="signal"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="preferred-messenger-signal">Signal</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name="preferred-messenger"
                    id="preferred-messenger-whatsapp"
                    value="whatsapp"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="preferred-messenger-whatsapp">WhatsApp</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name="preferred-messenger"
                    id="preferred-messenger-telegram"
                    value="telegram"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600"
                  />
                  <label htmlFor="preferred-messenger-telegram">Telegram</label>
                </div>
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Dietary Restrictions</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dietary-restriction-vegetarian"
                    id="dietary-restriction-vegetarian"
                    value="dietary-restriction-vegetarian"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dietary-restriction-vegetarian">
                    Vegetarian
                  </label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dietary-restriction-vegan"
                    id="dietary-restriction-vegan"
                    value="dietary-restriction-vegan"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dietary-restriction-vegan">Vegan</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dietary-restriction-nuts"
                    id="dietary-restriction-nuts"
                    value="dietary-restriction-nuts"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dietary-restriction-nuts">Nuts Allergy</label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dietary-restriction-dairy"
                    id="dietary-restriction-dairy"
                    value="dietary-restriction-dairy"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dietary-restriction-dairy">
                    Dairy Intolerance
                  </label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="dietary-restriction-alcohol"
                    id="dietary-restriction-alcohol"
                    value="dietary-restriction-alcohol"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="dietary-restriction-alcohol">
                    No Alcohol
                  </label>
                </div>
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <label htmlFor="comment" className="font-semibold">
                  Anything else?
                </label>
                <textarea
                  name="comment"
                  id="comment"
                  className="border-emerald-600 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 rounded-md shadow-md"
                />
              </div>
            </div>
            <div>
              <div className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="terms-of-service"
                    id="terms-of-service"
                    value="terms-of-service"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="terms-of-service">
                    I agree to the{" "}
                    <Link to="/toc" className="underline">
                      Terms of Service
                    </Link>
                  </label>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    name="newsletter-signup"
                    id="newsletter-signup"
                    value="newsletter-signup"
                    className="border-emerald-600 checked:bg-emerald-600 checked:hover:bg-emerald-600 rounded-sm"
                  />
                  <label htmlFor="newsletter-signup">
                    Inform me about new events
                  </label>
                </div>
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="max-sm:w-full px-4 py-2 rounded-md shadow-md bg-emerald-800 text-white uppercase hover:bg-emerald-700 active:bg-emerald-900"
              >
                Join
              </button>
            </div>
          </div>
        </Form>
      </main>
    </>
  );
}
