// src/app/components/SignaturePad.tsx
"use client";
import { useRef, useState, useEffect } from 'react';

export default function SignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#0f172a"; // Cor da caneta (azul bem escuro/preto)
        ctx.lineWidth = 3; // Grossura da caneta
        ctx.lineCap = "round";
      }
    }
  }, []);

  const getCoordinates = (event: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (event.touches && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      };
    }
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!isDrawing) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData("");
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full mt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assine no quadro abaixo:</p>
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 touch-none shadow-inner">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-[150px] cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      {/* Esse input escondido é o que manda a imagem pro banco de dados */}
      <input type="hidden" name="signatureData" value={signatureData} required />
      
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={clear} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-3 rounded-lg text-sm font-bold w-1/3 transition">
          Limpar
        </button>
        <button type="submit" disabled={!signatureData} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-3 rounded-lg text-sm font-bold w-2/3 transition disabled:bg-gray-300 disabled:cursor-not-allowed">
          Confirmar e Assinar
        </button>
      </div>
    </div>
  );
}