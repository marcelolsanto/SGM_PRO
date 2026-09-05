import { useState } from 'react';

export default function TabelaCaixaMedidor({ medidorHistorico, formatarMoeda, formatarData, calcularSLA }) {
  const [sortConfig, setSortConfig] = useState({ key: 'criado_em', direction: 'desc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  // Aplica a ordenação na lista recebida
  const dadosOrdenados = [...medidorHistorico].sort((a, b) => {
    let valA = a[sortConfig.key]; let valB = b[sortConfig.key];
    if (sortConfig.key === 'prazo') { valA = calcularSLA(a).dias; valB = calcularSLA(b).dias; }
    if (sortConfig.key === 'data_aceite') { valA = a.data_aceite ? new Date(a.data_aceite).getTime() : new Date(a.criado_em).getTime(); valB = b.data_aceite ? new Date(b.data_aceite).getTime() : new Date(b.criado_em).getTime(); }
    if (sortConfig.key === 'data_conclusao') { valA = a.data_conclusao ? new Date(a.data_conclusao).getTime() : 0; valB = b.data_conclusao ? new Date(b.data_conclusao).getTime() : 0; }
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead className="bg-slate-950/50 border-b border-slate-800">
          <tr>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('id')}>ID {sortConfig.key==='id' && (sortConfig.direction==='asc'?'▲':'▼')}</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('cliente_nome')}>Cliente / Loja {sortConfig.key==='cliente_nome' && (sortConfig.direction==='asc'?'▲':'▼')}</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('data_aceite')}>Início {sortConfig.key==='data_aceite' && (sortConfig.direction==='asc'?'▲':'▼')}</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('data_conclusao')}>Entrega {sortConfig.key==='data_conclusao' && (sortConfig.direction==='asc'?'▲':'▼')}</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('prazo')}>SLA (Prazo) {sortConfig.key==='prazo' && (sortConfig.direction==='asc'?'▲':'▼')}</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500">Mão de Obra (m²)</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500">Urgência (+50%)</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500">Deslocamento</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-emerald-400 cursor-pointer hover:text-emerald-300 transition-colors" onClick={() => handleSort('custo_medidor')}>Total a Receber {sortConfig.key==='custo_medidor' && (sortConfig.direction==='asc'?'▲':'▼')}</th>
            <th className="p-4 text-[10px] uppercase font-black tracking-widest text-slate-500 text-right">Comprovante</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {dadosOrdenados.map(os => {
            const sla = calcularSLA(os)
            const dataInicio = os.data_aceite ? os.data_aceite : os.criado_em
            const dataFim = os.data_conclusao || new Date(new Date(dataInicio).getTime() + (sla.dias * 24 * 60 * 60 * 1000)).toISOString()
            const maoDeObra = os.mao_de_obra_medidor || (os.custo_medidor - os.taxa_deslocamento - (os.adicional_urgencia || 0))
            const adicionalUrg = os.adicional_urgencia || ((os.urgencia && maoDeObra > 0) ? maoDeObra * 0.5 : 0)

            return (
              <tr key={os.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="p-4 font-mono text-xs text-slate-400">#{String(os.id).padStart(4, '0')}</td>
                <td className="p-4"><p className="font-bold text-slate-200">{os.cliente_nome}</p><p className="text-[10px] text-blue-400 uppercase font-black tracking-widest mt-0.5">{os.loja?.nome_fantasia}</p></td>
                <td className="p-4 text-xs font-mono text-slate-300">{formatarData(dataInicio)}</td>
                <td className="p-4 text-xs font-mono text-slate-300">{formatarData(dataFim)}</td>
                <td className="p-4"><span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${sla.cor}`}>{sla.texto}</span></td>
                <td className="p-4 font-mono text-xs text-slate-300">{formatarMoeda(maoDeObra)}</td>
                <td className="p-4 font-mono text-xs">
                  {(os.urgencia || adicionalUrg > 0) ? (
                    <span className="text-amber-400 font-bold">+{formatarMoeda(adicionalUrg)}</span>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </td>
                <td className="p-4 font-mono text-xs text-slate-300">+{formatarMoeda(os.taxa_deslocamento)}</td>
                <td className="p-4 font-black text-emerald-400 font-mono text-sm">{formatarMoeda(os.custo_medidor)}</td>
                <td className="p-4 text-right"><a href={os.caminho_medicao} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-slate-700">Ver PDF</a></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  );
}