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
