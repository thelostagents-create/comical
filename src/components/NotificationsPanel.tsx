import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { fetchNotifications, markNotificationsRead, type NotificationRow } from "../lib/data";
import { timeAgo } from "../lib/format";
import Modal from "./Modal";

const NOTIFICATION_TEXT: Record<NotificationRow["type"], string> = {
  reaction: "reacted to your post",
  reply: "replied to your post",
  follow: "followed you",
};

export default function NotificationsPanel({
  onClose,
  onOpenProfile,
  onOpenFandom,
}: {
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenFandom: () => void;
}) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const rows = await fetchNotifications(profile.id);
      setNotifications(rows);
      const unreadIds = rows.filter((r) => !r.read).map((r) => r.id);
      if (unreadIds.length > 0) await markNotificationsRead(unreadIds);
    })();
  }, [profile]);

  function open(n: NotificationRow) {
    onClose();
    if (n.type === "follow") onOpenProfile(n.actor.id);
    else onOpenFandom();
  }

  return (
    <Modal title="Notifications" onClose={onClose}>
      {notifications === null && <div className="empty">Loading…</div>}
      {notifications !== null && notifications.length === 0 && (
        <div className="empty">Nothing here yet.</div>
      )}
      {notifications?.map((n) => (
        <div
          className={`user-row notification-row${n.read ? "" : " unread"}`}
          key={n.id}
          style={{ cursor: "pointer" }}
          onClick={() => open(n)}
        >
          {n.actor.avatar_url ? (
            <img className="avatar" src={n.actor.avatar_url} alt="" loading="lazy" />
          ) : (
            <div className="avatar">{n.actor.username.slice(0, 2).toUpperCase()}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>
              <b>@{n.actor.username}</b> {NOTIFICATION_TEXT[n.type]}
            </div>
            <div className="sub">{timeAgo(n.created_at)}</div>
          </div>
        </div>
      ))}
    </Modal>
  );
}
