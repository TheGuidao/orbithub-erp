// src/app/materiais/rma/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export default async function RmaPage(props: { searchParams: Promise<{ busca?: string }> }) {
  const searchParams = await props.searchParams;
  const busca = searchParams?.busca || '';

  // Busca os RMA's filtrando pelo nome do equipamento (ignorando maiúsculas/minúsculas)
  const rmas = await prisma.rmaEquipment.findMany({
    where: busca ? { equipmentName: { contains: busca, mode: 'insensitive' } } : {},
    orderBy: { createdAt: 'desc' }
  });

  // Puxa o catálogo de equipamentos (Tudo) para o Datalist
  const estoque = await prisma.material.findMany({
    where: { currentStock: { gt: 0 } },
    orderBy: { name: 'asc' }
  });

  // --- SERVER ACTIONS DE RMA ---

  async function registrarRma(formData: FormData) {
    "use server";
    const materialIdString = formData.get("materialId") as string; // Input pesquisável
    const externalName = formData.get("externalName") as string;   // Input de cliente antigo
    const serialNumber = formData.get("serialNumber") as string;
    const problemDetected = formData.get("problemDetected") as string;

    // A mágica do Datalist: o valor que vem no formData será algo como: "123 - Roteador X"
    // Nós quebramos a string no "-" para pegar só o ID.
    const hasInternalMaterial = materialIdString && materialIdString.includes(" - ");
    
    if (hasInternalMaterial) {
      const extractedId = parseInt(materialIdString.split(" - ")[0]);
      
      if (!isNaN(extractedId)) {
        const material = await prisma.material.findUnique({ where: { id: extractedId } });
        
        if (material) {
          // 1. Cria o registro de RMA
          await prisma.rmaEquipment.create({
            data: {
              equipmentName: material.name,
              serialNumber,
              problemDetected,
              isFromStock: true,
              materialId: material.id,
            }
          });
          
          // 2. Subtrai 1 do estoque principal
          await prisma.material.update({
            where: { id: material.id },
            data: { currentStock: material.currentStock - 1 }
          });

          // 3. Registra a transação de saída
          await prisma.transaction.create({
            data: {
              materialId: material.id,
              type: 'SAIDA',
              quantity: 1,
              notes: `Enviado para Manutenção/Garantia (RMA). SN: ${serialNumber}`
            }
          });
        }
      }
    } else if (externalName) {
      // Se não preencheu o campo interno, cai aqui pro Externo
      await prisma.rmaEquipment.create({
        data: {
          equipmentName: externalName,
          serialNumber,
          problemDetected,
          isFromStock: false,
        }
      });
    }

    revalidatePath("/materiais/rma");
    revalidatePath("/materiais");
    revalidatePath("/");
  }

  async function resolverRma(formData: FormData) {
    "use server";
    const rmaId = parseInt(formData.get("rmaId") as string);
    const acao = formData.get("acao") as string; // "RESOLVIDO" ou "DESCARTADO"

    const rma = await prisma.rmaEquipment.findUnique({ where: { id: rmaId } });
    if (!rma) return;

    // Atualiza o status do RMA
    await prisma.rmaEquipment.update({
      where: { id: rmaId },
      data: { status: acao }
    });

    // Se a ação foi RESOLVIDO e o equipamento era do nosso estoque, devolve para o catálogo!
    if (acao === "RESOLVIDO" && rma.isFromStock && rma.materialId) {
      const material = await prisma.material.findUnique({ where: { id: rma.materialId } });
      if (material) {
        await prisma.material.update({
          where: { id: rma.materialId },
          data: { currentStock: material.currentStock + 1 }
        });
        await prisma.transaction.create({
          data: {
            materialId: rma.materialId,
            type: 'ENTRADA',
            quantity: 1,
            notes: `Retorno de Manutenção/Garantia Resolvido. SN: ${rma.serialNumber || 'N/A'}`
          }
        });
      }
    }
    
    revalidatePath("/materiais/rma");
    revalidatePath("/materiais");
    revalidatePath("/");
  }

  return (
    <div>
      {/* DATALIST - Fica invisível, serve só como base de dados para o input inteligente */}
      <datalist id="lista-estoque">
        {estoque.map(m => (
          <option key={m.id} value={`${m.id} - ${m.name} ${m.brand ? `[${m.brand}]` : ''}`} />
        ))}
      </datalist>

      {/* FORMULÁRIO DE NOVO RMA */}
      <form action={registrarRma} className="bg-red-50/50 p-6 rounded-xl shadow-sm border border-red-200 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🛠️</span>
          <h2 className="text-xl font-bold text-red-900">Registrar Equipamento com Defeito</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          {/* OPÇÃO 1: Do nosso estoque (AGORA COM BUSCA INTELIGENTE) */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <label className="block text-xs font-bold text-blue-700 uppercase mb-2">1. Veio do nosso estoque?</label>
            <input 
              list="lista-estoque" 
              name="materialId" 
              placeholder="Digite para pesquisar no estoque..." 
              className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-gray-500 mt-1">Selecione na lista para subtrair 1 unidade do estoque automaticamente.</p>
          </div>

          {/* OPÇÃO 2: Externo */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">OU 2. Digite o Nome (Se for Externo)</label>
            <input type="text" name="externalName" placeholder="Ex: Central Antiga do Cliente João" className="w-full border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[10px] text-gray-500 mt-1">Use apenas se o item não fizer parte do seu catálogo atual de estoque.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Nº de Série (Opcional)</label>
            <input type="text" name="serialNumber" placeholder="S/N..." className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="md:col-span-2 flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Problema Detectado</label>
              <input type="text" name="problemDetected" required placeholder="Descreva o defeito do aparelho..." className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <button type="submit" className="bg-red-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-red-700 transition shadow">
              Registrar RMA
            </button>
          </div>
        </div>
      </form>

      {/* BARRA DE PESQUISA */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 flex gap-4">
        <form method="GET" className="flex flex-1 gap-4">
          <input type="text" name="busca" defaultValue={busca} placeholder="Pesquisar RMA por nome do equipamento..." className="flex-1 border border-gray-300 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">Pesquisar</button>
          {busca && <a href="/materiais/rma" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 flex items-center">Limpar</a>}
        </form>
      </div>

      {/* LISTA DE EQUIPAMENTOS EM RMA */}
      <div className="grid grid-cols-1 gap-4">
        {rmas.length === 0 ? (
          <div className="bg-white p-10 rounded-xl border border-gray-200 text-center text-gray-500">
            Nenhum equipamento registrado em manutenção.
          </div>
        ) : (
          rmas.map(rma => (
            <div key={rma.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-bold text-gray-900 text-lg">{rma.equipmentName}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    rma.status === 'EM_ANALISE' ? 'bg-yellow-100 text-yellow-700' : 
                    rma.status === 'RESOLVIDO' ? 'bg-green-100 text-green-700' : 
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {rma.status.replace('_', ' ')}
                  </span>
                  {rma.isFromStock && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded" title="Equipamento abatido do nosso estoque">📦 Do Estoque</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 mt-2">
                  <p><span className="font-semibold text-gray-400">S/N:</span> {rma.serialNumber || 'Não informado'}</p>
                  <p><span className="font-semibold text-gray-400">Data:</span> {new Date(rma.createdAt).toLocaleDateString('pt-BR')}</p>
                  <p className="sm:col-span-2"><span className="font-semibold text-gray-400">Defeito:</span> <span className="text-red-600">{rma.problemDetected}</span></p>
                </div>
              </div>
              
              {/* BOTÕES DE AÇÃO (SÓ APARECEM SE ESTIVER EM ANÁLISE) */}
              {rma.status === 'EM_ANALISE' && (
                <div className="flex gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 w-full md:w-auto">
                  <form action={resolverRma} className="flex-1 md:flex-none">
                    <input type="hidden" name="rmaId" value={rma.id} />
                    <input type="hidden" name="acao" value="RESOLVIDO" />
                    <button type="submit" className="w-full bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-4 py-2 rounded-lg text-sm font-bold transition">
                      ✓ Resolvido
                    </button>
                  </form>
                  <form action={resolverRma} className="flex-1 md:flex-none">
                    <input type="hidden" name="rmaId" value={rma.id} />
                    <input type="hidden" name="acao" value="DESCARTADO" />
                    <button type="submit" className="w-full bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-bold transition" title="Marcar como lixo/sucata">
                      🗑️ Descartar
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}