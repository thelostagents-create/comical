import { useState } from "react";
import { getCharacterImageOverride, setCharacterImageOverride } from "../lib/characterImagePrefs";
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
  const [url, setUrl] = useState(getCharacterImageOverride(character.id) ?? character.image_url ?? "");

  function handleSave() {
    const trimmed = url.trim() || null;
    setCharacterImageOverride(character.id, trimmed);
    onSaved(trimmed);
  }

  return (
    <Modal title={`${character.name}'s photo`} onClose={onClose}>
      <p className="sub" style={{ marginTop: -4 }}>
        Only changes how {character.name} looks to you on this device — everyone else still
        sees the catalog photo.
      </p>
      <ImageField label="Photo" value={url} onChange={setUrl} folder="characters" />
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </Modal>
  );
}
