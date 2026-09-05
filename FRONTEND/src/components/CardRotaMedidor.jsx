import { useState } from 'react';
import axios from 'axios';

export default function CardRotaMedidor({ os, formatarMoeda, marcarChegada, entregarMedicao }) {
  const [materiaisTexto, setMateriaisTexto] = useState('');
  const [observacoesTexto, setObservacoesTexto] = useState('');
  const [uploading, setUploading] = useState(false);

  // 🔥 Função que transforma o JSON do banco numa lista bonita 🔥
  const renderBriefing = (jsonStr) => {
    if (!jsonStr) return <p className="text-slate-500 italic">Briefing vazio.</p>;
    try {
      const dados = JSON.parse(jsonStr);
      return (
        <ul className="list-disc pl-4 space-y-1">
          {Object.entries(dados).map(([k, v]) => (
            <li key={k} className="text-slate-300">
              <strong className="capitalize text-slate-400">{k.replace(/_/g, ' ')}:</strong> {v === true ? 'Sim' : v === false ? 'Não' : v}
            </li>
          ))}
        </ul>
      );
    } catch (e) { return <p>{jsonStr}</p>; }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    setUploading(true); 
    const formData = new FormData(); 
    formData.append('arquivo', file); 
    try { 
      const res = await axios.post('/api/upload', formData); 
      entregarMedicao(os.id, res.data.url, materiaisTexto, observacoesTexto); 
    } catch (error) { 
      alert("Erro de conexão no upload."); 
      setUploading(false); 
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-800">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            {os.ordem_rota > 0 && (
              <span className="bg-emerald-500 text-white text-xs px-2.5 py-0.5 rounded-full font-black shadow-sm">
                #{os.ordem_rota}
              </span>
            )}
            <h2 className="text-xl font-black text-white">{os.cliente_nome}</h2>
          </div>
          {os.urgencia && <span className="bg-red-500 text-white text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest">Urgência</span>}
        </div>
        <div className="flex items-center justify-between text-xs mb-4">
          <p className="text-slate-400 truncate mr-2">📍 {os.endereco_obra}</p>
          {os.hora_agendada && (
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-mono font-bold whitespace-nowrap text-[10px]">
              ⏰ {os.hora_agendada}
            </span>
          )}
        </div>

        {os.status === 'EM_ROTA' && (
          <div className="w-full h-32 bg-slate-800 relative mb-4 rounded-xl overflow-hidden border border-slate-700">
            <iframe width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight="0" marginWidth="0" src={`https://maps.google.com/maps?q=$${encodeURIComponent(os.endereco_obra)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}></iframe>
          </div>
        )}

        {/* 🔥 NOVA ÁREA: DOCUMENTOS DA OBRA (Visível em Rota e no Local) 🔥 */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4">
          <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest mb-3 flex items-center gap-2">📄 Documentos da Obra</p>
          
          <div className="mb-4">
            <p className="text-xs text-slate-500 font-bold mb-1">Briefing do Cliente:</p>
            <div className="bg-slate-900 p-3 rounded-lg text-xs max-h-32 overflow-y-auto custom-scrollbar border border-slate-800/50">
              {os.briefing ? renderBriefing(os.briefing.dados_json) : <p className="text-slate-500 italic">Preenchido. Sem dados adicionais.</p>}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">Plantas da Loja:</p>
            <div className="flex flex-col gap-2">
              {os.ambientes?.map((amb, idx) => amb.caminho_planta_pdf ? (
                <a key={idx} href={amb.caminho_planta_pdf} target="_blank" rel="noreferrer" className="bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs py-2 px-3 rounded-lg border border-slate-700 flex justify-between items-center transition-colors">
                  <span className="truncate pr-2">🛋️ {amb.nome}</span>
                  <span className="text-emerald-400 font-black text-[10px] uppercase whitespace-nowrap">Ver PDF ↗</span>
                </a>
              ) : null)}
            </div>
          </div>
        </div>

        {os.status === 'EM_ROTA' && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <a href={`https://waze.com/ul?q=${encodeURIComponent(os.endereco_obra)}`} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-blue-400 py-2.5 rounded-xl text-xs font-bold text-center border border-slate-700 flex flex-col items-center justify-center gap-1 transition-colors"><span className="text-lg">🚙</span> Abrir Waze</a>
            <a href={`https://maps.google.com/?q=$${encodeURIComponent(os.endereco_obra)}`} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 text-emerald-400 py-2.5 rounded-xl text-xs font-bold text-center border border-slate-700 flex flex-col items-center justify-center gap-1 transition-colors"><span className="text-lg">🗺️</span> Google Maps</a>
          </div>
        )}

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase font-black">Ganho Garantido: <span className="text-lg text-emerald-400 ml-2">{formatarMoeda(os.custo_medidor)}</span></p>
        </div>

        {os.status === 'EM_ROTA' && (
          <button onClick={() => marcarChegada(os.id)} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl shadow-lg mt-4 transition-transform hover:-translate-y-1 text-sm tracking-wide flex justify-center items-center gap-2">
            📍 INFORMAR CHEGADA NO LOCAL
          </button>
        )}
      </div>
      
      {os.status === 'NO_LOCAL' && (
        <div className="p-5 bg-blue-900/5 animate-fade-in">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg text-center mb-4"><p className="text-emerald-400 font-black text-xs">📍 Você está no local</p></div>
          <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-3 flex items-center gap-2"><span>📥</span> Finalizar e Entregar</p>
          <div className="space-y-3">
            <input type="text" placeholder="Material Gasto (Ex: MDF, Gabarito...)" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500" value={materiaisTexto} onChange={(e) => setMateriaisTexto(e.target.value)} />
            <textarea placeholder="Observações da obra (Opcional)" rows="2" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 resize-none" value={observacoesTexto} onChange={(e) => setObservacoesTexto(e.target.value)}></textarea>
            <label className="block w-full bg-blue-600 hover:bg-blue-500 text-white text-center py-3 rounded-xl text-sm font-black cursor-pointer transition-all shadow-lg shadow-blue-900/30">
              {uploading ? 'Enviando Nuvem...' : '📎 Anexar Planta Pronta (PDF)'}
              <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}