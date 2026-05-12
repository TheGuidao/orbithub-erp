// src/app/obras/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

export default async function ObrasPage(props: { searchParams: Promise<{ nova?: string, data?: string, todos?: string }> }) {
  const searchParams = await props.searchParams;
  const showNovaObra = searchParams?.nova === 'true';
  const verTodos = searchParams?.todos === 'true';
  
  // Pega a data de hoje ajustada para o fuso horário do Brasil (-3h)
  const dataAtual = new Date(new Date().getTime() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Lógica inteligente: Se clicou em "Ver Todos", fica vazio. Se filtrou uma data, usa ela. Senão, mostra HOJE.
  const paramData = searchParams?.data;
  let filtroData = "";
  if (paramData) {
    filtroData = paramData;
  } else if (!verTodos) {
    filtroData = dataAtual;
  }

  // Busca as obras no banco ordenadas pela data mais próxima
  let obras = await prisma.serviceOrder.findMany({
    include: { team: true },
    orderBy: { date: 'asc' }
  });

  // Aplica o filtro de Data (Agenda) se houver
  if (filtroData) {
    obras = obras.filter(o => {
      if (!o.date) return false;
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
    redirect("/obras"); 
  }

  // SERVER ACTION: Excluir Obra e Anexos
  async function deletarObra(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);

    // 1. Pega os anexos da obra antes de apagar o card
    const obra = await prisma.serviceOrder.findUnique({
      where: { id },
      include: { attachments: true }
    });

    // 2. Se tiver arquivos, vai no Supabase e apaga o peso morto primeiro
    if (obra && obra.attachments.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Descobre o nome exato do arquivo lá no balde cortando o final da URL
      const arquivosParaApagar = obra.attachments.map(a => {
        const partes = a.fileUrl.split('/');
        return partes[partes.length - 1]; 
      });

      // Comando de detonação no Supabase Storage
      await supabase.storage.from('obras-anexos').remove(arquivosParaApagar);
    }

    // 3. Agora sim, apaga o card e todo o texto do banco de dados de uma vez
    await prisma.serviceOrder.delete({ where: { id } });
    revalidatePath("/obras");
  }

  // Componente visual do Card
  const ObraCard = ({ obra }: { obra: any }) => {
    const dataFormatada = obra.date 
      ? new Date(obra.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) 
      : "Sem data";

    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-3 group hover:shadow-md transition flex flex-col">
        <div className="mb-2">
          {/* Título sem a #id agora */}
          <h3 className="font-bold text-gray-900 leading-tight">{obra.title}</h3>
        </div>
        
        <div className="mb-2">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 flex inline-flex items-center gap-1">
            📅 {dataFormatada}
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-3 line-clamp-2 flex-1">
          {obra.description || "Sem detalhes adicionais ainda..."}
        </p>
        
        <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-auto">
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
                  defaultValue={dataAtual} // Já vem preenchido com a data de hoje ao abrir
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
        
        <div className="flex flex-wrap items-center gap-4">
          {/* FILTRO DE AGENDA MELHORADO */}
          <form method="GET" className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-600">📅 Agenda:</span>
            <input 
              type="date" 
              name="data" 
              defaultValue={filtroData} 
              className="border border-gray-300 bg-white p-2 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-[140px]" 
            />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">
              Ir
            </button>
            {!verTodos && (
              <Link href="/obras?todos=true" className="px-3 text-xs text-blue-600 hover:text-blue-800 font-bold bg-blue-50 py-2 rounded-lg border border-blue-100 transition">
                Ver Todos os Dias
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