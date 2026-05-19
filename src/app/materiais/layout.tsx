// src/app/materiais/layout.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MateriaisLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Centro de Controle</h1>
        <p className="text-gray-500 mt-1">Gerencie materiais, insumos de uso diário e equipamentos em manutenção (RMA).</p>
      </header>

      {/* AS 3 ABAS NAVEGÁVEIS */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto custom-scrollbar">
        <Link 
          href="/materiais" 
          className={`px-6 py-3 font-bold text-sm whitespace-nowrap border-b-2 transition ${pathname === '/materiais' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          📦 Equipamentos (Geral)
        </Link>
        <Link 
          href="/materiais/insumos" 
          className={`px-6 py-3 font-bold text-sm whitespace-nowrap border-b-2 transition ${pathname === '/materiais/insumos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          🧰 Insumos e Ferramentas
        </Link>
        <Link 
          href="/materiais/rma" 
          className={`px-6 py-3 font-bold text-sm whitespace-nowrap border-b-2 transition ${pathname === '/materiais/rma' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          🛠️ RMA (Garantia/Manutenção)
        </Link>
      </div>

      {/* AQUI RENDERIZA O CONTEÚDO DE CADA PÁGINA */}
      <div>{children}</div>
    </div>
  );
}