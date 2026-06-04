"use client";

import { useState, useTransition } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { uploadPhoto } from "@/app/dashboard/patients/actions";
import { photoSrc } from "@/lib/photo";

type SlotName = "photo3x4" | "photoExtra1" | "photoExtra2" | "photoExtra3";
type Initial = Partial<Record<SlotName, string | null>>;

const EXTRAS: SlotName[] = ["photoExtra1", "photoExtra2", "photoExtra3"];

function Slot({
  name,
  label,
  initial,
  ratio,
}: {
  name: SlotName;
  label: string;
  initial?: string | null;
  ratio: string;
}) {
  const [value, setValue] = useState<string>(initial || "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onPick(file: File) {
    setErr(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadPhoto(fd);
      if (res.ok && res.pathname) setValue(res.pathname);
      else setErr(res.error || "Falha no upload.");
    });
  }

  const preview = photoSrc(value);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-foreground/60">{label}</p>
      <label
        className={`relative ${ratio} w-full rounded-2xl border-2 border-dashed border-border bg-surface/50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-accent transition group`}
      >
        <input type="hidden" name={name} value={value} />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? (
          <img src={preview} alt={label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-foreground/40">
            <Camera className="w-6 h-6" />
            <span className="text-[10px] font-semibold">Enviar</span>
          </div>
        )}
        {pending && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
      </label>
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="text-[11px] font-semibold text-red-500/70 hover:text-red-600 inline-flex items-center gap-1"
        >
          <X className="w-3 h-3" /> remover
        </button>
      )}
      {err && <p className="text-[11px] text-red-600">{err}</p>}
    </div>
  );
}

// Slot único (ex.: foto 3x4 do terapeuta nos Ajustes).
export function SinglePhoto({
  name = "photo3x4",
  label = "Foto 3x4",
  initial,
}: {
  name?: SlotName;
  label?: string;
  initial?: string | null;
}) {
  return (
    <div className="w-[120px]">
      <Slot name={name} label={label} initial={initial} ratio="aspect-[3/4]" />
    </div>
  );
}

export function PhotoSlots({ initial = {} }: { initial?: Initial }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
        <Slot name="photo3x4" label="Foto 3x4 (referência)" initial={initial.photo3x4} ratio="aspect-[3/4]" />
        <div className="grid grid-cols-3 gap-3">
          {EXTRAS.map((n, i) => (
            <Slot key={n} name={n} label={`Foto ${i + 1}`} initial={initial[n]} ratio="aspect-square" />
          ))}
        </div>
      </div>
    </div>
  );
}
