"use client";
import { useState } from "react";

export type Poster = { data: string; preview: string; name: string };

export default function PosterPicker({
  value,
  onChange,
}: {
  value: Poster | null;
  onChange: (p: Poster | null) => void;
}) {
  const [error, setError] = useState("");

  function handle(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That image is larger than 10 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        setError("Could not read that image.");
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      URL.revokeObjectURL(url);
      onChange({ data: dataUrl.split(",")[1], preview: dataUrl, name: file.name });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not open that image.");
    };
    img.src = url;
  }

  return (
    <div>
      <label htmlFor="poster" className="text-sm font-medium">
        Poster image (optional)
      </label>
      <p className="text-xs text-[#566372]">
        The words on the poster are read by AI and checked like typed text.
      </p>
      <input
        id="poster"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-[#D5DBE2] file:bg-white file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-[#EEF1F4]"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#8A1C13]">
          {error}
        </p>
      )}
      {value && (
        <div className="mt-3 flex items-start gap-3">
          <img
            src={value.preview}
            alt={"Preview of " + value.name}
            className="max-h-32 rounded border border-[#D5DBE2]"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md border border-[#D5DBE2] px-3 py-1 text-sm font-medium hover:bg-[#EEF1F4]"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
