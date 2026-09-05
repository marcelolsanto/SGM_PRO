import { useState } from 'react'

export default function OsCard({ os, isActive, onView, onEdit, onDelete, medidores, onTransfer, formatarMoeda }) {
  // Estado isolado: Cada card agora tem sua própria memória para o dropdown
  const [medidorId, setMedidorId] = useState('')

  return (
    <div className={`bg-slate-900 border rounded-3xl p-5 md:p-6 shadow-xl hover:border-slate-700 transition-colors relative group ${isActive ? 'border-blue-500' : 'border-slate-800'}`}>
      
      {/* Botões de Ação */}
      <div className="absolute top-3 right-3 flex gap-1 z-10 bg-slate-900/90 rounded-lg p-1">
        <button onClick={() => onView(os)} className="bg-slate-800 hover:bg-emerald-600 text-white p-2 rounded-lg text-xs md:text-sm transition-colors" title="Ver">👁️</button>
        <button onClick={() => onEdit(os)} className="bg-slate-800 hover:bg-blue-600 text-white p-2 rounded-lg text-xs md:text-sm transition-colors" title="Editar">✏️</button>
        <button onClick={() => onDelete(os.id)} className="bg-slate-800 hover:bg-red-600 text-white p-2 rounded-lg text-xs md:text-sm transition-colors" title="Excluir">🗑️</button>
      </div>
      
      <div className="flex justify-between items-center mb-3 pr-24">
        <span className={`px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest ${os.status === 'EM_ROTA' ? 'bg-amber-500/10 text-amber-400' : os.status === 'CONCLUIDO' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'}`}>
          {os.status.replace('_', ' ')}
        </span>
        <span className="text-slate-600 font-mono text-[10px] md:text-xs">#00{os.id}</span>
      </div>

      <p className="text-blue-400 font-bold text-[10px] uppercase tracking-widest mb-1 truncate">🏢 {os.loja?.nome_fantasia || 'N/A'}</p>
      <h2 className="text-xl md:text-2xl font-black text-white mb-1 flex items-center gap-2 flex-wrap">
        <span className="truncate max-w-[80%]">{os.cliente_nome}</span>
        {os.urgencia && <span className="bg-red-500/20 text-red-400 text-[8px] md:text-[9px] px-2 py-1 rounded border border-red-500/30 uppercase tracking-widest flex-shrink-0 mt-1 sm:mt-0">🚨 Urgência</span>}
      </h2>
      <p className="text-slate-500 text-xs mb-4">
        {os.ambientes?.length || 0} Ambiente(s) • {os.medidor ? `👷 ${os.medidor.nome_completo}` : '⚠️ Sem Medidor'}
      </p>
      
      <div className="bg-slate-950/50 p-3 md:p-4 rounded-2xl mb-4 relative border border-slate-800/50">
        {os.termos_aceitos && <span className="absolute top-2 right-2 text-emerald-500 bg-emerald-500/10 text-[9px] md:text-[10px] px-2 py-1 rounded-lg font-bold">✅ Briefing</span>}
        <p className="text-[9px] md:text-[10px] text-slate-600 uppercase font-black tracking-widest">GMV Transacionado</p>
        <div className="flex items-baseline justify-between mt-0.5">
          <p className="text-xl md:text-2xl font-black text-white font-mono">{formatarMoeda(os.valor_total_os)}</p>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${os.status_pagamento === 'PAGO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {os.status_pagamento === 'PAGO' ? '⚡ Quitado' : '⏳ Aguardando PIX'}
          </span>
        </div>
      </div>
      
      {os.status !== 'CONCLUIDO' && (
        <div className="mt-4 pt-4 border-t border-slate-800/50 flex flex-col gap-2">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-1">
            {os.medidor ? '🔄 Transferir Rota' : '⚠️ Aguardando Medidor'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select className="w-full sm:flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs md:text-sm text-slate-300 outline-none focus:border-blue-500 appearance-none" value={medidorId} onChange={(e) => setMedidorId(e.target.value)}>
              <option value="" disabled>{os.medidor ? `Atual: ${os.medidor.nome_completo}` : 'Selecione quem vai medir...'}</option>
              {medidores.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
            </select>
            <button onClick={() => { if(!medidorId) return alert("Selecione um medidor!"); onTransfer(os.id, medidorId); setMedidorId(''); }} className="w-full sm:w-auto bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold hover:bg-blue-500 transition-all">
              {os.medidor ? 'Transferir' : 'Despachar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}