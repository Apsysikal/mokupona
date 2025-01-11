import { PersonIcon } from "@radix-ui/react-icons";
import { MetaFunction, useLoaderData } from "@remix-run/react";
import { ClassValue } from "clsx";

import { prisma } from "~/db.server";
import { cn } from "~/lib/utils";
import { getEventImageUrl } from "~/utils/misc";

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "About" }];
};

export async function loader() {
  const team = await prisma.boardMember.findMany({
    include: {
      image: true,
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
          Lorem ipsum odor amet, consectetuer adipiscing elit. Eu urna tincidunt
          class amet mi. Metus proin rhoncus vitae massa venenatis maximus
          conubia arcu. Nunc quisque quam id nullam cras euismod. Praesent curae
          aenean urna; curae lobortis rhoncus primis? Quam pharetra congue
          pulvinar finibus quisque habitasse metus lacinia. Ornare quisque
          sapien diam; primis mollis massa. Venenatis congue laoreet cubilia
          augue consequat suspendisse elementum fringilla diam. Tortor odio
          torquent integer, cubilia ridiculus sagittis. Dapibus purus in
          vehicula nulla diam. Vulputate vehicula proin ipsum mus iaculis
          vulputate aliquam; ex urna. Elit inceptos porttitor ex mattis dolor
          mauris porta tincidunt. Pharetra mollis massa penatibus mollis nullam
          elementum ultrices euismod. Litora mus diam pretium a morbi; suscipit
          molestie etiam quisque.
        </p>
        <p>
          Lorem ipsum odor amet, consectetuer adipiscing elit. Eu urna tincidunt
          class amet mi. Metus proin rhoncus vitae massa venenatis maximus
          conubia arcu. Nunc quisque quam id nullam cras euismod. Praesent curae
          aenean urna; curae lobortis rhoncus primis? Quam pharetra congue
          pulvinar finibus quisque habitasse metus lacinia. Ornare quisque
          sapien diam; primis mollis massa. Venenatis congue laoreet cubilia
          augue consequat suspendisse elementum fringilla diam. Tortor odio
          torquent integer, cubilia ridiculus sagittis. Dapibus purus in
          vehicula nulla diam. Vulputate vehicula proin ipsum mus iaculis
          vulputate aliquam; ex urna. Elit inceptos porttitor ex mattis dolor
          mauris porta tincidunt. Pharetra mollis massa penatibus mollis nullam
          elementum ultrices euismod. Litora mus diam pretium a morbi; suscipit
          molestie etiam quisque.
        </p>
      </div>

      <div className="mt-20 flex flex-col gap-16">
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
                member.image ? getEventImageUrl(member.image.id) : undefined
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
          <div className="mx-auto flex size-24 shrink-0 items-center justify-center rounded-full bg-primary">
            <PersonIcon className="size-12 text-primary-foreground" />
          </div>
        )}
        <h3 className="mt-6 text-base/7 font-semibold">{name}</h3>
        <p className="text-sm text-gray-50/80">{position}</p>
      </div>
    </li>
  );
}
