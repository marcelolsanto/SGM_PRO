import { useState, useEffect } from 'react'
import axios from 'axios'

const TIPOS_AMBIENTE = { 
  'Cozinha / Churrasqueira': { complexidade: 2.0, precoBase: 62.50 },
  'Escadaria': { complexidade: 2.0, precoBase: 62.50 },
  'Área de Serviço / Lavanderia': { complexidade: 1.8, precoBase: 56.25 },
  'Banheiro': { complexidade: 1.6, precoBase: 50.00 },
  'Sala de Estar / Jantar': { complexidade: 1.4, precoBase: 43.75 },
  'Dormitório / Quarto / Suíte': { complexidade: 1.2, precoBase: 37.50 },
  'Varanda / Sacada': { complexidade: 1.0, precoBase: 31.25 },
  'Outro (Escritório / Hall / Lavabo)': { complexidade: 1.0, precoBase: 31.25 }
}

export default function NovaOsModal({ isOpen, onClose, onSuccess, osParaEditar, lojas, clientes, perfil, refId }) {
  const [formData, setFormData] = useState({ cliente_nome: '', endereco_obra: '', loja_id: '', urgencia: false })
  const [cepDigitado, setCepDigitado] = useState('')
  const [ambientes, setAmbientes] = useState([])
  const [salvando, setSalvando] = useState(false)

  const calcularResumoFinanceiro = () => {
    if (!ambientes || ambientes.length === 0) return { subtotal: 0, desconto: 0, total: 0, pctDesconto: 0 }
    
    let subtotal = 0
    ambientes.forEach(amb => {
      const nomeLower = (amb.nome || '').toLowerCase()
      const tipoLower = (amb.tipo_ambiente || '').toLowerCase()
      
      let preco = 31.25
      if (nomeLower.includes('cozinha') || tipoLower.includes('cozinha') || tipoLower.includes('churrasqueira') || tipoLower.includes('gourmet')) preco = 62.50
      else if (nomeLower.includes('escada') || tipoLower.includes('escada')) preco = 62.50
      else if (nomeLower.includes('serviço') || nomeLower.includes('servico') || tipoLower.includes('serviço') || tipoLower.includes('servico') || nomeLower.includes('lavanderia') || nomeLower.includes('tanque')) preco = 56.25
      else if (nomeLower.includes('banheiro') || tipoLower.includes('banheiro') || nomeLower.includes('lavabo') || nomeLower.includes('wc')) preco = 50.00
      else if (nomeLower.includes('sala') || tipoLower.includes('sala') || nomeLower.includes('estar') || nomeLower.includes('jantar') || nomeLower.includes('living')) preco = 43.75
      else if (nomeLower.includes('quarto') || tipoLower.includes('quarto') || nomeLower.includes('dormit') || nomeLower.includes('suíte') || nomeLower.includes('suite')) preco = 37.50
      else if (nomeLower.includes('varanda') || tipoLower.includes('varanda') || nomeLower.includes('sacada') || tipoLower.includes('sacada')) preco = 31.25
      else if (TIPOS_AMBIENTE[amb.tipo_ambiente]?.precoBase) preco = TIPOS_AMBIENTE[amb.tipo_ambiente].precoBase
      
      subtotal += preco
    })

    const n = ambientes.length
    let total = subtotal
    let pct = 0

    if (n === 2) { pct = 5; total = subtotal * 0.95 }
    else if (n === 3) { pct = 10; total = subtotal * 0.90 }
    else if (n === 4) { pct = 15; total = subtotal * 0.85 }
    else if (n === 5) {
      pct = 20
      total = Math.min(subtotal * 0.80, 200.0) // Teto R$ 200 para 5 ambientes
    } else if (n > 5) {
      pct = 20
      total = subtotal * 0.80
    }

    if (formData.urgencia) {
      total = total * 1.5
    }

    return {
      subtotal,
      desconto: subtotal - (formData.urgencia ? total / 1.5 : total),
      total,
      pctDesconto: pct
    }
  }

  const resumo = calcularResumoFinanceiro()

  useEffect(() => {
    if (isOpen) {
      if (osParaEditar) {
        setFormData({ 
          cliente_nome: osParaEditar.cliente_nome, 
          endereco_obra: osParaEditar.endereco_obra, 
          loja_id: osParaEditar.loja_id, 
          urgencia: osParaEditar.urgencia 
        })
        setAmbientes(osParaEditar.ambientes.map(a => ({...a, arquivoLocal: null})))
      } else {
        setFormData({ 
          cliente_nome: clientes && clientes.length > 0 ? clientes[0].nome : '', 
          endereco_obra: '', 
          loja_id: lojas && lojas.length > 0 ? lojas[0].id : '', 
          urgencia: false 
        })
        setAmbientes([])
      }
      setCepDigitado('')
    }
  }, [isOpen, osParaEditar, lojas, clientes])

  if (!isOpen) return null

  const buscarCep = async (cep) => {
    const c = cep.replace(/\D/g, ''); setCepDigitado(c)
    if (c.length === 8) {
      try { const res = await axios.get(`https://viacep.com.br/ws/${c}/json/`); if (!res.data.erro) setFormData(prev => ({ ...prev, endereco_obra: `${res.data.logradouro}, Número:  - ${res.data.bairro}, ${res.data.localidade} - ${res.data.uf}, CEP: ${c}` })) } catch (e) {}
    }
  }

  const addAmbiente = () => setAmbientes([...ambientes, { nome: '', tipo_ambiente: 'Cozinha / Churrasqueira', area_estimada_m2: '', complexidade: 2.0, observacoes: '', arquivoLocal: null }])
  const rmAmbiente = (i) => setAmbientes(ambientes.filter((_, idx) => idx !== i))
  const attAmbiente = (i, campo, valor) => { const n = [...ambientes]; n[i][campo] = valor; if (campo === 'tipo_ambiente') n[i].complexidade = TIPOS_AMBIENTE[valor]?.complexidade || 1.0; setAmbientes(n) }

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    
    if (!clientes || clientes.length === 0) return alert("⚠️ Registe primeiro um Cliente na aba 'Meus Cadastros'.");
    if (!formData.cliente_nome) return alert("⚠️ Selecione um Cliente na lista.");
    if (ambientes.length === 0) return alert("⚠️ Adicione pelo menos um ambiente para ser medido.");

    setSalvando(true)
    try {
      const ambsPrep = []
      for (const amb of ambientes) {
        let pdfUrl = amb.caminho_planta_pdf || ''
        
        if (amb.arquivoLocal) { 
          const f = new FormData(); 
          f.append('arquivo', amb.arquivoLocal); 
          try {
            const r = await axios.post('http://localhost:8080/api/upload', f); 
            pdfUrl = r.data.url;
          } catch (uploadErr) {
            alert("❌ Erro ao enviar o anexo (Pode ser muito pesado ou a internet falhou). Tente sem anexo ou com outro ficheiro.");
            setSalvando(false);
            return; 
          }
        }
        
        const areaLimpa = String(amb.area_estimada_m2 || "0").replace(',', '.');

        ambsPrep.push({ 
          nome: amb.nome, 
          tipo_ambiente: amb.tipo_ambiente, 
          area_estimada_m2: parseFloat(areaLimpa) || 0, 
          complexidade: parseFloat(amb.complexidade) || 1.0, 
          observacoes: amb.observacoes, 
          caminho_planta_pdf: pdfUrl 
        })
      }
      
      let idDaLoja = 0;
      if (perfil === 'LOJA') {
         idDaLoja = parseInt(refId);
      } else {
         idDaLoja = parseInt(formData.loja_id);
      }

      if (!idDaLoja || isNaN(idDaLoja)) {
        alert("⚠️ O Sistema não conseguiu identificar a Loja responsável. Atualize a página e tente de novo.");
        setSalvando(false);
        return;
      }

      const payload = { ...formData, loja_id: idDaLoja, ambientes: ambsPrep }
      
      if (osParaEditar) {
        await axios.put(`http://localhost:8080/api/os/${osParaEditar.id}`, payload)
        alert("✅ OS Atualizada com Sucesso!");
      } else {
        await axios.post('http://localhost:8080/api/os', payload)
        alert("✅ OS Criada e Guardada com Sucesso!");
      }
      
      onSuccess() 
    } catch (error) { 
      console.error(error);
      const mensagemErro = error.response?.data?.erro || "O Servidor não respondeu a tempo ou a internet falhou.";
      alert("❌ Falha Crítica ao salvar:\n" + mensagemErro);
    } finally { 
      setSalvando(false) 
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] w-full max-w-3xl shadow-2xl max-h-[95vh] overflow-y-auto custom-scrollbar flex flex-col">
        <h2 className="text-xl md:text-2xl font-black text-white mb-4 md:mb-6 border-b border-slate-800 pb-3 md:pb-4 shrink-0">{osParaEditar ? `Editar OS #00${osParaEditar.id}` : 'Nova Ordem de Serviço'}</h2>
        <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            
            {(perfil === 'ADMIN' || !perfil) && (
              <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Loja Solicitante</label><select required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formData.loja_id} onChange={e => setFormData({...formData, loja_id: e.target.value})}>{lojas && lojas.map(l => <option key={l.id} value={l.id}>{l.nome_fantasia}</option>)}</select></div>
            )}
            
            <div className={perfil === 'LOJA' ? "md:col-span-2" : ""}><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Cliente Final</label><select required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formData.cliente_nome} onChange={e => setFormData({...formData, cliente_nome: e.target.value})}>{clientes && clientes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
            <div className="md:col-span-1"><label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5">📍 Buscar CEP</label><input placeholder="00000-000" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={cepDigitado} onChange={e => buscarCep(e.target.value)} maxLength="9" /></div>
            <div className="md:col-span-3"><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Endereço Completo</label><input required placeholder="Rua, Bairro - UF" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formData.endereco_obra} onChange={e => setFormData({...formData, endereco_obra: e.target.value})} /></div>
            <div className="md:col-span-4 mt-2"><label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${formData.urgencia ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-400'}`}><input type="checkbox" className="w-5 h-5 accent-red-500 shrink-0" checked={formData.urgencia} onChange={e => setFormData({...formData, urgencia: e.target.checked})} /><span className="font-bold text-sm">🚨 Medição de Urgência (Dobra deslocamento e tira descontos)</span></label></div>
          </div>
          
          <div className="border-t border-slate-800 pt-5">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white">Ambientes</h3><button type="button" onClick={addAmbiente} className="bg-slate-800 hover:bg-slate-700 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold transition-all">+ Cômodo</button></div>
            <div className="space-y-4">
              {ambientes.map((amb, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl relative"><button type="button" onClick={() => rmAmbiente(idx)} className="absolute top-2 right-3 text-slate-600 hover:text-red-500 font-bold">✕</button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 pr-6">
                    <div className="md:col-span-2"><label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Ambiente</label><input required placeholder="Ex: Cozinha" className="w-full bg-slate-900 border border-blue-700/50 rounded-xl p-2.5 text-white outline-none focus:border-blue-500" value={amb.nome} onChange={e => attAmbiente(idx, 'nome', e.target.value)} /></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Área (m²)</label><input type="text" inputMode="decimal" required placeholder="0.0" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none" value={amb.area_estimada_m2} onChange={e => attAmbiente(idx, 'area_estimada_m2', e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Risco</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none" value={amb.tipo_ambiente} onChange={e => attAmbiente(idx, 'tipo_ambiente', e.target.value)}>{Object.keys(TIPOS_AMBIENTE).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Planta Baixa (PDF/Img)</label><input type="file" accept=".pdf,image/*" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-1.5 text-white text-xs file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:px-2 file:cursor-pointer hover:file:bg-blue-500" onChange={e => {const n=[...ambientes]; n[idx].arquivoLocal=e.target.files[0]; setAmbientes(n)}} /></div>
                  </div>
                  <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Obs.</label><input placeholder="Ex: Cuidado com o cano" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none text-xs" value={amb.observacoes} onChange={e => attAmbiente(idx, 'observacoes', e.target.value)} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* RESUMO FINANCEIRO DINÂMICO E COMBO APARTAMENTO COMPLETO */}
          {ambientes.length > 0 && (
            <div className="bg-gradient-to-br from-slate-950 to-blue-950/40 p-4 rounded-2xl border border-blue-900/50 mt-4 space-y-2.5">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Soma dos Ambientes Avulsos ({ambientes.length} cômodo{ambientes.length > 1 ? 's' : ''}):</span>
                <span className="line-through font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.subtotal)}</span>
              </div>

              {resumo.pctDesconto > 0 && (
                <div className="flex justify-between items-center text-xs font-bold text-emerald-400">
                  <span>🎉 Desconto Combo {ambientes.length === 5 ? 'Apartamento Completo' : `(${resumo.pctDesconto}% OFF)`}:</span>
                  <span>- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.desconto)}</span>
                </div>
              )}

              {formData.urgencia && (
                <div className="flex justify-between items-center text-xs font-bold text-amber-400">
                  <span>🚨 Adicional de Medição Express (24h):</span>
                  <span>+50%</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="font-bold text-white text-sm">Valor Total da Medição:</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.total)}
                </span>
              </div>

              {ambientes.length === 5 && !formData.urgencia && (
                <div className="text-[11px] text-emerald-300 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-center">
                  ✨ Apartamento Completo (5 Cômodos) no teto promocional de R$ 200,00!
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-800"><button type="button" onClick={onClose} className="flex-1 text-slate-500 font-bold hover:text-white py-3 transition-colors">Cancelar</button><button type="submit" disabled={salvando} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 shadow-lg transition-colors">{salvando ? '⏳ Salvando...' : (osParaEditar ? 'Atualizar OS' : 'Emitir OS')}</button></div>
        </form>
      </div>
    </div>
  )
}