// src/app/movimentacoes/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link"; 
import BotaoExportar from "../components/BotaoExportar";

const prisma = new PrismaClient();

export default async function MovimentacoesPage(props: { searchParams: Promise<{ error?: string, viewAssinatura?: string }> }) {
  const searchParams = await props.searchParams;
  const erroURL = searchParams?.error;
  const modalAssinaturaId = searchParams?.viewAssinatura ? parseInt(searchParams.viewAssinatura) : null;

  const materiais = await prisma.material.findMany({ orderBy: { name: 'asc' } });
  
  const equipe = await prisma.user.findMany({ 
    where: { active: true, username: { not: 'admin' } }, 
    orderBy: { name: 'asc' } 
  });

  const historico = await prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    include: { material: true, user: true },
    take: 1000 
  });

  let assinaturaModalData = null;
  if (modalAssinaturaId) {
    assinaturaModalData = await prisma.transaction.findUnique({ 
      where: { id: modalAssinaturaId }, 
      include: { user: true, material: true } 
    });
  }

  const dadosParaPlanilha = historico.map(h => ({
    "Data": new Date(h.createdAt).toLocaleString('pt-BR'),
    "Material": h.material.name,
    "Tipo de Movimento": h.type === 'SAIDA' ? 'Retirada' : (h.type === 'RETORNO' ? 'Devolução' : 'Compra (Entrada)'),
    "Quantidade": h.quantity,
    "Técnico / Responsável": h.user ? h.user.name : 'Geral / Compra',
    "Status da Assinatura": h.type === 'SAIDA' ? (h.assinatura ? 'Assinado' : 'Pendente') : 'N/A',
    "Observações": h.notes || ""
  }));

  async function registrarMovimentacao(formData: FormData) {
    "use server";
    
    // Extraindo o ID do material a partir do texto do Datalist
    const materialInput = formData.get("materialInput") as string;
    const idMatch = materialInput.match(/\[ID:\s*(\d+)\]/);
    
    if (!idMatch) {
      redirect("/movimentacoes?error=material_invalido");
    }
    const materialId = parseInt(idMatch[1]);

    const type = formData.get("type") as string;
    const quantity = parseInt(formData.get("quantity") as string);
    const userIdString = formData.get("userId") as string;
    const notes = formData.get("notes") as string;
    
    let userId = userIdString ? parseInt(userIdString) : null;

    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) return;

    if (type === 'SAIDA' || type === 'RETORNO') {
      if (!userId) redirect("/movimentacoes?error=sem_tecnico");
    }

    if (type === 'ENTRADA') {
      userId = null; 
    }

    if (type === 'SAIDA' && quantity > material.currentStock) {
      redirect("/movimentacoes?error=estoque_insuficiente");
    }

    if (type === 'RETORNO' && userId) {
      const retiradas = await prisma.transaction.aggregate({
        _sum: { quantity: true },
        where: { materialId, userId, type: 'SAIDA' }
      });
      const devolucoesAnteriores = await prisma.transaction.aggregate({
        _sum: { quantity: true },
        where: { materialId, userId, type: 'RETORNO' }
      });
      
      const pendenteNaMaoDoTecnico = (retiradas._sum.quantity || 0) - (devolucoesAnteriores._sum.quantity || 0);

      if (quantity > pendenteNaMaoDoTecnico) {
        redirect("/movimentacoes?error=devolucao_excedida");
      }
    }

    await prisma.transaction.create({
      data: { materialId, type, quantity, userId, notes }
    });

    const novoSaldo = (type === 'SAIDA') 
      ? material.currentStock - quantity 
      : material.currentStock + quantity; 
      
    await prisma.material.update({
      where: { id: materialId },
      data: { currentStock: novoSaldo }
    });

    revalidatePath("/movimentacoes");
    revalidatePath("/materiais");
    revalidatePath("/");
    redirect("/movimentacoes");
  }

  return (
    <div className="p-4 md:p-8 relative">

      {assinaturaModalData && assinaturaModalData.signatureData && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="font-bold text-xl text-gray-900 mb-1">Comprovante de Retirada</h3>
            <p className="text-sm text-gray-500 mb-4 flex justify-between border-b pb-4">
              <span>Técnico: {assinaturaModalData.user?.name}</span>
              <span className="font-bold">{assinaturaModalData.quantity}x {assinaturaModalData.material.name}</span>
            </p>
            <div className="border-2 border-gray-100 rounded-xl bg-gray-50 p-2 mb-6">
              <img src={assinaturaModalData.signatureData} alt="Assinatura do Técnico" className="w-full h-auto" />
            </div>
            <Link href="/movimentacoes" className="block text-center bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg font-bold transition">
              Fechar Janela
            </Link>
          </div>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Movimentações de Estoque</h1>
        <p className="text-gray-500 mt-1">Registre retiradas, devoluções e compras.</p>
      </header>

      {erroURL === "devolucao_excedida" && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-400 font-medium">
          ⚠️ O técnico não pode devolver uma quantidade maior do que ele tem pendente em mãos!
        </div>
      )}
      {erroURL === "sem_tecnico" && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-400 font-medium">
          ⚠️ Para Retiradas e Devoluções é obrigatório selecionar um técnico.
        </div>
      )}
      {erroURL === "estoque_insuficiente" && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-400 font-medium">
          ⚠️ <strong>Estoque Insuficiente!</strong> Você tentou retirar uma quantidade maior do que a disponível no estoque.
        </div>
      )}
      {erroURL === "material_invalido" && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6 border border-red-400 font-medium">
          ⚠️ <strong>Material Inválido!</strong> Por favor, selecione um material da lista suspensa.
        </div>
      )}

      <form action={registrarMovimentacao} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Nova Movimentação</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Buscar Material</label>
            <input 
              list="lista-materiais" 
              name="materialInput" 
              required 
              placeholder="Digite o nome do material..." 
              className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <datalist id="lista-materiais">
              {materiais.map(m => (
                <option key={m.id} value={`${m.name} (Estoque: ${m.currentStock}) [ID: ${m.id}]`} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Ação</label>
            <select name="type" required className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
              <option value="SAIDA">Retirada (Saída)</option>
              <option value="RETORNO">Devolução (Volta ao estoque)</option>
              <option value="ENTRADA">Compra (Abastecer estoque)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Quantidade</label>
            <input type="number" name="quantity" required min="1" placeholder="Qtd" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Técnico (Ignore se Compra)</label>
            <select name="userId" className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Nenhum</option>
              {equipe.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observações (Opcional)</label>
            <input type="text" name="notes" placeholder="Motivo da retirada, NF da compra, etc..." className="w-full border border-gray-300 p-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="w-full bg-slate-900 text-white font-bold p-2 rounded-lg mt-2 hover:bg-slate-800 transition">
            Registrar
          </button>
        </div>
      </form>

      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-6 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-lg font-bold text-gray-700">Histórico de Movimentações</h2>
        <BotaoExportar dados={dadosParaPlanilha} nomeArquivo="Relatorio_Estoque" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Data</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Material</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Ação</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500 uppercase">Qtd</th>
              <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {historico.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Nenhuma movimentação registrada.</td></tr>
            ) : (
              historico.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-500">{new Date(h.createdAt).toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{h.material.name}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                      h.type === 'SAIDA' ? 'bg-orange-100 text-orange-700' : 
                      h.type === 'RETORNO' ? 'bg-blue-100 text-blue-700' : 
                      'bg-green-100 text-green-700'
                    }`}>
                      {h.type === 'SAIDA' ? 'Retirada' : h.type === 'RETORNO' ? 'Devolução' : 'Compra'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-gray-900">{h.quantity}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      {h.user ? h.user.name : <span className="text-gray-400 italic">Geral / Compra</span>}
                      
                      {h.type === 'SAIDA' && h.user && (
                        h.assinatura ? (
                          <Link 
                            href={`/movimentacoes?viewAssinatura=${h.id}`} 
                            className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-green-100 text-green-700 hover:bg-green-200 transition cursor-pointer flex items-center gap-1"
                          >
                            ✅ Assinado (Ver)
                          </Link>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-yellow-100 text-yellow-700 border border-yellow-300">
                            ⏳ Pendente
                          </span>
                        )
                      )}
                    </div>
                    {h.notes && <p className="text-xs text-gray-400 mt-1 border-t pt-1 border-gray-100">{h.notes}</p>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}