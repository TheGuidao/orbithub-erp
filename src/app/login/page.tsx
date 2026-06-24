// src/app/login/page.tsx
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;
  const erro = searchParams?.error;

  async function fazerLogin(formData: FormData) {
    "use server";
    
    const loginInput = (formData.get("loginInput") as string).trim();
    const password = (formData.get("password") as string).trim();

    // Busca o usuário batendo o input com o Email OU com o Username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginInput },
          { username: loginInput }
        ],
        password: password,
        active: true 
      },
      include: { role: true }
    });

    if (!user) {
      redirect("/login?error=1");
    }

    const cookieStore = await cookies();
    cookieStore.set("usuario_id", String(user.id), { maxAge: 60 * 60 * 24 * 7, path: "/" });
    cookieStore.set("usuario_nome", user.name, { maxAge: 60 * 60 * 24 * 7, path: "/" });
    
    // --- LÓGICA DE MIGRAÇÃO SEGURA (FALLBACK) ---
    // Reconhece a sua conta antiga "admin" e força as permissões máximas para você não ficar trancado
    const isMaster = user.role?.permissions 
      ? (user.role.permissions as any).master 
      : (user.username === 'admin'); 
      
    cookieStore.set("usuario_role", isMaster ? "INTERNO" : "TECNICO", { maxAge: 60 * 60 * 24 * 7, path: "/" });
    
    if (user.role?.permissions) {
      cookieStore.set("usuario_permissions", JSON.stringify(user.role.permissions), { maxAge: 60 * 60 * 24 * 7, path: "/" });
    }

    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-1">
          Estoque <span className="text-blue-500">Nexar Hub</span>
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          Acesso restrito a colaboradores internos
        </p>

        {erro && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center mb-6 border border-red-100 font-medium">
            Usuário/Email ou senha incorretos.
          </div>
        )}

        <form action={fazerLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email ou Usuário</label>
            <input 
              type="text" 
              name="loginInput" 
              required 
              placeholder="seu@email.com ou seunome" 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Senha</label>
            <input 
              type="password" 
              name="password" 
              required 
              placeholder="••••••••" 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-slate-900 text-white font-bold rounded-lg p-3 mt-2 hover:bg-slate-800 transition-colors"
          >
            Entrar no Sistema
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Esqueceu sua senha? Solicite ao administrador.
        </p>
      </div>
    </div>
  );
}