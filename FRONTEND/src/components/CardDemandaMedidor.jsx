export default function CardDemandaMedidor({ os, formatarMoeda, aceitarDemanda }) {
  const totalM2 = os.ambientes?.reduce((acc, a) => acc + a.area_estimada_m2, 0) || 0;
  
  return (
    <div className="bg-slate-900 border border-amber-500/30 p-5 rounded-3xl relative flex flex-col justify-between hover:border-amber-500/60 transition-all shadow-xl hover:shadow-amber-900/20">
      <div>
        <div className="flex justify-between items-start mb-3">
          <span className="text-[10px] bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest">Nova Demanda</span>
          {os.urgencia && <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest">🚨 Urgência</span>}
        </div>
        
        <h2 className="text-xl font-black text-white truncate mb-1">{os.cliente_nome}</h2>
        <p className="text-slate-400 text-xs mb-4 flex items-start gap-1">
          <span className="mt-0.5">📍</span> 
          <span className="line-clamp-2">{os.endereco_obra}</span>
        </p>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4">
          <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-2">📦 {os.ambientes?.length || 0} Ambientes</p>
            <span className="text-xs font-mono text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded">{totalM2.toFixed(1)} m² totais</span>
          </div>
          
          <ul className="space-y-2 mb-4 max-h-28 overflow-y-auto custom-scrollbar pr-2">
            {os.ambientes?.map((amb, idx) => (
              <li key={idx} className="flex justify-between items-center text-xs bg-slate-900 p-2 rounded-xl border border-slate-800/50">
                <span className="text-slate-300 font-medium truncate">🛋️ {amb.nome}</span>
                <span className="text-slate-500 font-mono">{amb.area_estimada_m2}m²</span>
              </li>
            ))}
          </ul>

          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(os.endereco_obra)}`} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-blue-400 py-3 rounded-xl text-xs font-bold transition-colors">
            🗺️ Ver distância e rota no Maps
          </a>
        </div>

        <div className="mb-5 px-1">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Ganhos de Repasse</p>
              <p className="text-3xl font-black text-emerald-400">{formatarMoeda(os.custo_medidor)}</p>
            </div>
            {os.km_deslocamento > 0 && (
              <div className="text-right">
                <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg font-mono font-bold block">
                  🚗 {os.km_deslocamento} km • {os.tempo_deslocamento_min} min
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">Ida e Volta</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <button onClick={() => aceitarDemanda(os.id)} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 text-sm tracking-wide">
        ✋ ACEITAR MEDIÇÃO
      </button>
    </div>
  );
}