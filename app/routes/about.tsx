import { ClassValue } from "clsx";

import { cn } from "~/lib/utils";

export default function AboutPage() {
  const team = [
    {
      name: "Michael Foster",
      boardMember: true,
      description: "President",
      imageUrl:
        "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Dries Vincent",
      boardMember: true,
      description: "Vice President",
      imageUrl:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Lindsay Walton",
      boardMember: true,
      description: "Actuary, Treasury",
      imageUrl:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Tom Cook",
      boardMember: true,
      description: "Deputy",
      imageUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Michael Foster",
      boardMember: false,
      description: "lorem dolor",
      imageUrl:
        "https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Dries Vincent",
      boardMember: false,
      description: "short text",
      imageUrl:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Lindsay Walton",
      boardMember: false,
      description: "text",
      imageUrl:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Tom Cook",
      description:
        "Lorem ipsum odor amet, consectetuer adipiscing elit. Montes malesuada augue interdum feugiat volutpat? Varius ante magnis eu pharetra blandit.",
      imageUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Tom Cook",
      description:
        "Lorem ipsum odor amet, consectetuer adipiscing elit. Montes malesuada augue interdum feugiat volutpat? Varius ante magnis eu pharetra blandit.",
      imageUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Tom Cook",
      description:
        "Lorem ipsum odor amet, consectetuer adipiscing elit. Montes malesuada augue interdum feugiat volutpat? Varius ante magnis eu pharetra blandit.",
      imageUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Tom Cook",
      description:
        "Lorem ipsum odor amet, consectetuer adipiscing elit. Montes malesuada augue interdum feugiat volutpat? Varius ante magnis eu pharetra blandit.",
      imageUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Tom Cook",
      description:
        "Lorem ipsum odor amet, consectetuer adipiscing elit. Montes malesuada augue interdum feugiat volutpat? Varius ante magnis eu pharetra blandit.",
      imageUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
    {
      name: "Tom Cook",
      description:
        "Lorem ipsum odor amet, consectetuer adipiscing elit. Montes malesuada augue interdum feugiat volutpat? Varius ante magnis eu pharetra blandit.",
      imageUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=1024&h=1024&q=80",
    },
  ];

  const boardMembers = team.filter(({ boardMember }) => boardMember === true);
  const teamMembers = team.filter(({ boardMember }) => !boardMember);

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
        <h2 className="text-4xl lowercase">Our Members</h2>
        <ul
          className={cn(
            "grid grid-cols-2 gap-x-8 gap-y-16",
            boardMembers.length % 2 === 0 && "md:grid-cols-2",
            boardMembers.length % 3 === 0 && "md:grid-cols-3",
            boardMembers.length % 4 === 0 && "md:grid-cols-4",
            boardMembers.length % 5 === 0 && "md:grid-cols-3 lg:grid-cols-5",
            boardMembers.length % 6 === 0 && "md:grid-cols-3 lg:grid-cols-6",
            boardMembers.length % 7 === 0 && "md:grid-cols-4 lg:grid-cols-7",
          )}
        >
          {boardMembers.map((member, index) => (
            <TeamMember
              key={`${member.name}-${index}`}
              {...member}
              className="text-center"
            />
          ))}
        </ul>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-x-8 gap-y-16">
          {teamMembers.map((member, index) => (
            <TeamMember key={`${member.name}-${index}`} {...member} />
          ))}
        </ul>
      </div>
    </main>
  );
}

function TeamMember({
  imageUrl,
  name,
  description,
  boardMember,
  className,
}: {
  name: string;
  imageUrl: string;
  description: string;
  boardMember?: boolean;
  className?: ClassValue;
}) {
  return (
    <li>
      <img alt={name} src={imageUrl} className="mx-auto size-24 rounded-full" />
      {boardMember ? (
        <div className={cn(className)}>
          <h3 className="mt-6 text-base/7 font-semibold">{name}</h3>
          <p className="text-sm text-gray-50/80">{description}</p>
        </div>
      ) : null}
    </li>
  );
}
