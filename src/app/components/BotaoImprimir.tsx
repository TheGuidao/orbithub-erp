// src/app/components/BotaoImprimir.tsx
"use client";

import { useEffect } from "react";

export default function BotaoImprimir() {
  // Esse código faz a janela de PDF abrir automaticamente assim que a tela carrega!
  useEffect(() => {
    // Um pequeno atraso de meio segundo apenas para garantir que a logo e fontes carregaram visualmente
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <button 
      onClick={() => window.print()}
      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition"
    >
      🖨️ Salvar como PDF
    </button>
  );
}