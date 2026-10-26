import {
  ClipboardList,
  LayoutDashboard,
  MessageSquareText,
  PackageCheck,
  Radar,
  Route as RouteIcon,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  /** Carry the current ?date= along when moving to this page. */
  keepDate: boolean;
  icon: LucideIcon;
  /** Second key of the "G then …" shortcut. */
  key: string;
  /** Words that should find this page in the command bar. */
  terms: string;
};

export type NavGroup = { label: string; links: NavLink[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    links: [
      { href: "/", label: "Dashboard", keepDate: false, icon: LayoutDashboard, key: "d", terms: "home overview today kpi" },
      { href: "/fleet", label: "Live Fleet", keepDate: false, icon: Radar, key: "f", terms: "map trucks gps fleetio live tracking where" },
      { href: "/log", label: "Delivery Log", keepDate: false, icon: ClipboardList, key: "l", terms: "log proof of delivery pod signed photos drivers events" },
    ],
  },
  {
    label: "Dispatch",
    links: [
      { href: "/orders", label: "Ready to Ship", keepDate: false, icon: PackageCheck, key: "o", terms: "orders netsuite sales order rental pick ship fulfill" },
      { href: "/routes", label: "Route Planner", keepDate: true, icon: RouteIcon, key: "r", terms: "routes dispatch plan tomorrow stops assign drivers" },
    ],
  },
  {
    label: "Communication",
    links: [
      { href: "/messages", label: "Messages", keepDate: false, icon: MessageSquareText, key: "m", terms: "texts sms email customers drivers automations outbox" },
    ],
  },
  {
    label: "Fleet & Team",
    links: [{ href: "/drivers", label: "Drivers & Trucks", keepDate: false, icon: Truck, key: "t", terms: "drivers trucks fleet roster cdl service" }],
  },
];

export const NAV_LINKS: NavLink[] = NAV_GROUPS.flatMap((group) => group.links);

/** The nav link a path belongs to (detail pages count toward their list page). */
export function sectionFor(pathname: string): NavLink | undefined {
  if (pathname === "/") return NAV_LINKS[0];
  return NAV_LINKS.find((link) => link.href !== "/" && (pathname === link.href || pathname.startsWith(`${link.href}/`)));
}

/** Name of the page under a section, for the top bar trail. */
export function subpageFor(pathname: string): string | null {
  const section = sectionFor(pathname);
  if (!section || pathname === section.href) return null;
  if (section.href === "/routes") return "Route sheet";
  if (section.href === "/orders") return "Order";
  return "Detail";
}
