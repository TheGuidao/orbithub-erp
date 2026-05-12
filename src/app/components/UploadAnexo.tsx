// src/app/components/UploadAnexo.tsx
"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Conecta o sistema com o seu Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function UploadAnexo({ obraId, salvarNoBanco }: { obraId: number, salvarNoBanco: (nome: string, url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      // Cria um nome único para o arquivo não dar conflito (Ex: 12-892374.pdf)
      const fileExt = file.name.split('.').pop();
      const fileName = `${obraId}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // 1. Envia o arquivo pesadão para o Supabase Storage (no balde 'obras-anexos')
      const { error: uploadError } = await supabase.storage
        .from('obras-anexos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Pega o link público de onde a foto ficou guardada na nuvem
      const { data } = supabase.storage.from('obras-anexos').getPublicUrl(fileName);

      // 3. Manda só o Link e o Nome do arquivo para o nosso Banco de Dados de Texto
      salvarNoBanco(file.name, data.publicUrl);
      
    } catch (error: any) {
      alert("Erro ao fazer upload. Verifique se o bucket 'obras-anexos' existe e é público.");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">📁 Adicionar Anexo (Fotos/Projetos)</label>
      <input 
        type="file" 
        onChange={handleFileChange}
        disabled={uploading}
        className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
      />
      {uploading && <p className="text-xs text-blue-500 mt-2 font-bold animate-pulse">Enviando arquivo para a nuvem...</p>}
    </div>
  );
}