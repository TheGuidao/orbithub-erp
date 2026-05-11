// src/app/obras/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function ObrasPage(props: { searchParams: Promise<{ nova?: string, data?: string }> }) {
  const searchParams = await props.searchParams;
  const showNovaObra = searchParams?.nova === 'true';
  const filtroData = searchParams?.data || ""; // Data vinda do filtro (YYYY-MM-DD)

  // Busca as obras no banco ordenadas pela data mais próxima
  let obras = await prisma.serviceOrder.findMany({
    include: { team: true },
    orderBy: { date: 'asc' }
  });

  // Filtro Inteligente de Data (Agenda)
  if (filtroData) {
    obras = obras.filter(o => {
      if (!o.date) return false;
      // Converte a data do banco para o formato YYYY-MM-DD para comparar com o filtro
      const dataObra = o.date.toISOString().split('T')[0];
      return dataObra === filtroData;
    });
  }

  const agendadas = obras.filter(o => o.status === 'AGENDADO');
  const emAndamento = obras.filter(o => o.status === 'EM_ANDAMENTO');
  const concluidas = obras.filter(o => o.status === 'CONCLUIDO');

  // SERVER ACTION: Criar Obra
  async function criarObra(formData: FormData) {
    "use server";
    const title = formData.get("title") as string;
    const dateString = formData.get("date") as string;
    
    let dateObj = null;
    if (dateString) {
      // Truque de fuso horário: adiciona T12:00:00Z para garantir que o dia não mude no servidor
      dateObj = new Date(`${dateString}T12:00:00Z`);
    }

    if (title) {
      await prisma.serviceOrder.create({
        data: { 
          title, 
          status: 'AGENDADO',
          date: dateObj
        }
      });
    }
    
    revalidatePath("/obras");
    redirect("/obras"); // Fecha o modal
  }

  // SERVER ACTION: Excluir Obra
  async function deletarObra(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);
    await prisma.serviceOrder.delete({ where: { id } });
    revalidatePath("/obras");
  }

  // Componente visual do Card
  const ObraCard = ({ obra }: { obra: any }) => {
    // Formata a data para exibir no card (Ex: 11/05/2026)
    const dataFormatada = obra.date 
      ? new Date(obra.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) 
      : "Sem data";

    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-3 group hover:shadow-md transition flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-gray-900 leading-tight">{obra.title}</h3>
          <span className="text-xs font-bold text-gray-400">#{obra.id}</span>
        </div>
        
        {/* Exibição da Data */}
        <div className="mb-2">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 flex inline-flex items-center gap-1">
            📅 {dataFormatada}
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-3 line-clamp-2 flex-1">
          {obra.description || "Sem detalhes adicionais ainda..."}
        </p>
        
        <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-auto">
          {/* Botão de Excluir */}
          <form action={deletarObra}>
            <input type="hidden" name="id" value={obra.id} />
            <button 
              type="submit" 
              className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition"
              title="Excluir OS"
            >
              🗑️
            </button>
          </form>

          {/* Botão de Acessar Detalhes */}
          <Link href={`/obras/detalhes/${obra.id}`} className="text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded transition">
            Ver OS ➔
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 h-[calc(100vh-60px)] flex flex-col">
      
      {/* MODAL DE NOVA OBRA */}
      {showNovaObra && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Nova Ordem de Serviço</h2>
            <form action={criarObra}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Título/Identificação da Obra</label>
                <input 
                  type="text" 
                  name="title" 
                  required 
                  placeholder="Ex: Obra Bonadio - Home Theater" 
                  className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Data Agendada</label>
                <input 
                  type="date" 
                  name="date" 
                  required 
                  className="w-full border border-gray-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <Link href="/obras" className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">Cancelar</Link>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-md">
                  Agendar OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quadro de Obras</h1>
          <p className="text-gray-500 mt-1">Gerencie o andamento e a agenda diária de serviços.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* FILTRO DE AGENDA */}
          <form method="GET" className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            <span className="text-sm font-bold text-gray-500 pl-2">📅 Agenda:</span>
            <input 
              type="date" 
              name="data" 
              defaultValue={filtroData} 
              className="border-none text-sm outline-none bg-transparent cursor-pointer font-medium text-gray-700 focus:ring-0" 
            />
            <button type="submit" className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded text-sm font-bold hover:bg-blue-100 transition">
              Filtrar
            </button>
            {filtroData && (
              <Link href="/obras" className="px-2 text-xs text-red-500 hover:underline font-bold">
                Limpar
              </Link>
            )}
          </form>

          <Link href="/obras?nova=true" className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition shadow-sm flex items-center gap-2">
            <span>+</span> Nova Obra
          </Link>
        </div>
      </header>

      {/* KANBAN BOARD */}
      <div className="flex gap-6 overflow-x-auto pb-4 h-full items-start">
        
        {/* COLUNA: AGENDADO */}
        <div className="bg-gray-100/80 rounded-xl p-4 w-80 shrink-0 flex flex-col max-h-full border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-gray-700 uppercase text-sm tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
              Agendado
            </h2>
            <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{agendadas.length}</span>
          </div>
          <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {agendadas.map(obra => <ObraCard key={obra.id} obra={obra} />)}
            {agendadas.length === 0 && <p className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">Livre nesta data.</p>}
          </div>
        </div>

        {/* COLUNA: EM ANDAMENTO */}
        <div className="bg-blue-50/50 rounded-xl p-4 w-80 shrink-0 flex flex-col max-h-full border border-blue-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-blue-800 uppercase text-sm tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Em Andamento
            </h2>
            <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">{emAndamento.length}</span>
          </div>
          <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {emAndamento.map(obra => <ObraCard key={obra.id} obra={obra} />)}
            {emAndamento.length === 0 && <p className="text-sm text-blue-300 text-center py-6 border-2 border-dashed border-blue-100 rounded-lg">Nada em andamento.</p>}
          </div>
        </div>

        {/* COLUNA: CONCLUÍDO */}
        <div className="bg-green-50/50 rounded-xl p-4 w-80 shrink-0 flex flex-col max-h-full border border-green-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-green-800 uppercase text-sm tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Concluído
            </h2>
            <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">{concluidas.length}</span>
          </div>
          <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {concluidas.map(obra => <ObraCard key={obra.id} obra={obra} />)}
            {concluidas.length === 0 && <p className="text-sm text-green-300 text-center py-6 border-2 border-dashed border-green-100 rounded-lg">Nenhuma obra finalizada.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}