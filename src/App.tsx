import { useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import AuthGate from "./components/AuthGate";
import Library from "./components/Library";
import Discover from "./components/Discover";
import Feed from "./components/Feed";
import Profile from "./components/Profile";
import SeriesDetail from "./components/SeriesDetail";
import { Icon } from "./components/Icons";

export type View =
  | { tab: "library" }
  | { tab: "discover" }
  | { tab: "feed" }
  | { tab: "profile"; userId?: string }
  | { tab: "series"; seriesId: string; from: View };

function Shell() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<View>({ tab: "library" });

  function openSeries(seriesId: string) {
    setView((prev) => ({ tab: "series", seriesId, from: prev }));
  }

  function openProfile(userId?: string) {
    setView({ tab: "profile", userId });
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
  } else if (view.tab === "library") {
    body = <Library onOpenSeries={openSeries} />;
  } else if (view.tab === "discover") {
    body = <Discover onOpenSeries={openSeries} onOpenProfile={openProfile} />;
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

  const tab = view.tab === "series" ? view.from.tab : view.tab;

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Comical</span>
        {tab === "profile" && (!("userId" in view) || !view.userId) && (
          <button className="btn-link" onClick={signOut}>
            Log out
          </button>
        )}
      </header>

      <main className="content">{body}</main>

      <nav className="tabbar">
        <button className={tab === "library" ? "active" : ""} onClick={() => setView({ tab: "library" })}>
          <Icon name="library" />
          <span>Library</span>
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
