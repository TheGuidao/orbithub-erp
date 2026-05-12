// src/app/obras/detalhes/[id]/page.tsx
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import AssinaturaCard from "../../../components/AssinaturaCard";
import UploadAnexo from "../../../components/UploadAnexo"; // IMPORTAÇÃO DO NOVO COMPONENTE

const prisma = new PrismaClient();

export default async function DetalhesObraPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = parseInt(params.id);

  const obra = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      team: true,
      vehicles: true,
      comments: { include: { user: true }, orderBy: { createdAt: 'desc' } },
      checklist: { orderBy: { id: 'asc' } },
      materials: { include: { material: true } },
      attachments: true, // Garante que estamos buscando os anexos do banco
    }
  });

  if (!obra) return <div className="p-10 text-center font-bold text-red-500">Obra não encontrada.</div>;

  const [todosUsuarios, todosVeiculos, todosMateriais] = await Promise.all([
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.vehicle.findMany({ orderBy: { model: 'asc' } }),
    prisma.material.findMany({ orderBy: { name: 'asc' } }),
  ]);

  // --- SERVER ACTIONS ---

  async function atualizarStatus(formData: FormData) {
    "use server";
    const status = formData.get("status") as string;
    await prisma.serviceOrder.update({ where: { id }, data: { status } });
    revalidatePath(`/obras/detalhes/${id}`);
    revalidatePath(`/obras`);
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
    revalidatePath(`/obras`);
  }

  async function adicionarEquipe(formData: FormData) {
    "use server";
    const userIdString = formData.get("userId") as string;
    if (!userIdString) return;
    await prisma.serviceOrder.update({
      where: { id },
      data: { team: { connect: { id: parseInt(userIdString) } } }
    });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function adicionarVeiculo(formData: FormData) {
    "use server";
    const vehicleIdString = formData.get("vehicleId") as string;
    if (!vehicleIdString) return;
    await prisma.serviceOrder.update({
      where: { id },
      data: { vehicles: { connect: { id: parseInt(vehicleIdString) } } }
    });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function adicionarMaterial(formData: FormData) {
    "use server";
    const materialIdString = formData.get("materialId") as string;
    const quantityString = formData.get("quantity") as string;
    
    if (!materialIdString || !quantityString) return;
    
    const materialId = parseInt(materialIdString);
    const quantity = parseInt(quantityString);

    await prisma.serviceOrderMaterial.create({
      data: { serviceOrderId: id, materialId, quantity }
    });

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
          notes: `Retirada automática via OS #${id} (${obra.title})`
        }
      });
    }

    revalidatePath(`/obras/detalhes/${id}`);
    revalidatePath(`/materiais`);
    revalidatePath(`/movimentacoes`);
  }

  async function adicionarTarefa(formData: FormData) {
    "use server";
    const task = formData.get("task") as string;
    if (!task) return;
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
    if (!content) return;
    await prisma.comment.create({ 
      data: { serviceOrderId: id, content, userId: 1 } 
    });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  async function receberAssinatura(obraId: number, nome: string, cpf: string, assinaturaBase64: string) {
    "use server";
    await prisma.serviceOrder.update({
      where: { id: obraId },
      data: {
        clientName: nome,
        clientCpf: cpf,
        clientSignature: assinaturaBase64,
        status: 'CONCLUIDO' 
      }
    });
    revalidatePath(`/obras/detalhes/${id}`);
    revalidatePath(`/obras`);
  }

  // NOVA AÇÃO: Salvar Anexo no Banco após o Upload para o Supabase
  async function salvarAnexoBanco(nomeArquivo: string, urlArquivo: string) {
    "use server";
    await prisma.attachment.create({
      data: { fileName: nomeArquivo, fileUrl: urlArquivo, serviceOrderId: id }
    });
    revalidatePath(`/obras/detalhes/${id}`);
  }

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(obra.address || "")}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(obra.address || "")}`;

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-[calc(100vh-60px)]">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER DO CARD */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <Link href="/obras" className="text-slate-600 font-bold flex items-center gap-2 hover:text-blue-600 transition bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            ← Voltar ao Quadro
          </Link>
          
          <div className="flex flex-wrap items-center gap-3">
            <form action={atualizarStatus} className="flex items-center gap-2 bg-white p-1 rounded-lg shadow-sm border border-gray-200">
              <select 
                key={obra.status} 
                name="status" 
                defaultValue={obra.status}
                className={`font-bold px-3 py-1.5 rounded outline-none transition text-sm cursor-pointer ${
                  obra.status === 'AGENDADO' ? 'text-yellow-700 bg-yellow-50' :
                  obra.status === 'EM_ANDAMENTO' ? 'text-blue-700 bg-blue-50' :
                  'text-green-700 bg-green-50'
                }`}
              >
                <option value="AGENDADO">🟡 Agendado</option>
                <option value="EM_ANDAMENTO">🔵 Em Andamento</option>
                <option value="CONCLUIDO">🟢 Concluído</option>
              </select>
              <button type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-slate-800 transition">
                Atualizar
              </button>
            </form>

            <Link href={`/obras/imprimir/${obra.id}`} className="bg-white border border-gray-300 shadow-sm px-4 py-2 rounded-lg font-bold text-gray-700 hover:bg-gray-50 text-sm">
              📄 Exportar PDF
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA ESQUERDA: CONTEÚDO PRINCIPAL */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h1 className="text-3xl font-black text-gray-900 mb-6">{obra.title}</h1>
              <form action={salvarDetalhesBasicos} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase">Detalhes da Obra / O.S.</label>
                  <textarea 
                    name="description" 
                    defaultValue={obra.description || ""}
                    placeholder="Descreva o que será feito nesta obra..."
                    className="w-full mt-1 p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 h-28 text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Endereço Completo</label>
                    <input 
                      name="address" 
                      defaultValue={obra.address || ""}
                      placeholder="Rua, Número, Cidade..."
                      className="w-full mt-1 p-3 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {obra.address && (
                      <div className="flex gap-2 mt-2">
                        <a href={googleMapsUrl} target="_blank" className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-200">📍 Google Maps</a>
                        <a href={wazeUrl} target="_blank" className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">🚙 Waze</a>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Início</label>
                      <input type="time" name="startTime" defaultValue={obra.startTime || ""} className="w-full block mt-1 p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm cursor-pointer outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase">Fim</label>
                      <input type="time" name="endTime" defaultValue={obra.endTime || ""} className="w-full block mt-1 p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm cursor-pointer outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button type="submit" className="bg-slate-900 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition">Salvar Dados</button>
                </div>
              </form>
            </div>

            {/* CHECKLIST */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">☑ Checklist de Atividades</h2>
              <div className="space-y-1 mb-4">
                {obra.checklist.map(item => (
                  <form key={item.id} action={alternarTarefa} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition group">
                    <input type="hidden" name="taskId" value={item.id} />
                    <input type="hidden" name="done" value={String(item.isDone)} />
                    <button type="submit" className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${item.isDone ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-blue-400'}`}>
                      {item.isDone && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                    <span className={`text-sm ${item.isDone ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>{item.task}</span>
                  </form>
                ))}
                {obra.checklist.length === 0 && <p className="text-xs text-gray-400 italic p-2">Nenhuma tarefa criada.</p>}
              </div>
              <form action={adicionarTarefa} className="flex gap-2">
                <input name="task" required placeholder="Nova tarefa..." className="flex-1 border border-gray-200 p-2 rounded-lg text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="submit" className="bg-slate-900 text-white px-4 rounded-lg font-bold text-sm hover:bg-slate-800">Adicionar</button>
              </form>
            </div>

            {/* ANEXOS DA OBRA */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
              <h2 className="font-bold text-gray-900 mb-4">📎 Projetos e Arquivos</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {obra.attachments.map(arq => (
                  <a key={arq.id} href={arq.fileUrl} target="_blank" rel="noopener noreferrer" className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-center hover:shadow-md hover:border-blue-300 transition group flex flex-col justify-center items-center h-24">
                    <div className="text-3xl mb-1 group-hover:scale-110 transition">📄</div>
                    <p className="text-[10px] font-bold text-gray-600 truncate w-full px-1">{arq.fileName}</p>
                  </a>
                ))}
                {obra.attachments.length === 0 && <p className="text-xs text-gray-400 italic col-span-full">Nenhum arquivo anexado a esta obra.</p>}
              </div>

              <UploadAnexo obraId={obra.id} salvarNoBanco={salvarAnexoBanco} />
            </div>

            {/* COMENTÁRIOS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="font-bold text-gray-900 mb-4">💬 Histórico e Comentários</h2>
              <form action={postarComentario} className="mb-6 flex flex-col items-end">
                <textarea name="content" required placeholder="Escreva algo sobre o andamento da obra..." className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none mb-2 focus:ring-2 focus:ring-blue-500" />
                <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700">Postar Comentário</button>
              </form>
              <div className="space-y-4">
                {obra.comments.map(c => (
                  <div key={c.id} className="border-l-4 border-blue-400 bg-blue-50/30 pl-4 py-2 pr-2 rounded-r-lg">
                    <span className="text-[10px] text-gray-500 font-bold uppercase block mb-1">{c.user.name} • {new Date(c.createdAt).toLocaleString('pt-BR')}</span>
                    <p className="text-sm text-gray-800">{c.content}</p>
                  </div>
                ))}
                {obra.comments.length === 0 && <p className="text-xs text-gray-400 italic">Sem comentários registrados.</p>}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: SIDEBAR (RECURSOS) */}
          <div className="space-y-6">
            
            {/* EQUIPE */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">👷 Equipe Alocada</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {obra.team.map(u => (
                  <span key={u.id} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">{u.name}</span>
                ))}
                {obra.team.length === 0 && <span className="text-xs text-gray-400 italic">Nenhum técnico alocado.</span>}
              </div>
              <form action={adicionarEquipe} className="flex gap-2">
                <select name="userId" required className="flex-1 border border-gray-200 p-2 rounded-lg text-xs bg-gray-50 outline-none">
                  <option value="">+ Adicionar Técnico</option>
                  {todosUsuarios.filter(u => !obra.team.some(ot => ot.id === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button type="submit" className="bg-slate-900 text-white px-3 rounded-lg font-bold text-sm hover:bg-slate-800">✓</button>
              </form>
            </div>

            {/* VEÍCULO */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">🚙 Veículos</h2>
              <div className="space-y-2 mb-4">
                {obra.vehicles.map(v => (
                  <div key={v.id} className="bg-gray-50 border border-gray-100 p-2 rounded-lg text-xs font-bold text-gray-700 flex justify-between items-center">
                    <span>{v.model}</span>
                    <span className="bg-gray-200 px-2 py-0.5 rounded">{v.plate}</span>
                  </div>
                ))}
                {obra.vehicles.length === 0 && <span className="text-xs text-gray-400 italic">Nenhum veículo selecionado.</span>}
              </div>
              <form action={adicionarVeiculo} className="flex gap-2">
                <select name="vehicleId" required className="flex-1 border border-gray-200 p-2 rounded-lg text-xs bg-gray-50 outline-none">
                  <option value="">+ Adicionar Veículo</option>
                  {todosVeiculos.filter(v => !obra.vehicles.some(ov => ov.id === v.id)).map(v => (
                    <option key={v.id} value={v.id}>{v.model} ({v.plate})</option>
                  ))}
                </select>
                <button type="submit" className="bg-slate-900 text-white px-3 rounded-lg font-bold text-sm hover:bg-slate-800">✓</button>
              </form>
            </div>

            {/* MATERIAIS SEPARADOS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">📦 Materiais Separados</h2>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {obra.materials.map(m => (
                  <div key={m.id} className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                    <span className="text-gray-700 font-medium line-clamp-1">{m.material.name}</span>
                    <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded ml-2">{m.quantity}x</span>
                  </div>
                ))}
                {obra.materials.length === 0 && <span className="text-xs text-gray-400 italic">Nenhum material registrado.</span>}
              </div>
              <form action={adicionarMaterial} className="space-y-2 border-t pt-3">
                <select name="materialId" required className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-gray-50 outline-none">
                  <option value="">Buscar Material...</option>
                  {todosMateriais.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (Saldo: {m.currentStock})</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input type="number" name="quantity" required min="1" placeholder="Qtd" className="w-20 border border-gray-200 p-2 rounded-lg text-xs bg-gray-50 outline-none" />
                  <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition">Baixar Estoque</button>
                </div>
              </form>
            </div>

            {/* ASSINATURA E CONCLUSÃO AUTOMÁTICA */}
            <div className="bg-slate-900 p-5 rounded-2xl shadow-lg text-white">
              <h2 className="text-sm font-bold text-slate-400 uppercase mb-3">✍️ Assinatura de Entrega</h2>
              
              {obra.clientSignature ? (
                <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-xl">
                  <div className="flex items-center justify-between border-b border-green-500/30 pb-3 mb-3">
                    <div>
                      <p className="text-[10px] text-green-400 font-bold uppercase mb-1">Obra Concluída & Assinada</p>
                      <p className="text-sm font-medium text-white">{obra.clientName}</p>
                      {obra.clientCpf && <p className="text-[10px] text-slate-400">CPF: {obra.clientCpf}</p>}
                    </div>
                    <span className="text-2xl">✅</span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-2 flex justify-center">
                    <img src={obra.clientSignature} alt="Assinatura Cliente" className="h-16" />
                  </div>
                </div>
              ) : (
                <AssinaturaCard obraId={obra.id} salvarAssinatura={receberAssinatura} />
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}