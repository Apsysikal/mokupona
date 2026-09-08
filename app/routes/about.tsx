import type { Route } from "./+types/about";

import { OptimizedImage } from "~/components/optimized-image";
import { RouteErrorContent } from "~/components/route-error-content";
import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
  SectionDivider,
} from "~/components/section";
import {
  TextSectionBlockView,
  type TextSectionBlockType,
} from "~/features/cms/blocks/text-section";
import { listBoardMembers } from "~/models/board-member.server";
import type { ImageMetadata } from "~/models/image.server";

/** Square portraits keep the grid honest whatever aspect the upload had. */
const PORTRAIT_SIZE = 320;

export async function loader() {
  return { volunteers: await listBoardMembers() };
}

export const meta: Route.MetaFunction = () => [
  { title: "About" },
  {
    name: "description",
    content:
      "The people behind moku pona — a dinner society in Zurich built on community, creativity, and hospitality.",
  },
];

const whoWeAreSectionData: TextSectionBlockType = {
  type: "text-section",
  version: 1,
  data: {
    eyebrow: "who we are",
    headline: "a community of around fifteen",
    body: "what started as a shared love of cooking has grown into a community who come together to create, host, and share meals. as an association, moku pona is about community, creativity, and hospitality, not just dining, but making people feel welcome.",
    variant: "slanted",
  },
};

export default function AboutPage({ loaderData }: Route.ComponentProps) {
  const { volunteers } = loaderData;

  return (
    <PageContainer className="grow pt-7 pb-20">
      <div className="mb-9 flex flex-col gap-3 md:mb-12">
        <Eyebrow variant="tracked" tone="primary">
          the people
        </Eyebrow>
        <h1 className={pageTitleClassName}>about</h1>
        <p className="text-muted-foreground max-w-2xl text-base font-light md:text-lg">
          moku pona runs on volunteers — the ones who cook, host, wash up, and
          somehow still have room for dessert.
        </p>
      </div>

      <TextSectionBlockView blockData={whoWeAreSectionData} />

      <div className="mt-14 md:mt-20">
        <SectionDivider className="mb-5">
          the moku pona hall of fame
        </SectionDivider>

        {volunteers.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {volunteers.map((volunteer) => (
              <VolunteerCard key={volunteer.id} volunteer={volunteer} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground max-w-md text-base font-light md:text-lg">
            the hall is still being hung. check back once we&apos;ve persuaded
            everyone to sit still for a photograph.
          </p>
        )}
      </div>
    </PageContainer>
  );
}

function VolunteerCard({
  volunteer,
}: {
  volunteer: {
    id: string;
    name: string;
    position: string;
    image: ImageMetadata | null;
  };
}) {
  return (
    <li className="flex flex-col gap-3">
      <div className="bg-sage/40 overflow-hidden rounded-2xl">
        {volunteer.image ? (
          <OptimizedImage
            image={volunteer.image}
            alt={volunteer.name}
            width={PORTRAIT_SIZE}
            height={PORTRAIT_SIZE}
            loading="lazy"
            sizes="(min-width: 1024px) 260px, (min-width: 640px) 30vw, 45vw"
            className="w-full"
          />
        ) : (
          <PortraitPlaceholder name={volunteer.name} />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-base leading-tight font-light md:text-lg">
          {volunteer.name}
        </h3>
        <p className="text-muted-foreground text-xs md:text-sm">
          {volunteer.position}
        </p>
      </div>
    </li>
  );
}

/** Stands in until someone uploads a portrait — initials on a sage card. */
function PortraitPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className="text-ink/60 flex aspect-square items-center justify-center text-3xl font-light"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <PageContainer className="grow pt-7 pb-20">
      <RouteErrorContent error={error} />
    </PageContainer>
  );
}
