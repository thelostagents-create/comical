import { useState } from "react";
import { updateCharacterImage } from "../lib/data";
import type { Character } from "../types";
import ImageField from "./ImageField";
import Modal from "./Modal";

export default function EditCharacterImageModal({
  character,
  onClose,
  onSaved,
}: {
  character: Character;
  onClose: () => void;
  onSaved: (imageUrl: string | null) => void;
}) {
  const [url, setUrl] = useState(character.image_url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateCharacterImage(character.id, url.trim() || null);
      onSaved(updated.image_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update this character's photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`${character.name}'s photo`} onClose={onClose}>
      <ImageField label="Photo" value={url} onChange={setUrl} folder="characters" />
      {error && <div className="auth-error">{error}</div>}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy} onClick={handleSave}>
          Save
        </button>
      </div>
    </Modal>
  );
}
