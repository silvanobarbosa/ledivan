"use client";

import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

// Só aparece na tela inicial e nas telas do Financeiro.
const ALLOWED = ["/dashboard", "/dashboard/transactions", "/dashboard/reports", "/dashboard/goals", "/dashboard/gamification"];

export function ScanButton({ userId }: { userId: string }) {
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  if (!ALLOWED.includes(pathname)) return null;

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
        className="fixed bottom-28 right-5 lg:bottom-10 lg:right-10 w-14 h-14 lg:w-16 lg:h-16 bg-accent text-primary rounded-full shadow-2xl flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-all z-50 border-4 border-white disabled:opacity-50 disabled:scale-100"
        title="Escanear recibo com IA"
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
