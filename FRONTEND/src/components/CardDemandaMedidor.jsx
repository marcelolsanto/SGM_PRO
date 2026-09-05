export default function CardDemandaMedidor({ os, formatarMoeda, aceitarDemanda, recusarDemanda, refId }) {
  const totalM2 = os.ambientes?.reduce((acc, a) => acc + a.area_estimada_m2, 0) || 0;
  
  const isPago = os.status_pagamento === 'PAGO';
  const isAgendado = Boolean(os.data_agendada && os.hora_agendada) || Boolean(os.termos_aceitos);
  const isDirecionada = Boolean(os.medidor_id && os.medidor_id === refId);
  const isProntaParaAceitar = isPago && isAgendado;

  return (
    <div className={`bg-slate-900 p-5 rounded-3xl relative flex flex-col justify-between transition-all shadow-xl ${
      isProntaParaAceitar
        ? 'border-2 border-amber-400 animate-pulse shadow-amber-500/20 ring-2 ring-amber-400/40'
        : 'border border-slate-800 hover:border-slate-700'
    }`}>
      <div>
        {/* Status de Pagamento e Agendamento */}
        {isProntaParaAceitar ? (
          <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 rounded-xl mb-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">
              {isDirecionada ? '🎯 DIRECIONADA PARA VOCÊ • PAGA' : '⚡ PAGA PELO LOJISTA • PRONTA'}
            </span>
          </div>
        ) : (
          <div className="flex justify-between items-start mb-3">
            <span className={`text-[10px] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest ${
              isPago ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {isPago ? '⚡ PAGA (Aguardando Agenda)' : '⏳ Aguardando Pagamento'}
            </span>
            {os.urgencia && <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] px-2 py-1 rounded font-black uppercase tracking-widest">🚨 Urgência</span>}
          </div>
        )}
        
        <h2 className="text-xl font-black text-white truncate mb-1">{os.cliente_nome}</h2>
        <p className="text-slate-400 text-xs mb-4 flex items-start gap-1">
          <span className="mt-0.5">📍</span> 
          <span className="line-clamp-2">{os.endereco_obra}</span>
        </p>

        {/* Informação de Data e Hora Agendada pelo Cliente */}
        {os.data_agendada ? (
          <div className="bg-blue-950/60 border border-blue-500/30 p-2.5 rounded-xl mb-4 text-xs flex justify-between items-center">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span>📅</span> Agendado pelo cliente:
            </span>
            <span className="font-mono font-black text-blue-300 text-sm">
              {os.data_agendada} às {os.hora_agendada}
            </span>
          </div>
        ) : (
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 mb-4 text-xs flex items-center gap-2 text-slate-400">
            <span>⏳</span>
            <span>Cliente ainda não selecionou data no Magic Link</span>
          </div>
        )}

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

          <a 
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(os.endereco_obra)}`} 
            target="_blank" 
            rel="noreferrer" 
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-blue-400 py-2.5 rounded-xl text-xs font-bold transition-colors"
          >
            🗺️ Rota no Google Maps
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
      
      {/* Botões de Ação Condicionais */}
      {!isPago ? (
        <div className="w-full bg-slate-950 text-slate-500 border border-slate-800 font-bold py-3.5 rounded-xl text-xs text-center">
          🔒 AGUARDANDO PAGAMENTO DA LOJA
        </div>
      ) : !isAgendado ? (
        <div className="w-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold py-3.5 rounded-xl text-xs text-center">
          ⏳ AGUARDANDO AGENDAMENTO DO CLIENTE
        </div>
      ) : isDirecionada ? (
        <div className="flex gap-2">
          <button 
            onClick={() => aceitarDemanda(os.id)} 
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3.5 rounded-xl shadow-lg transition-transform hover:scale-[1.02] text-xs uppercase tracking-wider"
          >
            ✅ Confirmar Medição
          </button>
          <button 
            onClick={() => recusarDemanda && recusarDemanda(os.id)} 
            className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 font-bold px-3 py-3.5 rounded-xl text-xs transition-colors whitespace-nowrap"
            title="Recusar e Devolver ao Radar"
          >
            ❌ Recusar
          </button>
        </div>
      ) : (
        <button 
          onClick={() => aceitarDemanda(os.id)} 
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 text-sm tracking-wide"
        >
          ✋ ACEITAR MEDIÇÃO AGENDADA
        </button>
      )}
    </div>
  );
}