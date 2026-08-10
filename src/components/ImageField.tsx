import { useRef, useState } from "react";
import { uploadImage } from "../lib/upload";
import { Icon } from "./Icons";

export default function ImageField({
  label,
  value,
  onChange,
  folder,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file, folder));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field image-field">
      <span>{label}</span>
      {value && <img className="image-field-preview" src={value} alt="" />}
      <div className="image-field-row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or import a photo"
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          <Icon name="image" size={13} /> {busy ? "Uploading…" : "Import"}
        </button>
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={handleFile} />
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
