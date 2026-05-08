export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
      <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-orange-600 mb-4"></div>
      <p className="text-gray-500 font-medium animate-pulse">Carregando dados...</p>
    </div>
  );
}