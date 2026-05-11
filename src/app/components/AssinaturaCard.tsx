// src/app/components/AssinaturaCard.tsx
"use client";

import { useRef, useState, MouseEvent, TouchEvent, useEffect } from "react";

export default function AssinaturaCard({ obraId, salvarAssinatura }: { obraId: number, salvarAssinatura: (id: number, nome: string, cpf: string, base64: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");

  // Evita que a tela do celular role enquanto o cliente assina
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const preventScroll = (e: any) => e.preventDefault();
      canvas.addEventListener('touchmove', preventScroll, { passive: false });
      return () => canvas.removeEventListener('touchmove', preventScroll);
    }
  }, []);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.beginPath();
    }
  };

  const draw = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#10b981"; // Cor da caneta (Verde)

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const limpar = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const finalizar = () => {
    if (!nome.trim()) {
      alert("⚠️ O Nome do Responsável é obrigatório para finalizar a O.S.");
      return;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const base64 = canvas.toDataURL("image/png");
      salvarAssinatura(obraId, nome, cpf, base64);
    }
  };

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Responsável *</label>
          <input 
            type="text" 
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: João Silva" 
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-white outline-none focus:border-green-500 transition" 
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">CPF (Opcional)</label>
          <input 
            type="text" 
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00" 
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-sm text-white outline-none focus:border-green-500 transition" 
          />
        </div>
      </div>

      <label className="block text-xs font-medium text-slate-400 mb-1">Assinatura Digital (Desenhe abaixo)</label>
      <div className="bg-slate-900 rounded-xl border-2 border-dashed border-slate-600 overflow-hidden relative touch-none">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[150px] cursor-crosshair"
        />
        <button 
          onClick={limpar} 
          type="button"
          className="absolute bottom-2 right-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] px-2 py-1 rounded font-bold transition"
        >
          Limpar
        </button>
      </div>

      <button 
        onClick={finalizar} 
        type="button"
        className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg text-sm transition shadow-md flex justify-center items-center gap-2"
      >
        Assinar e Concluir O.S.
      </button>
    </div>
  );
}