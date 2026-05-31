"use client";

import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ScanButton({ userId }: { userId: string }) {
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);

    try {
      // Converter para Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Image = reader.result as string;

        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image, userId }),
        });

        if (response.ok) {
          alert("✅ Nota fiscal processada com sucesso!");
          router.refresh();
        } else {
          alert("❌ Falha ao processar imagem.");
        }
        setIsScanning(false);
      };
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao enviar imagem.");
      setIsScanning(false);
    }
  };

  return (
    <>
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        className="hidden" 
        ref={fileInputRef}
        onChange={handleScan}
      />
      
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isScanning}
        className="fixed bottom-10 right-10 w-16 h-16 bg-accent text-primary rounded-full shadow-2xl flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-all z-50 border-4 border-white disabled:opacity-50 disabled:scale-100"
        title="Capi-Scan AI"
      >
        {isScanning ? (
          <Loader2 className="w-8 h-8 animate-spin" />
        ) : (
          "📸"
        )}
      </button>
    </>
  );
}
