"use client";

import { useState } from "react";
import { createGoal } from "./actions";
import { Plus, X } from "lucide-react";

export function AddGoalForm() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-primary text-white px-6 py-4 rounded-3xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
      >
        <Plus className="w-5 h-5" />
        <span>Nova Meta</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
      <div className="bg-white rounded-[48px] p-10 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute right-8 top-8 p-2 hover:bg-surface rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h3 className="text-2xl font-display font-bold text-primary mb-8">Criar Nova Meta</h3>
        
        <form action={async (formData) => {
          await createGoal(formData);
          setIsOpen(false);
        }} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Título do Sonho</label>
            <input 
              name="title"
              type="text" 
              required
              placeholder="Ex: Viagem para o Japão"
              className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Valor Objetivo (R$)</label>
            <input 
              name="targetAmount"
              type="number" 
              step="0.01"
              required
              placeholder="Ex: 15000.00"
              className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Prazo (Opcional)</label>
            <input 
              name="deadline"
              type="date" 
              className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
            />
          </div>

          <button type="submit" className="w-full bg-primary text-white py-5 rounded-3xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all text-lg">
            Começar a Poupar
          </button>
        </form>
      </div>
    </div>
  );
}
