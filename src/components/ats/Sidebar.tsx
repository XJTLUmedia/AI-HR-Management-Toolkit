"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useATS } from "@/lib/ats/context";
import type { ATSView } from "@/lib/ats/types";

/* ────────────────────────── Types ────────────────────────── */

interface SidebarProps {
  badges?: Partial<Record<ATSView, number>>;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

/* ────────────────────────── Nav items ────────────────────── */

interface NavItem {
  view: ATSView;
  label: string;
  icon: React.ReactNode;
  bottom?: boolean;
}

const icon = (d: string) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    width={24}
    height={24}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  {
    view: "dashboard",
    label: "Dashboard",
    icon: icon(
      "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z",
    ),
  },
  {
    view: "candidates",
    label: "Candidates",
    icon: icon(
      "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
    ),
  },
  {
    view: "jobs",
    label: "Jobs",
    icon: icon(
      "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0",
    ),
  },
  {
    view: "interviews",
    label: "Interviews",
    icon: icon(
      "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z",
    ),
  },
  {
    view: "offers",
    label: "Offers",
    icon: icon(
      "M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Zm-2.625-1.5a.75.75 0 0 0-.75.75v.75h-.75a.75.75 0 0 0 0 1.5h.75v.75a.75.75 0 0 0 1.5 0v-.75h.75a.75.75 0 0 0 0-1.5h-.75v-.75a.75.75 0 0 0-.75-.75Z",
    ),
  },
  {
    view: "talent-pool",
    label: "Talent Pool",
    icon: icon(
      "M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z",
    ),
  },
  {
    view: "scorecards",
    label: "Scorecards",
    icon: icon(
      "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z",
    ),
  },
  {
    view: "onboarding",
    label: "Onboarding",
    icon: icon(
      "M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5",
    ),
  },
  {
    view: "compliance",
    label: "Compliance",
    icon: icon(
      "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
    ),
  },
  {
    view: "communications",
    label: "Communications",
    icon: icon(
      "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
    ),
  },
  {
    view: "search",
    label: "Search",
    icon: icon(
      "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
    ),
  },
  {
    view: "analysis",
    label: "Resume Analysis",
    icon: icon(
      "M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6",
    ),
  },
  {
    view: "parsing-health",
    label: "Parsing Health",
    icon: icon(
      "M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437",
    ),
  },
  {
    view: "parser",
    label: "Resume Parser",
    icon: icon(
      "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
    ),
  },
  {
    view: "settings",
    label: "Settings",
    icon: icon(
      "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    ),
    bottom: true,
  },
];

const mainItems = NAV_ITEMS.filter((i) => !i.bottom);
const bottomItems = NAV_ITEMS.filter((i) => i.bottom);

/* ────────────────────────── Component ────────────────────── */

export default function Sidebar({ badges, collapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const { currentView, setCurrentView, setSelectedCandidateId, setSelectedJobId } = useATS();

  const navigate = (view: ATSView) => {
    setSelectedCandidateId(null);
    setSelectedJobId(null);
    setCurrentView(view);
  };
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === 'function' ? val(collapsed) : val;
    setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          zIndex: 40,
          overflow: "hidden",
        }}
        className="ats-sidebar-desktop"
      >
        {/* Branding + collapse toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: "16px 12px",
            borderBottom: "1px solid var(--border)",
            minHeight: 56,
          }}
        >
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="brand"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: "-0.02em",
                  color: "var(--primary)",
                  whiteSpace: "nowrap",
                }}
              >
                ATS
              </motion.span>
            )}
          </AnimatePresence>

          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              width={20}
              height={20}
              style={{
                transform: collapsed ? "rotate(180deg)" : undefined,
                transition: "transform 0.2s ease",
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
              />
            </svg>
          </button>
        </div>

        {/* Main nav items */}
        <nav style={{ flex: 1, padding: "8px 8px 0", overflowY: "auto" }}>
          {mainItems.map((item) => (
            <NavButton
              key={item.view}
              item={item}
              active={currentView === item.view}
              collapsed={collapsed}
              badge={badges?.[item.view]}
              onClick={() => navigate(item.view)}
            />
          ))}
        </nav>

        {/* Bottom items */}
        <div style={{ padding: "0 8px 12px", borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
          {bottomItems.map((item) => (
            <NavButton
              key={item.view}
              item={item}
              active={currentView === item.view}
              collapsed={collapsed}
              badge={badges?.[item.view]}
              onClick={() => navigate(item.view)}
            />
          ))}
        </div>
      </motion.aside>

      {/* ── Mobile bottom bar ── */}
      <nav className="ats-sidebar-mobile">
        {NAV_ITEMS.map((item) => (
          <MobileNavButton
            key={item.view}
            item={item}
            active={currentView === item.view}
            badge={badges?.[item.view]}
            onClick={() => navigate(item.view)}
          />
        ))}
      </nav>

      {/* ── Responsive styles ── */}
      <style>{`
        .ats-sidebar-mobile {
          display: none;
        }

        @media (max-width: 768px) {
          .ats-sidebar-desktop {
            display: none !important;
          }
          .ats-sidebar-mobile {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 56px;
            background: var(--surface);
            border-top: 1px solid var(--border);
            z-index: 40;
            overflow-x: auto;
            overflow-y: hidden;
            align-items: center;
            gap: 2px;
            padding: 0 4px;
            -webkit-overflow-scrolling: touch;
          }
          .ats-sidebar-mobile::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

/* ────────────────────── Desktop nav button ───────────────── */

function NavButton({
  item,
  active,
  collapsed,
  badge,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: collapsed ? "10px 0" : "10px 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--primary)" : "var(--foreground)",
        background: active ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
        transition: "background 0.15s ease, color 0.15s ease",
        position: "relative",
        marginBottom: 2,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active)
          e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>

      <AnimatePresence mode="wait">
        {!collapsed && (
          <motion.span
            key={item.label}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            style={{ whiteSpace: "nowrap", overflow: "hidden" }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {badge != null && badge > 0 && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: collapsed ? "absolute" : "relative",
            top: collapsed ? 4 : "auto",
            right: collapsed ? 4 : "auto",
            marginLeft: collapsed ? 0 : "auto",
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 9,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: "18px",
            textAlign: "center",
            color: "#fff",
            background: "var(--primary)",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </motion.span>
      )}
    </motion.button>
  );
}

/* ────────────────────── Mobile nav button ────────────────── */

function MobileNavButton({
  item,
  active,
  badge,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        flex: "0 0 auto",
        minWidth: 52,
        height: 48,
        padding: "4px 6px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--primary)" : "var(--muted)",
        background: active ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent",
        position: "relative",
      }}
    >
      <span style={{ display: "flex", position: "relative" }}>
        {item.icon}
        {badge != null && badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -8,
              minWidth: 14,
              height: 14,
              padding: "0 3px",
              borderRadius: 7,
              fontSize: 9,
              fontWeight: 700,
              lineHeight: "14px",
              textAlign: "center",
              color: "#fff",
              background: "var(--primary)",
            }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
    </motion.button>
  );
}
