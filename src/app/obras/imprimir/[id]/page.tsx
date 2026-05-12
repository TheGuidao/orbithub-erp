// src/app/obras/imprimir/[id]/page.tsx
import { PrismaClient } from "@prisma/client";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function ImprimirOSPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = parseInt(params.id);

  const obra = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      team: true,
      vehicles: true,
      checklist: { orderBy: { id: 'asc' } },
      materials: { include: { material: true } },
    }
  });

  if (!obra) return <div className="p-10 text-center font-bold text-red-500">O.S. não encontrada.</div>;

  const dataFormatada = obra.date 
      ? new Date(obra.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) 
      : "___/___/______";

  return (
    <div className="bg-gray-200 min-h-screen py-8 print:bg-white print:py-0 flex justify-center">
      
      {/* Botões Flutuantes (Escondidos na impressão) */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden">
        <Link href={`/obras/detalhes/${obra.id}`} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-slate-700 transition">
          ← Voltar
        </Link>
        {/* O script onclick chama a janela de impressão/PDF do Windows/Mac */}
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition"
          autoFocus 
          style={{}} // Hack para Client Component no Server Component
          // Como é Server Component, não podemos usar onClick nativo diretamente sem "use client", 
          // mas como é uma página isolada, esse truque HTML puro resolve lindamente:
        >
          <a href="javascript:window.print()">🖨️ Salvar como PDF</a>
        </button>
      </div>

      {/* FOLHA A4 (Padrão 210mm x 297mm) */}
      <div className="bg-white w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none p-12 text-slate-800">
        
        {/* CABEÇALHO */}
        <header className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">SMART TOUCH</h1>
            <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">Automação Residencial</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-400">ORDEM DE SERVIÇO</h2>
            <p className="text-lg font-black text-slate-800">Nº {String(obra.id).padStart(5, '0')}</p>
          </div>
        </header>

        {/* DADOS DA OBRA */}
        <section className="mb-8">
          <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase border-l-4 border-slate-800 mb-3">Detalhes do Serviço</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="font-bold">Identificação:</span> {obra.title}</div>
            <div><span className="font-bold">Data Agendada:</span> {dataFormatada}</div>
            <div className="col-span-2"><span className="font-bold">Endereço:</span> {obra.address || "Não informado"}</div>
            <div><span className="font-bold">Horário de Início:</span> {obra.startTime || "--:--"}</div>
            <div><span className="font-bold">Horário de Término:</span> {obra.endTime || "--:--"}</div>
          </div>
          <div className="border border-slate-200 p-3 text-sm min-h-[80px]">
            <span className="font-bold block mb-1">Descrição:</span>
            {obra.description || "Nenhuma descrição detalhada."}
          </div>
        </section>

        {/* MATERIAIS UTILIZADOS */}
        <section className="mb-8">
          <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase border-l-4 border-blue-600 mb-3">Materiais / Equipamentos Aplicados</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300">
                <th className="text-left py-2">Item</th>
                <th className="text-center py-2 w-20">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {obra.materials.map(m => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-2">{m.material.name}</td>
                  <td className="text-center font-bold">{m.quantity}</td>
                </tr>
              ))}
              {obra.materials.length === 0 && (
                <tr><td colSpan={2} className="py-4 text-center italic text-slate-400">Nenhum material registrado nesta OS.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        {/* EQUIPE */}
        <section className="mb-12">
          <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase border-l-4 border-slate-800 mb-3">Equipe Técnica</h3>
          <p className="text-sm">
            {obra.team.map(t => t.name).join(", ") || "Equipe não especificada."}
          </p>
        </section>

        {/* ASSINATURA */}
        <section className="border-t-2 border-slate-200 pt-8 mt-auto flex flex-col items-center">
          <p className="text-xs text-center text-slate-500 mb-8 max-w-lg">
            Declaro que os serviços descritos acima foram executados e finalizados a contento, assim como os materiais listados foram entregues e/ou instalados no local.
          </p>
          
          {obra.clientSignature ? (
            <div className="flex flex-col items-center">
              <img src={obra.clientSignature} alt="Assinatura" className="h-20 mb-2 border-b border-slate-400 px-8" />
              <p className="font-bold text-sm text-slate-800 uppercase">{obra.clientName}</p>
              {obra.clientCpf && <p className="text-xs text-slate-500">CPF: {obra.clientCpf}</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-64 h-20 border-b border-slate-400 mb-2"></div>
              <p className="font-bold text-sm text-slate-800 uppercase">Assinatura do Responsável</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}