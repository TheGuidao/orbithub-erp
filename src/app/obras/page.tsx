// src/app/obras/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function ObrasPage(props: { searchParams: Promise<{ nova?: string }> }) {
  const searchParams = await props.searchParams;
  const showNovaObra = searchParams?.nova === 'true';

  // Busca todas as obras no banco, incluindo a equipe alocada (para mostrar a fotinha/nome depois)
  const obras = await prisma.serviceOrder.findMany({
    include: { team: true },
    orderBy: { createdAt: 'desc' }
  });

  // Separa as obras por status para colocar nas colunas corretas
  const agendadas = obras.filter(o => o.status === 'AGENDADO');
  const emAndamento = obras.filter(o => o.status === 'EM_ANDAMENTO');
  const concluidas = obras.filter(o => o.status === 'CONCLUIDO');

  // Função para criar o Card (Apenas Título por enquanto)
  async function criarObra(formData: FormData) {
    "use server";
    const title = formData.get("title") as string;
    
    if (title) {
      await prisma.serviceOrder.create({
        data: { title, status: 'AGENDADO' }
      });
    }
    
    revalidatePath("/obras");
    redirect("/obras");
  }

  // Componente visual do Card (Para não repetirmos código nas 3 colunas)
  const ObraCard = ({ obra }: { obra: any }) => (
    <Link href={`/obras/detalhes/${obra.id}`} className="block bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition cursor-pointer mb-3 group">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition">{obra.title}</h3>
        <span className="text-xs font-bold text-gray-400">#{obra.id}</span>
      </div>
      <p className="text-xs text-gray-500 mb-3 line-clamp-2">
        {obra.description || "Clique para adicionar detalhes, equipe, materiais e endereço..."}
      </p>
      <div className="flex justify-between items-center border-t border-gray-100 pt-3">
        <div className="flex -space-x-2 overflow-hidden">
          {/* Aqui entrarão as bolinhas com as iniciais da equipe depois */}
          <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">?</div>
        </div>
        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded">
          Ver OS ➔
        </span>
      </div>
    </Link>
  );

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
              <div className="flex justify-end gap-3 mt-6">
                <Link href="/obras" className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">Cancelar</Link>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-md">
                  Criar Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quadro de Obras</h1>
          <p className="text-gray-500 mt-1">Gerencie o andamento dos serviços e automações.</p>
        </div>
        <Link href="/obras?nova=true" className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition shadow-sm flex items-center gap-2">
          <span>+</span> Nova Obra
        </Link>
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
            {agendadas.length === 0 && <p className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">Nenhuma obra agendada.</p>}
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
            {emAndamento.length === 0 && <p className="text-sm text-blue-300 text-center py-6 border-2 border-dashed border-blue-100 rounded-lg">Nenhuma obra em andamento.</p>}
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
            {concluidas.length === 0 && <p className="text-sm text-green-300 text-center py-6 border-2 border-dashed border-green-100 rounded-lg">Nenhuma obra concluída.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}