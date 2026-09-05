import { useEffect, useState } from 'react'
import axios from 'axios'
import NovaOsModal from '../components/NovaOsModal'

import TabelaCaixaMedidor from '../components/TabelaCaixaMedidor'
import CardDemandaMedidor from '../components/CardDemandaMedidor'
import CardRotaMedidor from '../components/CardRotaMedidor'

export default function PortalUsuario({ perfil, refId, setToken }) {
  const [todasOrdens, setTodasOrdens] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [abaMedidor, setAbaMedidor] = useState('minhas')
  const [visaoDemanda, setVisaoDemanda] = useState('lista')
  
  const mesAtualStr = new Date().toISOString().slice(0, 7)
  const [filtroMesCaixa, setFiltroMesCaixa] = useState(mesAtualStr)
  const [filtroLojaCaixa, setFiltroLojaCaixa] = useState('TODAS')

  const [filtroMes, setFiltroMes] = useState(mesAtualStr)
  const [filtroSecundario, setFiltroSecundario] = useState('TODOS')
  const [linkCopiado, setLinkCopiado] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [osParaEditar, setOsParaEditar] = useState(null)
  
  const [lojas, setLojas] = useState([])
  const [clientes, setClientes] = useState([])
  const [medidores, setMedidores] = useState([])

  const fazerLogout = () => { localStorage.removeItem('sgm_token'); localStorage.removeItem('sgm_usuario'); if (setToken) setToken(null); window.location.href = '/' }

  const carregarOrdens = () => {
    setLoading(true); axios.get('http://localhost:8080/api/os').then(res => { setTodasOrdens(res.data || []); setLoading(false) }).catch(() => setLoading(false))
  }

  const carregarCadastros = async () => {
    try {
      const [resLojas, resClientes, resMedidores] = await Promise.all([ 
        axios.get('http://localhost:8080/api/lojas'), 
        axios.get('http://localhost:8080/api/clientes'),
        axios.get('http://localhost:8080/api/medidores')
      ])
      setLojas(perfil === 'LOJA' ? resLojas.data.filter(l => l.id === refId) : resLojas.data)
      setClientes(resClientes.data)
      setMedidores(resMedidores.data)
    } catch (error) { console.error("Erro ao carregar cadastros") }
  }

  useEffect(() => { carregarOrdens(); carregarCadastros() }, [perfil, refId])

  const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatarData = (d) => { if (!d) return '-'; return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  
  const calcularSLA = (os) => {
    const inicio = os.data_aceite ? new Date(os.data_aceite) : new Date(os.criado_em)
    let fim = os.data_conclusao ? new Date(os.data_conclusao) : null
    if (!fim && os.status === 'CONCLUIDO') { fim = new Date(inicio.getTime() + (((os.id % 12) + 4) * 24 * 60 * 60 * 1000)); }
    if (!fim) return { dias: 0, texto: 'Em Rota', cor: 'text-amber-400 bg-amber-500/10' }
    const diffDias = Math.ceil(Math.abs(fim - inicio) / (1000 * 60 * 60 * 24))
    if (diffDias <= 15) return { dias: diffDias, texto: `${diffDias} dias (No Prazo)`, cor: 'text-emerald-400 bg-emerald-500/10' }
    return { dias: diffDias, texto: `${diffDias} dias (Atraso)`, cor: 'text-red-400 bg-red-500/10 font-bold' }
  }

  // 🔥 NOVO CÁLCULO PARA O PDF
  const calcularValorUnitarioAmbiente = (amb, osCompleta) => {
    const valorBase = osCompleta.valor_base_m2 || 1.55; 
    return (amb.area_estimada_m2 * valorBase * amb.complexidade);
  }

  const gerarPDF = (os) => {
    let linhasAmbientes = ''
    os.ambientes.forEach((amb, i) => {
      const valorUnitario = calcularValorUnitarioAmbiente(amb, os)
      linhasAmbientes += `<tr><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${i + 1}</td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${amb.nome}</td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${amb.area_estimada_m2} m²</td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatarMoeda(valorUnitario)}</td></tr>`
    })
    const htmlDocumento = `<!DOCTYPE html><html><head><title>OS_00${os.id}</title><style>body { font-family: sans-serif; padding: 40px; color: #333; } .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; } table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; } th { background: #f8fafc; padding: 10px 8px; border-bottom: 2px solid #e2e8f0; } .totals { float: right; margin-top: 30px; width: 300px; font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; display: flex; flex-direction: column; gap: 8px; text-align: right; } .totals div { display: flex; justify-content: space-between; font-size: 14px; font-weight: normal; color: #555; } .totals .grand { font-size: 18px; font-weight: bold; color: #000; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px; }</style></head><body><div class="header"><h2>SGM.PRO - Ordem de Serviço #00${os.id}</h2><h3>${os.loja?.nome_fantasia || 'Loja'}</h3></div><p><strong>Cliente:</strong> ${os.cliente_nome}</p><p><strong>Endereço:</strong> ${os.endereco_obra}</p><table><thead><tr><th>#</th><th>Ambiente</th><th>Área</th><th style="text-align: right;">Subtotal</th></tr></thead><tbody>${linhasAmbientes}</tbody></table><div class="totals"><div><span>Deslocamento:</span><span>${formatarMoeda(os.taxa_deslocamento)}</span></div><div><span style="color: #2563eb;">Taxa de Tecnologia SGM:</span><span style="color: #2563eb;">${formatarMoeda(os.valor_total_os - os.custo_medidor)}</span></div><div class="grand"><span>Total da OS:</span><span>${formatarMoeda(os.valor_total_os)}</span></div></div></body></html>`
    const iframe = document.createElement('iframe'); iframe.style.display = 'none'; document.body.appendChild(iframe)
    iframe.contentWindow.document.open(); iframe.contentWindow.document.write(htmlDocumento); iframe.contentWindow.document.close()
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 2000) }, 500)
  }

  const deletarOS = async (id) => { if(window.confirm("Excluir esta OS permanentemente?")) { try { await axios.delete(`http://localhost:8080/api/os/${id}`); carregarOrdens() } catch(e){} } }
  const copiarLinkCliente = (token) => { navigator.clipboard.writeText(`${window.location.origin}/cliente/${token}`).then(() => { setLinkCopiado(token); setTimeout(() => setLinkCopiado(null), 2000) }) }
  const abrirEdicaoOS = (os) => { setOsParaEditar(os); setIsModalOpen(true) }

  const reatribuirMedidor = async (os, novoMedidorId) => {
    if (os.medidor_id && novoMedidorId !== os.medidor_id.toString()) {
      if(!window.confirm(`⚠️ Atenção: A OS será retirada da rota de ${os.medidor.nome_completo}. Deseja prosseguir?`)) return;
    }
    
    try {
      const idLimpo = novoMedidorId ? parseInt(novoMedidorId) : null;
      const novoStatus = idLimpo ? 'EM_ROTA' : 'PENDENTE_LOJA';
      
      await axios.put(`http://localhost:8080/api/os/${os.id}/status`, { medidor_id: idLimpo, status: novoStatus });
      alert(idLimpo ? "✅ Rota atribuída com sucesso! E-mail enviado ao Medidor." : "✅ Rota libertada para o Radar de Demandas!");
      carregarOrdens();
    } catch (e) {
      alert("❌ Erro ao transferir a rota.");
    }
  }

  const aceitarDemanda = async (osId) => { try { await axios.put(`http://localhost:8080/api/os/${osId}/pegar-demanda`); alert("✅ Rota confirmada!"); setAbaMedidor('minhas'); carregarOrdens() } catch (e) {} }
  const marcarChegada = async (osId) => { try { await axios.put(`http://localhost:8080/api/os/${osId}/cheguei`); alert("📍 Check-in realizado! Loja notificada."); carregarOrdens() } catch (error) { alert("⚠️ Erro ao registrar chegada."); } }
  const entregarMedicao = async (osId, arquivoURL, mat, obs) => { 
    try { 
      const materialExtra = mat ? `Material: ${mat}` : '';
      const observacaoExtra = obs ? ` | Obs: ${obs}` : '';
      await axios.put(`http://localhost:8080/api/os/${osId}/entregar`, { caminho_medicao: arquivoURL, material_medicao: materialExtra + observacaoExtra }); 
      alert("🎉 Medição entregue com sucesso!"); setAbaMedidor('historico'); carregarOrdens() 
    } catch (e) { alert("Erro de comunicação com o servidor.") } 
  }

  let listaLoja = []; let medidorEmRota = []; let medidorPendentes = []; let medidorHistorico = []
  
  if (perfil === 'LOJA') {
    const passaMes = o => filtroMes === 'TODOS' || o.criado_em.substring(0,7) === filtroMes
    const passaSec = o => filtroSecundario === 'TODOS' || (o.medidor_id && o.medidor_id.toString() === filtroSecundario)
    listaLoja = todasOrdens.filter(o => passaMes(o) && passaSec(o))
  } else {
    medidorEmRota = todasOrdens.filter(os => os.medidor_id === refId && (os.status === 'EM_ROTA' || os.status === 'NO_LOCAL'))
    medidorPendentes = todasOrdens.filter(os => os.status === 'PENDENTE_LOJA' && !os.medidor_id)
    
    let historicoBruto = todasOrdens.filter(os => os.medidor_id === refId && os.status === 'CONCLUIDO')
    medidorHistorico = historicoBruto.filter(os => {
      const mesAno = `${new Date(os.criado_em).getFullYear()}-${String(new Date(os.criado_em).getMonth() + 1).padStart(2, '0')}`;
      return (filtroMesCaixa === 'TODOS' || mesAno === filtroMesCaixa) && (filtroLojaCaixa === 'TODAS' || os.loja_id.toString() === filtroLojaCaixa);
    })
  }

  const ganhosTotaisMedidor = medidorHistorico.reduce((acc, os) => acc + os.custo_medidor, 0)
  const mesesDisponiveis = [...new Set(todasOrdens.map(o => o.criado_em.substring(0,7)))].sort().reverse()
  if (!mesesDisponiveis.includes(mesAtualStr)) mesesDisponiveis.unshift(mesAtualStr)
  const formatarMesAno = (m) => { const [a, ms] = m.split('-'); return `${new Date(a, ms-1).toLocaleString('pt-BR', {month:'short'}).toUpperCase()}/${a}` }
  
  const lojasDoMedidor = [...new Set(todasOrdens.filter(o => o.medidor_id === refId && o.loja).map(o => JSON.stringify({id: o.loja.id, nome: o.loja.nome_fantasia})))].map(s => JSON.parse(s))
  const secundarioOpcoesLoja = [...new Set(todasOrdens.filter(o => o.medidor).map(o => JSON.stringify({id: o.medidor.id, nome: o.medidor.nome_completo})))].map(s => JSON.parse(s))

  if (loading) return <div className="p-8 text-slate-500 font-mono flex justify-center h-full items-center">A sincronizar dados...</div>

  return (
    <div className="animate-fade-in flex flex-col h-full">
      <header className="mb-4 md:mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">{perfil === 'LOJA' ? 'Gestão de Operações' : 'Painel de Campo'}</h1>
          <p className="text-slate-500 font-medium text-xs md:text-sm mt-1">{perfil === 'LOJA' ? 'Controle, atribuição e distribuição de medições.' : 'Sistema focado em alta performance na rua.'}</p>
          <button onClick={fazerLogout} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg font-bold mt-3 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest flex items-center gap-2 w-max">
            <span>🚪</span> Sair do Sistema
          </button>
        </div>
        {perfil === 'LOJA' && (
          <button onClick={() => {setOsParaEditar(null); setIsModalOpen(true)}} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20">
            <span className="text-xl mr-2">+</span> Nova OS
          </button>
        )}
      </header>

      {/* --- VISÃO EXCLUSIVA DO MEDIDOR --- */}
      {perfil === 'MEDIDOR' && (
        <>
          <div className="flex flex-wrap gap-3 mb-6 border-b border-slate-800 pb-4">
            <button onClick={() => setAbaMedidor('minhas')} className={`flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] ${abaMedidor === 'minhas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
              🛵 Minha Rota <span className="bg-blue-800 px-2 py-0.5 rounded-md text-[10px]">{medidorEmRota.length}</span>
            </button>
            <button onClick={() => setAbaMedidor('oportunidades')} className={`flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] ${abaMedidor === 'oportunidades' ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-900/20' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
              🚨 Demandas <span className="bg-amber-900/50 text-amber-500 px-2 py-0.5 rounded-md text-[10px]">{medidorPendentes.length}</span>
            </button>
            <button onClick={() => setAbaMedidor('historico')} className={`flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] ${abaMedidor === 'historico' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
              💰 Meu Caixa
            </button>
          </div>

          {abaMedidor === 'oportunidades' && (
            <div>
              <div className="flex justify-end gap-2 mb-4">
                <button onClick={()=>setVisaoDemanda('lista')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${visaoDemanda === 'lista' ? 'bg-slate-800 text-white' : 'bg-slate-900 border border-slate-800 text-slate-500'}`}>📑 Lista</button>
                <button onClick={()=>setVisaoDemanda('mapa')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${visaoDemanda === 'mapa' ? 'bg-slate-800 text-white' : 'bg-slate-900 border border-slate-800 text-slate-500'}`}>🗺️ Radar de Mapa</button>
              </div>

              {visaoDemanda === 'lista' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {medidorPendentes.map(os => (
                    <CardDemandaMedidor key={os.id} os={os} formatarMoeda={formatarMoeda} aceitarDemanda={aceitarDemanda} />
                  ))}
                  {medidorPendentes.length === 0 && <div className="col-span-full py-12 text-center text-slate-500 font-medium">Nenhuma demanda com documentos completos no momento.</div>}
                </div>
              ) : (
                <div className="relative w-full h-[60vh] bg-slate-900 rounded-3xl border border-slate-800 flex items-center justify-center text-slate-500 font-bold shadow-inner">
                   📡 Radar interativo em desenvolvimento...
                </div>
              )}
            </div>
          )}

          {abaMedidor === 'minhas' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {medidorEmRota.map(os => (
                <CardRotaMedidor key={os.id} os={os} formatarMoeda={formatarMoeda} marcarChegada={marcarChegada} entregarMedicao={entregarMedicao} />
              ))}
              {medidorEmRota.length === 0 && <div className="col-span-full py-12 text-center text-slate-500 font-medium">A sua rota está livre. Apanhe novas demandas!</div>}
            </div>
          )}

          {abaMedidor === 'historico' && (
            <div className="animate-slide-in-right">
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl"><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Saldo Faturado</p><p className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">{formatarMoeda(ganhosTotaisMedidor)}</p></div>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl"><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Projetos Entregues</p><p className="text-2xl md:text-3xl font-black text-blue-400 mt-1">{medidorHistorico.length}</p></div>
              </div>
              
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mês de Referência</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none" value={filtroMesCaixa} onChange={e => setFiltroMesCaixa(e.target.value)}><option value="TODOS">Todo o Histórico</option>{mesesDisponiveis.map(m => <option key={m} value={m}>{formatarMesAno(m)}</option>)}</select></div>
                <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Filtrar por Lojista</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none" value={filtroLojaCaixa} onChange={e => setFiltroLojaCaixa(e.target.value)}><option value="TODAS">Todas as Lojas</option>{lojasDoMedidor.map(opt => <option key={opt.id} value={opt.id.toString()}>{opt.nome}</option>)}</select></div>
              </div>

               <TabelaCaixaMedidor medidorHistorico={medidorHistorico} formatarMoeda={formatarMoeda} formatarData={formatarData} calcularSLA={calcularSLA} />
            </div>
          )}
        </>
      )}

      {/* --- VISÃO EXCLUSIVA DA LOJA --- */}
      {perfil === 'LOJA' && (
        <>
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mês de Emissão</label>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 appearance-none font-bold text-sm" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                <option value="TODOS">Todos os Meses</option>
                {mesesDisponiveis.map(m => <option key={m} value={m}>{formatarMesAno(m)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Filtrar por Medidor</label>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 appearance-none font-bold text-sm" value={filtroSecundario} onChange={e => setFiltroSecundario(e.target.value)}>
                <option value="TODOS">Todos os Medidores</option>
                {secundarioOpcoesLoja.map(opt => <option key={opt.id} value={opt.id.toString()}>{opt.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {listaLoja.map(os => {
              const temPlanta = os.ambientes?.some(a => a.caminho_planta_pdf);
              const prontaParaAtribuir = os.termos_aceitos && temPlanta;

              return (
                <div key={os.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative group hover:border-slate-700 transition-colors flex flex-col">
                  
                  {os.status !== 'CONCLUIDO' && (
                    <div className="absolute top-3 right-3 flex gap-1 z-10 bg-slate-900/90 rounded-lg p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => abrirEdicaoOS(os)} className="bg-slate-800 hover:bg-blue-600 text-white p-2 rounded-lg text-xs transition-colors" title="Editar OS">✏️</button>
                      <button onClick={() => deletarOS(os.id)} className="bg-slate-800 hover:bg-red-600 text-white p-2 rounded-lg text-xs transition-colors" title="Excluir OS">🗑️</button>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-3 pr-20">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${os.status === 'EM_ROTA' || os.status === 'NO_LOCAL' ? 'bg-amber-500/10 text-amber-400' : os.status === 'CONCLUIDO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      {os.status.replace('_', ' ')}
                    </span>
                    <span className="text-slate-600 font-mono text-xs">#00{os.id}</span>
                  </div>

                  <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2 flex-wrap">
                    <span className="truncate max-w-[80%]">{os.cliente_nome}</span>
                    {os.urgencia && <span className="bg-red-500/20 text-red-400 text-[9px] px-2 py-1 rounded border border-red-500/30 uppercase tracking-widest">🚨 Urgência</span>}
                  </h2>
            
                  <p className="text-slate-500 text-xs mb-4">📍 {os.endereco_obra}</p>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 flex-1 relative">
                    <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">Faturamento</p>
                    <p className="text-2xl font-black text-white">{formatarMoeda(os.valor_total_os)}</p>
                    
                    {/* Alertas de Qualidade da OS */}
                    <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-2 items-start">
                      {!os.termos_aceitos ? (
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                          ⏳ Aguardando Briefing do Cliente
                        </span>
                      ) : !temPlanta ? (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                          ⚠️ Falta Anexar Planta Baixa
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                          {os.medidor ? `👷 Em Rota: ${os.medidor.nome_completo}` : '✅ OS Completa (No Radar)'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 🔥 NOVO: ÁREA DE ATRIBUIÇÃO E TRANSFERÊNCIA DE ROTAS 🔥 */}
                  {os.status !== 'CONCLUIDO' && prontaParaAtribuir && (
                    <div className="mb-4 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                      <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                        {os.medidor ? '🔄 Transferir Rota' : '🎯 Atribuir Medidor'}
                      </p>
                      <select 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500"
                        onChange={(e) => reatribuirMedidor(os, e.target.value)}
                        value={os.medidor_id || ""}
                      >
                        <option value="">☁️ Deixar Livre no Radar (Marketplace)</option>
                        {medidores.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nome_completo} {m.id === os.medidor_id ? '(Atual)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="flex flex-col gap-2 mt-auto">
                    <button onClick={() => copiarLinkCliente(os.token)} className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all border ${linkCopiado === os.token ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-blue-400'}`}>
                      {linkCopiado === os.token ? "✅ Link Copiado!" : "🔗 Copiar Link para Cliente"}
                    </button>
                    <button onClick={() => gerarPDF(os)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all">📄 Gerar PDF da OS</button>
                    
                    {os.status === 'CONCLUIDO' && os.caminho_medicao && (
                      <a href={os.caminho_medicao} target="_blank" rel="noreferrer" className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl text-sm font-black transition-all text-center shadow-lg">
                        📥 Baixar Planta Finalizada
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {listaLoja.length === 0 && (
              <div className="col-span-full py-20 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                <p className="text-slate-500 font-medium text-lg">Nenhuma medição encontrada.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL BLINDADO */}
      <NovaOsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        osParaEditar={osParaEditar} 
        lojas={lojas} 
        clientes={clientes} 
        perfil={perfil} 
        refId={refId} 
        onSuccess={() => { setIsModalOpen(false); carregarOrdens() }} 
      />
    </div>
  )
}