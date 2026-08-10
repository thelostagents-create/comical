import { useState } from "react";
import { ACCENT_PRESETS, getStoredAccent, isValidHex, setStoredAccent } from "../theme";
import Modal from "./Modal";

export default function AccentPicker({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState(getStoredAccent());
  const [hexInput, setHexInput] = useState(current);

  function choose(hex: string) {
    setCurrent(hex);
    setHexInput(hex);
    setStoredAccent(hex);
  }

  function applyCustom() {
    const hex = hexInput.startsWith("#") ? hexInput : `#${hexInput}`;
    if (isValidHex(hex)) choose(hex);
  }

  return (
    <Modal title="Accent color" onClose={onClose}>
      <div className="swatch-row">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.hex}
            className={`swatch ${current.toLowerCase() === p.hex.toLowerCase() ? "selected" : ""}`}
            style={{ background: p.hex }}
            onClick={() => choose(p.hex)}
            aria-label={p.name}
          />
        ))}
      </div>
      <label className="field">
        <span>Custom hex</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={applyCustom}
            placeholder="#ff7a59"
          />
          <div className="swatch" style={{ background: isValidHex(hexInput) ? hexInput : "transparent", flexShrink: 0 }} />
        </div>
      </label>
      <div className="modal-actions">
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
