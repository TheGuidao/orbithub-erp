// src/app/pendencias/page.tsx
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import SignaturePad from "../components/SignaturePad";

const prisma = new PrismaClient();

export default async function PendenciasPage() {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get("usuario_id")?.value || "0");
  const userName = cookieStore.get("usuario_nome")?.value;

  const pendenciasMaterial = await prisma.transaction.findMany({
    where: { userId: userId, type: 'SAIDA', assinatura: false },
    include: { material: true }
  });

  const pendenciasVeiculo = await prisma.vehicleLog.findMany({
    where: { userId: userId, assinatura: false },
    include: { vehicle: true }
  });

  async function assinarMaterial(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);
    const signatureData = formData.get("signatureData") as string;
    await prisma.transaction.update({ where: { id }, data: { assinatura: true, signatureData } });
    revalidatePath("/pendencias");
  }

  async function assinarVeiculo(formData: FormData) {
    "use server";
    const id = parseInt(formData.get("id") as string);
    const signatureData = formData.get("signatureData") as string;
    await prisma.vehicleLog.update({ where: { id }, data: { assinatura: true, signatureData } });
    revalidatePath("/pendencias");
  }

  const totalPendencias = pendenciasMaterial.length + pendenciasVeiculo.length;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <header className="mb-8 text-center mt-6">
        <h1 className="text-3xl font-bold text-gray-900">Olá, {userName}</h1>
        <p className="text-gray-500 mt-2">
          {totalPendencias > 0 ? `Você possui ${totalPendencias} pendência(s) aguardando sua assinatura.` : 'Tudo certo! Você não tem pendências no momento.'}
        </p>
      </header>

      <div className="space-y-6">
        {pendenciasVeiculo.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
            <h2 className="text-orange-800 font-bold text-lg mb-4 flex items-center gap-2">🚗 Chaves de Veículos</h2>
            <div className="space-y-4">
              {pendenciasVeiculo.map(v => (
                <div key={v.id} className="bg-white p-5 rounded-lg shadow-sm border border-orange-100 flex flex-col gap-2">
                  <div className="border-b pb-3 mb-2">
                    <p className="font-bold text-gray-900 text-lg">{v.vehicle.model} ({v.vehicle.plate})</p>
                    <p className="text-sm text-gray-500 mt-1">Registrado saída dia {new Date(v.date).toLocaleDateString('pt-BR')} com {v.startKm} KM.</p>
                  </div>
                  <form action={assinarVeiculo}>
                    <input type="hidden" name="id" value={v.id} />
                    <SignaturePad />
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendenciasMaterial.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h2 className="text-blue-800 font-bold text-lg mb-4 flex items-center gap-2">📦 Retirada de Materiais</h2>
            <div className="space-y-4">
              {pendenciasMaterial.map(m => (
                <div key={m.id} className="bg-white p-5 rounded-lg shadow-sm border border-blue-100 flex flex-col gap-2">
                  <div className="border-b pb-3 mb-2">
                    <p className="font-bold text-gray-900 text-lg">{m.quantity}x {m.material.name}</p>
                    <p className="text-sm text-gray-500 mt-1">Registrado dia {new Date(m.createdAt).toLocaleDateString('pt-BR')} {m.notes ? `- Obs: ${m.notes}` : ''}</p>
                  </div>
                  <form action={assinarMaterial}>
                    <input type="hidden" name="id" value={m.id} />
                    <SignaturePad />
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalPendencias === 0 && (
          <div className="bg-green-50 border border-green-200 p-10 rounded-xl text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-green-800 font-bold text-lg">Parabéns pela organização!</h3>
            <p className="text-green-600 text-sm mt-1">Todos os materiais e veículos foram assinados.</p>
          </div>
        )}
      </div>
    </div>
  );
}