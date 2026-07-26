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
      className="scrollbar-hidden flex gap-5 overflow-x-auto border-b px-4 whitespace-nowrap md:gap-7 md:px-10"
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
                "-mb-px inline-flex items-center gap-2 border-b-2 py-4 text-base font-semibold transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )
            }
          >
            {tab.label}
            {count !== null ? (
              <span className="text-foreground/50 bg-foreground/5 rounded-full px-2 py-px text-xs font-bold">
                {count}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
