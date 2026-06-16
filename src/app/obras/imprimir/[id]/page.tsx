// src/app/obras/imprimir/[id]/page.tsx
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import BotaoImprimir from "../../../components/BotaoImprimir";

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
    <div className="bg-gray-200 min-h-screen py-8 flex flex-col items-center">
      
      {/* MÁGICA DO CSS DE IMPRESSÃO (Agora blindado contra páginas extras) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm; /* Remove a Data e a URL padrão do navegador */
          }
          body * {
            visibility: hidden;
          }
          #folha-a4, #folha-a4 * {
            visibility: visible;
          }
          #folha-a4 {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            height: 297mm; /* Trava a altura exata do A4 */
            overflow: hidden; /* Corta qualquer pixel que tente gerar uma página 2 */
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}} />

      {/* BARRA DE FERRAMENTAS */}
      <div className="w-[210mm] flex justify-end gap-3 mb-4 print:hidden">
        <Link href={`/obras/detalhes/${obra.id}`} className="bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-slate-700 transition flex items-center">
          ← Voltar
        </Link>
        <BotaoImprimir />
      </div>

      {/* FOLHA A4 (Padrão 210mm x 297mm) */}
      {/* Reduzi o padding de p-12 para p-8 para dar mais respiro ao conteúdo sem estourar o limite */}
      <div id="folha-a4" className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-8 md:p-12 text-slate-800 relative flex flex-col">
        
        {/* CABEÇALHO */}
        <header className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-6 shrink-0">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Nexar Hub</h1>
            <p className="text-xs font-bold text-slate-500 tracking-widest uppercase">Automação Residencial</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-400">ORDEM DE SERVIÇO</h2>
          </div>
        </header>

        {/* DADOS DA OBRA */}
        <section className="mb-6 shrink-0">
          <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase border-l-4 border-slate-800 mb-3">Detalhes do Serviço</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="font-bold">Identificação:</span> {obra.title}</div>
            <div><span className="font-bold">Data Agendada:</span> {dataFormatada}</div>
            <div className="col-span-2"><span className="font-bold">Endereço:</span> {obra.address || "Não informado"}</div>
            <div><span className="font-bold">Horário de Início:</span> {obra.startTime || "--:--"}</div>
            <div><span className="font-bold">Horário de Término:</span> {obra.endTime || "--:--"}</div>
          </div>
          <div className="border border-slate-200 p-3 text-sm min-h-[60px]">
            <span className="font-bold block mb-1">Descrição:</span>
            {obra.description || "Nenhuma descrição detalhada."}
          </div>
        </section>

        {/* MATERIAIS UTILIZADOS */}
        <section className="mb-6 shrink-0">
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
        <section className="mb-auto shrink-0">
          <h3 className="text-sm font-bold bg-slate-100 p-2 uppercase border-l-4 border-slate-800 mb-3">Equipe Técnica</h3>
          <p className="text-sm">
            {obra.team.map(t => t.name).join(", ") || "Equipe não especificada."}
          </p>
        </section>

        {/* ASSINATURA (Sempre empurrada para o final da folha pelo mb-auto da seção acima) */}
        <section className="border-t-2 border-slate-200 pt-6 shrink-0 flex flex-col items-center">
          <p className="text-xs text-center text-slate-500 mb-6 max-w-lg">
            Declaro que os serviços descritos acima foram executados e finalizados a contento, assim como os materiais listados foram entregues e/ou instalados no local.
          </p>
          
          {obra.clientSignature ? (
            <div className="flex flex-col items-center">
              <img src={obra.clientSignature} alt="Assinatura" className="h-16 mb-2 border-b border-slate-400 px-8" />
              <p className="font-bold text-sm text-slate-800 uppercase">{obra.clientName}</p>
              {obra.clientCpf && <p className="text-xs text-slate-500">CPF: {obra.clientCpf}</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-64 h-16 border-b border-slate-400 mb-2"></div>
              <p className="font-bold text-sm text-slate-800 uppercase">Assinatura do Responsável</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}