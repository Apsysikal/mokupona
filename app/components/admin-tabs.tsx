import { NavLink } from "react-router";

import { cn } from "~/lib/utils";

export interface AdminTabCounts {
  dinners: number;
  locations: number;
  board: number;
  users: number | null;
}

const TABS = [
  { to: "/admin", label: "overview", end: true },
  { to: "/admin/dinners", label: "dinners", countKey: "dinners" },
  { to: "/admin/locations", label: "locations", countKey: "locations" },
  { to: "/admin/board-members", label: "board", countKey: "board" },
  { to: "/admin/users", label: "users", countKey: "users" },
] as const;

// Secondary section nav under the site nav, shared by desktop and mobile
// (the mobile pill-chip variant was rejected — same underline bar, it just
// scrolls horizontally).
export function AdminTabs({ counts }: { counts: AdminTabCounts }) {
  return (
    <nav
      aria-label="Admin sections"
      className="border-foreground/10 flex gap-5.5 overflow-x-auto border-b px-4 whitespace-nowrap md:gap-7.5 md:px-10 [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((tab) => {
        const count = "countKey" in tab ? counts[tab.countKey] : null;

        // the users tab is admin-only; its count is null for moderators
        if ("countKey" in tab && tab.countKey === "users" && count === null) {
          return null;
        }

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={"end" in tab ? tab.end : false}
            prefetch="intent"
            className={({ isActive }) =>
              cn(
                "-mb-px inline-flex items-center gap-1.75 border-b-2 py-4 text-[15px] font-semibold transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )
            }
          >
            {tab.label}
            {count !== null ? (
              <span className="text-fg-label bg-foreground/6 rounded-full px-1.75 py-px text-[11px] font-bold">
                {count}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
