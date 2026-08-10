import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import AuthGate from "./components/AuthGate";
import Library from "./components/Library";
import Fandom from "./components/Fandom";
import Discover from "./components/Discover";
import Feed from "./components/Feed";
import Profile from "./components/Profile";
import SeriesDetail from "./components/SeriesDetail";
import Journal from "./components/Journal";
import AccentPicker from "./components/AccentPicker";
import AdminPanel from "./components/AdminPanel";
import NotificationsPanel from "./components/NotificationsPanel";
import { Icon } from "./components/Icons";
import { fetchUnreadNotificationCount } from "./lib/data";
import { getThemeMode, setThemeMode, type ThemeMode } from "./theme";

export type View =
  | { tab: "library" }
  | { tab: "fandom" }
  | { tab: "discover" }
  | { tab: "feed" }
  | { tab: "profile"; userId?: string }
  | { tab: "series"; seriesId: string; from: View }
  | { tab: "journal"; from: View };

function Shell() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<View>({ tab: "library" });
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mode, setMode] = useState<ThemeMode>(getThemeMode());

  useEffect(() => {
    if (!profile) return;
    fetchUnreadNotificationCount(profile.id).then(setUnreadCount);
  }, [profile]);

  function toggleMode() {
    const next = mode === "dark" ? "light" : "dark";
    setThemeMode(next);
    setMode(next);
  }

  function openSeries(seriesId: string) {
    setView((prev) => ({ tab: "series", seriesId, from: prev }));
  }

  function openProfile(userId?: string) {
    setView({ tab: "profile", userId });
  }

  function openJournal() {
    setView((prev) => ({ tab: "journal", from: prev }));
  }

  let body: JSX.Element;
  if (view.tab === "series") {
    body = (
      <SeriesDetail
        seriesId={view.seriesId}
        onBack={() => setView(view.from)}
        onOpenProfile={openProfile}
      />
    );
  } else if (view.tab === "journal") {
    body = <Journal onBack={() => setView(view.from)} onOpenSeries={openSeries} />;
  } else if (view.tab === "library") {
    body = <Library onOpenSeries={openSeries} onOpenJournal={openJournal} />;
  } else if (view.tab === "fandom") {
    body = <Fandom />;
  } else if (view.tab === "discover") {
    body = <Discover onOpenSeries={openSeries} />;
  } else if (view.tab === "feed") {
    body = <Feed onOpenSeries={openSeries} onOpenProfile={openProfile} />;
  } else {
    body = (
      <Profile
        userId={view.userId ?? profile!.id}
        isSelf={!view.userId || view.userId === profile!.id}
        onOpenSeries={openSeries}
        onOpenProfile={openProfile}
      />
    );
  }

  const tab = view.tab === "series" || view.tab === "journal" ? view.from.tab : view.tab;

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Comical</span>
        <div className="topbar-actions">
          <button
            className="icon-btn notification-bell"
            onClick={() => setShowNotifications(true)}
            aria-label="Notifications"
          >
            <Icon name="bell" size={17} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>
          <button className="icon-btn" onClick={toggleMode} aria-label="Toggle light/dark mode">
            <Icon name={mode === "dark" ? "sun" : "moon"} size={17} />
          </button>
          <button className="icon-btn" onClick={() => setShowAccentPicker(true)} aria-label="Change accent color">
            <Icon name="palette" size={17} />
          </button>
          {profile?.is_admin && (
            <button className="icon-btn" onClick={() => setShowAdmin(true)} aria-label="Admin">
              <Icon name="shield" size={17} />
            </button>
          )}
          {tab === "profile" && (!("userId" in view) || !view.userId) && (
            <button className="btn-link" onClick={signOut}>
              Log out
            </button>
          )}
        </div>
      </header>

      <main className="content">{body}</main>

      <nav className="tabbar">
        <button className={tab === "library" ? "active" : ""} onClick={() => setView({ tab: "library" })}>
          <Icon name="library" />
          <span>Library</span>
        </button>
        <button className={tab === "fandom" ? "active" : ""} onClick={() => setView({ tab: "fandom" })}>
          <Icon name="sparkle" />
          <span>Fandom</span>
        </button>
        <button className={tab === "discover" ? "active" : ""} onClick={() => setView({ tab: "discover" })}>
          <Icon name="search" />
          <span>Discover</span>
        </button>
        <button className={tab === "feed" ? "active" : ""} onClick={() => setView({ tab: "feed" })}>
          <Icon name="feed" />
          <span>Feed</span>
        </button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => openProfile(undefined)}>
          <Icon name="user" />
          <span>Profile</span>
        </button>
      </nav>

      {showAccentPicker && <AccentPicker onClose={() => setShowAccentPicker(false)} />}

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {showNotifications && (
        <NotificationsPanel
          onClose={() => {
            setShowNotifications(false);
            setUnreadCount(0);
          }}
          onOpenProfile={(userId) => openProfile(userId)}
          onOpenFandom={() => setView({ tab: "fandom" })}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <Shell />
      </AuthGate>
    </AuthProvider>
  );
}
