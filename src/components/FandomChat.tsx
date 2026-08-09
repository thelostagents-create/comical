import { useState } from "react";
import { Icon } from "./Icons";
import Modal from "./Modal";

const FANDOMS = [
  { label: "Marvel", query: "marvel" },
  { label: "DC", query: "dc" },
  { label: "Manga", query: "manga" },
];

export default function FandomChat({ onPick }: { onPick: (query: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Jump to a fandom">
        <Icon name="chat" size={22} />
      </button>

      {open && (
        <Modal title="Jump to a fandom" onClose={() => setOpen(false)}>
          <div className="chat-bubble-row">
            <div className="avatar chat-avatar">
              <Icon name="chat" size={16} />
            </div>
            <div className="chat-bubble">Looking for something specific? Pick a fandom to browse:</div>
          </div>
          <div className="fandom-picks">
            {FANDOMS.map((f) => (
              <button
                key={f.query}
                className="btn-secondary"
                onClick={() => {
                  setOpen(false);
                  onPick(f.query);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
