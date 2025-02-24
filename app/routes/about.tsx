import { PersonIcon } from "@radix-ui/react-icons";
import type { ClassValue } from "clsx";
import { useLoaderData } from "react-router";

import type { Route } from "./+types/about";

import { prisma } from "~/db.server";
import { cn } from "~/lib/utils";
import { getEventImageUrl } from "~/utils/misc";

export const meta: Route.MetaFunction = () => {
  return [{ title: "About" }];
};

export async function loader() {
  const team = await prisma.boardMember.findMany({
    include: {
      image: {
        select: {
          id: true,
        },
      },
    },
  });
  return { team };
}

export default function AboutPage() {
  const { team } = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto mt-20 max-w-4xl px-2">
      <div className="flex flex-col gap-8">
        <h1 className="text-5xl lowercase">About Us</h1>
        <p>
          Welcome to moku pona, a Zurich-based dinner society founded in April
          2024 by five friends: Dan, Bharat, Javi, Leo, and Benedikt. Our
          community has since grown to include approximately 15 members who
          share a love for cooking and the joy it brings. At moku pona, we see
          food as a way to express creativity, share experiences, and connect
          with others. Our dinner events go beyond the typical restaurant
          experience, creating a warm and welcoming community space where
          friends and strangers can forge new connections. We aim to make every
          gathering an opportunity not just to enjoy a wonderful meal, but also
          to meet new people, share stories, and build meaningful relationships.
          We are always open to welcoming new members who share our passion for
          cooking and community. If you're interested in joining us, please
          reach out - we'd love to cook and share a meal with you. We look
          forward to meeting you at our next gathering!
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-16">
        <h2 className="text-4xl lowercase">The Board</h2>
        <ul
          className={cn(
            "grid grid-cols-2 gap-x-8 gap-y-16",
            team.length % 2 === 0 && "md:grid-cols-2",
            team.length % 3 === 0 && "md:grid-cols-3",
            team.length % 4 === 0 && "md:grid-cols-4",
            team.length % 5 === 0 && "md:grid-cols-3 lg:grid-cols-5",
            team.length % 6 === 0 && "md:grid-cols-3 lg:grid-cols-6",
            team.length % 7 === 0 && "md:grid-cols-4 lg:grid-cols-7",
          )}
        >
          {team.map((member) => (
            <TeamMember
              key={member.id}
              name={member.name}
              position={member.position}
              imageUrl={
                member.image?.id ? getEventImageUrl(member.image.id) : undefined
              }
              className="text-center"
            />
          ))}
        </ul>
      </div>
    </main>
  );
}

function TeamMember({
  name,
  position,
  imageUrl,
  className,
}: {
  name: string;
  position: string;
  imageUrl?: string;
  className?: ClassValue;
}) {
  return (
    <li>
      <div className={cn(className)}>
        {imageUrl ? (
          <img
            alt={`Portrait of ${name}`}
            src={imageUrl}
            className="mx-auto size-24 flex-none rounded-full bg-gray-50"
          />
        ) : (
          <div className="bg-primary mx-auto flex size-24 shrink-0 items-center justify-center rounded-full">
            <PersonIcon className="text-primary-foreground size-12" />
          </div>
        )}
        <h3 className="mt-6 text-base/7 font-semibold">{name}</h3>
        <p className="text-sm text-gray-50/80">{position}</p>
      </div>
    </li>
  );
}
