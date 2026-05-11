// src/app/obras/detalhes/[id]/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function DetalhesObraPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = parseInt(params.id);

  // 1. Busca os dados da Obra com TODAS as conexões
  const obra = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      team: true,
      vehicles: true,
      comments: { include: { user: true }, orderBy: { createdAt: 'desc' } },
      checklist: { orderBy: { id: 'asc' } },
      materials: { include: { material: true } },
      attachments: true,
    }
  });

  if (!obra) return <div className="p-10 text-center">Obra não encontrada.</div>;

  // 2. Busca dados para os seletores (Equipe, Veículos, Materiais)
  const [todosUsuarios, todosVeiculos, todosMateriais] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany({ orderBy: { model: 'asc' } }),
    prisma.material.findMany({ orderBy: { name: 'asc' } }),
  ]);

  // --- SERVER ACTIONS (Ações do Card) ---

  async function atualizarStatus(formData: FormData) {
    "use server";
    const status = formData.get("status") as string;
    await prisma.serviceOrder.update({ where: { id }, data: { status } });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function salvarDetalhesBasicos(formData: FormData) {
    "use server";
    const description = formData.get("description") as string;
    const address = formData.get("address") as string;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;

    await prisma.serviceOrder.update({
      where: { id },
      data: { description, address, startTime, endTime }
    });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function adicionarEquipe(formData: FormData) {
    "use server";
    const userId = parseInt(formData.get("userId") as string);
    await prisma.serviceOrder.update({
      where: { id },
      data: { team: { connect: { id: userId } } }
    });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function adicionarVeiculo(formData: FormData) {
    "use server";
    const vehicleId = parseInt(formData.get("vehicleId") as string);
    await prisma.serviceOrder.update({
      where: { id },
      data: { vehicles: { connect: { id: vehicleId } } }
    });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function adicionarMaterial(formData: FormData) {
    "use server";
    const materialId = parseInt(formData.get("materialId") as string);
    const quantity = parseInt(formData.get("quantity") as string);

    // 1. Registra na Obra
    await prisma.serviceOrderMaterial.create({
      data: { serviceOrderId: id, materialId, quantity }
    });

    // 2. BAIXA AUTOMÁTICA NO ESTOQUE E GERA TRANSAÇÃO
    const mat = await prisma.material.findUnique({ where: { id: materialId } });
    if (mat) {
      await prisma.material.update({
        where: { id: materialId },
        data: { currentStock: mat.currentStock - quantity }
      });

      await prisma.transaction.create({
        data: {
          materialId,
          type: 'SAIDA',
          quantity,
          notes: `Retirada automática para Obra: ${obra.title}`
        }
      });
    }

    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function adicionarTarefa(formData: FormData) {
    "use server";
    const task = formData.get("task") as string;
    await prisma.checklistItem.create({ data: { serviceOrderId: id, task } });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function alternarTarefa(formData: FormData) {
    "use server";
    const taskId = parseInt(formData.get("taskId") as string);
    const done = formData.get("done") === "true";
    await prisma.checklistItem.update({ where: { id: taskId }, data: { isDone: !done } });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function postarComentario(formData: FormData) {
    "use server";
    const content = formData.get("content") as string;
    // Por enquanto usamos o ID 1 como fallback, mas depois pegaremos o usuário logado
    await prisma.comment.create({ 
      data: { serviceOrderId: id, content, userId: 1 } 
    });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  // Links de GPS
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(obra.address || "")}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(obra.address || "")}`;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      {/* HEADER DO CARD */}
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <Link href="/obras" className="text-blue-600 font-bold flex items-center gap-2 hover:underline">
            ⇠ Voltar ao Quadro
          </Link>
          
          <div className="flex items-center gap-3">
            <form action={atualizarStatus}>
              <select 
                name="status" 
                defaultValue={obra.status}
                onChange={(e) => e.target.form?.requestSubmit()}
                className={`font-bold px-4 py-2 rounded-lg border-2 outline-none transition ${
                  obra.status === 'AGENDADO' ? 'bg-yellow-100 border-yellow-400 text-yellow-700' :
                  obra.status === 'EM_ANDAMENTO' ? 'bg-blue-100 border-blue-400 text-blue-700' :
                  'bg-green-100 border-green-400 text-green-700'
                }`}
              >
                <option value="AGENDADO">🟡 Agendado</option>
                <option value="EM_ANDAMENTO">🔵 Em Andamento</option>
                <option value="CONCLUIDO">🟢 Concluído</option>
              </select>
            </form>
            <button className="bg-white border border-gray-300 px-4 py-2 rounded-lg font-bold text-gray-700 hover:bg-gray-50">
              PDF / Exportar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA ESQUERDA: CONTEÚDO PRINCIPAL */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* TÍTULO E DESCRIÇÃO */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h1 className="text-3xl font-black text-gray-900 mb-4">{obra.title}</h1>
              <form action={salvarDetalhesBasicos} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Detalhes da Obra / O.S.</label>
                  <textarea 
                    name="description" 
                    defaultValue={obra.description || ""}
                    placeholder="O que será feito nesta obra?"
                    className="w-full mt-1 p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 h-32"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Endereço Completo</label>
                    <input 
                      name="address" 
                      defaultValue={obra.address || ""}
                      placeholder="Rua, Número, Cidade..."
                      className="w-full mt-1 p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {obra.address && (
                      <div className="flex gap-2 mt-2">
                        <a href={googleMapsUrl} target="_blank" className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Google Maps</a>
                        <a href={wazeUrl} target="_blank" className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Waze</a>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Início</label>
                      <input type="time" name="startTime" defaultValue={obra.startTime || ""} className="w-full mt-1 p-3 border border-gray-200 rounded-xl bg-gray-50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Fim</label>
                      <input type="time" name="endTime" defaultValue={obra.endTime || ""} className="w-full mt-1 p-3 border border-gray-200 rounded-xl bg-gray-50" />
                    </div>
                  </div>
                </div>
                <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-800 transition">Salvar Alterações</button>
              </form>
            </div>

            {/* CHECKLIST */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">☑ Checklist de Atividades</h2>
              <div className="space-y-2 mb-4">
                {obra.checklist.map(item => (
                  <form key={item.id} action={alternarTarefa} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg group">
                    <input type="hidden" name="taskId" value={item.id} />
                    <input type="hidden" name="done" value={String(item.isDone)} />
                    <button type="submit" className={`w-6 h-6 rounded border-2 flex items-center justify-center transition ${item.isDone ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                      {item.isDone && <span className="text-white text-xs">✓</span>}
                    </button>
                    <span className={`text-sm ${item.isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.task}</span>
                  </form>
                ))}
              </div>
              <form action={adicionarTarefa} className="flex gap-2">
                <input name="task" required placeholder="Nova tarefa..." className="flex-1 border p-2 rounded-lg text-sm bg-gray-50 outline-none" />
                <button type="submit" className="bg-gray-200 text-gray-700 px-4 rounded-lg font-bold text-sm">+</button>
              </form>
            </div>

            {/* COMENTÁRIOS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="font-bold text-gray-900 mb-4">💬 Comentários e Histórico</h2>
              <form action={postarComentario} className="mb-6">
                <textarea name="content" required placeholder="Escreva algo sobre o andamento..." className="w-full p-3 border rounded-xl bg-gray-50 text-sm outline-none mb-2" />
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md">Postar Comentário</button>
              </form>
              <div className="space-y-4">
                {obra.comments.map(c => (
                  <div key={c.id} className="border-l-4 border-gray-200 pl-4 py-1">
                    <p className="text-sm text-gray-800">{c.content}</p>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{c.user.name} • {new Date(c.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: SIDEBAR (RECURSOS) */}
          <div className="space-y-6">
            
            {/* EQUIPE */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">Equipe Alocada</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {obra.team.map(u => (
                  <span key={u.id} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">{u.name}</span>
                ))}
              </div>
              <form action={adicionarEquipe} className="flex gap-2">
                <select name="userId" className="flex-1 border p-2 rounded-lg text-xs bg-gray-50">
                  <option value="">+ Adicionar Técnico</option>
                  {todosUsuarios.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button type="submit" className="bg-slate-900 text-white px-3 rounded-lg font-bold text-sm">+</button>
              </form>
            </div>

            {/* VEÍCULO */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">Veículo da Obra</h2>
              <div className="mb-4">
                {obra.vehicles.map(v => (
                  <div key={v.id} className="bg-gray-100 p-2 rounded-lg text-xs font-bold text-gray-700 flex justify-between">
                    <span>🚗 {v.model}</span>
                    <span>{v.plate}</span>
                  </div>
                ))}
              </div>
              <form action={adicionarVeiculo} className="flex gap-2">
                <select name="vehicleId" className="flex-1 border p-2 rounded-lg text-xs bg-gray-50">
                  <option value="">Selecionar Veículo</option>
                  {todosVeiculos.map(v => <option key={v.id} value={v.id}>{v.model} ({v.plate})</option>)}
                </select>
                <button type="submit" className="bg-slate-900 text-white px-3 rounded-lg font-bold text-sm">✓</button>
              </form>
            </div>

            {/* MATERIAIS SEPARADOS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">Materiais / Equipamentos</h2>
              <div className="space-y-2 mb-4">
                {obra.materials.map(m => (
                  <div key={m.id} className="flex justify-between text-xs border-b pb-1">
                    <span className="text-gray-700 font-medium">{m.material.name}</span>
                    <span className="font-bold text-blue-600">{m.quantity}x</span>
                  </div>
                ))}
              </div>
              <form action={adicionarMaterial} className="space-y-2">
                <select name="materialId" required className="w-full border p-2 rounded-lg text-xs bg-gray-50">
                  <option value="">Buscar Material...</option>
                  {todosMateriais.map(m => <option key={m.id} value={m.id}>{m.name} (Saldo: {m.currentStock})</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="number" name="quantity" required placeholder="Qtd" className="w-20 border p-2 rounded-lg text-xs bg-gray-50" />
                  <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition">Baixar do Estoque</button>
                </div>
              </form>
            </div>

            {/* ASSINATURA DO CLIENTE (Placeholder por enquanto) */}
            <div className="bg-slate-900 p-5 rounded-2xl shadow-lg text-white">
              <h2 className="text-sm font-bold text-slate-400 uppercase mb-3">Assinatura de Entrega</h2>
              <div className="bg-slate-800 h-32 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500 text-center p-4">
                A tela de assinatura será ativada ao clicar em "Concluir Obra" na próxima fase.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}