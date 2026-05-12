// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link"; // <-- Importamos o Link para a rota de fuga
import MenuNavegacao from "./components/MenuNavegacao"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = { title: "Smart Touch", description: "Gestão Smart Touch" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const nomeUsuario = cookieStore.get("usuario_nome")?.value;
  const roleUsuario = cookieStore.get("usuario_role")?.value; 

  // LÓGICA DE FUGA: Define para onde o logo vai apontar dependendo de quem logou
  const linkHome = roleUsuario === "INTERNO" ? "/" : "/obras";

  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-slate-50 min-h-screen flex flex-col`}>
        {nomeUsuario && (
          <nav className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
              
              {/* O LOGO AGORA É UM BOTÃO CLICÁVEL! */}
              <Link href={linkHome} className="font-bold text-xl tracking-tight shrink-0 hover:scale-105 transition-transform cursor-pointer">
                Smart <span className="text-blue-500">Touch</span>
              </Link>
              
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
                {/* Aqui entra o componente que muda de cor sozinho */}
                <MenuNavegacao roleUsuario={roleUsuario} nomeUsuario={nomeUsuario} />
              </div>

              <div className="flex items-center gap-4 text-sm shrink-0">
                <span className="text-gray-300">Olá, <strong className="text-white">{nomeUsuario}</strong></span>
                <form action={async () => { 
                  "use server"; 
                  const c = await cookies(); 
                  c.delete("usuario_id"); c.delete("usuario_nome"); c.delete("usuario_role");
                  redirect("/login"); 
                }}>
                  <button type="submit" className="bg-red-900/50 hover:bg-red-800 text-red-200 px-3 py-1 rounded transition border border-red-700/50">Sair</button>
                </form>
              </div>
            </div>
          </nav>
        )}
        <main className="flex-1 max-w-7xl mx-auto w-full">{children}</main>
      </body>
    </html>
  );
}