import { useEffect, useState } from 'react'
import axios from 'axios'
import OsCard from '../components/OsCard'
import NovaOsModal from '../components/NovaOsModal'

export default function Operacoes() {
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Controle do Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [osParaEditar, setOsParaEditar] = useState(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [filtroLoja, setFiltroLoja] = useState('TODAS') 
  const [filtroMedidor, setFiltroMedidor] = useState('TODOS')
  const [filtroMes, setFiltroMes] = useState('TODOS')

  // Cadastros e Auxiliares
  const [lojas, setLojas] = useState([])
  const [clientes, setClientes] = useState([])
  const [medidores, setMedidores] = useState([])
  const [osDetalhe, setOsDetalhe] = useState(null)
  const [linkCopiado, setLinkCopiado] = useState(false)

  const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // 🔥 NOVO CÁLCULO PARA O PDF: Reflete a economia exata do servidor
  const calcularValorUnitarioAmbiente = (amb, osCompleta) => {
    const valorBase = osCompleta.valor_base_m2 || 1.55; 
    return (amb.area_estimada_m2 * valorBase * amb.complexidade);
  }

  const gerarPDF = (os) => {
    let linhasAmbientes = ''
    os.ambientes.forEach((amb, i) => {
      const valorUnitario = calcularValorUnitarioAmbiente(amb, os)
      linhasAmbientes += `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">${i + 1}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${amb.nome}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 11px;">${amb.tipo_ambiente} <br/>(Risco: ${amb.complexidade.toFixed(1)})</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #475569;">${amb.area_estimada_m2} m²</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a; text-align: right;">${formatarMoeda(valorUnitario)}</td>
        </tr>
      `
    })

    let dataAgendamento = 'Aguardando cliente'
    if (os.briefing?.dados_json) {
       try {
         const b = JSON.parse(os.briefing.dados_json); if (b.geral?.data_agendada) { const p = b.geral.data_agendada.split('-'); dataAgendamento = `${p[2]}/${p[1]}/${p[0]} às ${b.geral.hora_agendada}` }
       } catch(e){}
    }

    const htmlDocumento = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SGM_OS_00${os.id}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: 900; color: #2563eb; font-style: italic; letter-spacing: -1px; }
            .title { text-align: right; }
            .title h1 { margin: 0; font-size: 22px; color: #0f172a; font-weight: 900; }
            .title p { margin: 5px 0 0 0; color: #64748b; font-size: 13px; font-weight: bold; }
            .urgencia-badge { background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 900; letter-spacing: 1px; display: inline-block; margin-left: 10px; }
            .section { margin-bottom: 35px; }
            .section-title { font-size: 12px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; font-size: 13px; }
            .info-box p { margin: 6px 0; color: #475569; }
            .info-box strong { color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th { text-align: left; padding: 12px 8px; background-color: #f8fafc; color: #64748b; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #e2e8f0; }
            .totals { margin-top: 40px; width: 350px; float: right; font-size: 14px; }
            .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #cbd5e1; color: #475569; }
            .totals-row.grand { font-size: 20px; font-weight: 900; color: #0f172a; border-bottom: none; border-top: 3px solid #0f172a; padding-top: 15px; margin-top: 5px; }
            .footer { margin-top: 120px; text-align: center; font-size: 11px; color: #94a3b8; clear: both; padding-top: 20px; border-top: 1px solid #e2e8f0; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header"><div class="logo">SGM.PRO</div><div class="title"><h1>ORDEM DE SERVIÇO #00${os.id}</h1><p>Emitida em: ${new Date().toLocaleDateString('pt-BR')} ${os.urgencia ? '<span class="urgencia-badge">🚨 URGÊNCIA</span>' : ''}</p></div></div>
          <div class="info-grid section">
            <div class="info-box"><div class="section-title">Dados do Cliente</div><p><strong>Nome:</strong> ${os.cliente_nome}</p><p><strong>Obra:</strong> ${os.endereco_obra}</p><p><strong>Data Medição:</strong> ${dataAgendamento}</p></div>
            <div class="info-box"><div class="section-title">Loja / Contratante</div><p><strong>Fantasia:</strong> ${os.loja?.nome_fantasia || 'N/A'}</p><p><strong>Status:</strong> ${os.status.replace('_', ' ')}</p></div>
            <div class="info-box"><div class="section-title">Profissional em Campo</div>${os.medidor ? `<p><strong>Nome:</strong> ${os.medidor.nome_completo}</p><p><strong>Contato:</strong> ${os.medidor.telefone || 'Não informado'}</p>` : '<p style="color: #ef4444; font-weight: bold;">Aguardando alocação</p>'}</div>
          </div>
          <div class="section"><div class="section-title">Detalhamento Técnico e Comercial</div><table><thead><tr><th>#</th><th>Ambiente</th><th>Especificação</th><th>Área</th><th style="text-align: right;">Subtotal</th></tr></thead><tbody>${linhasAmbientes}</tbody></table></div>
          <div class="totals">
            <div class="totals-row"><span>Deslocamento:</span><span style="${os.urgencia ? 'color: #ef4444; font-weight: bold;' : ''}">${formatarMoeda(os.taxa_deslocamento)}</span></div>
            ${os.urgencia ? `<div class="totals-row"><span style="color: #ef4444; font-weight: bold;">Adicional de Urgência:</span><span style="color: #ef4444; font-weight: bold;">Aplicado</span></div>` : ''}
            
            <div class="totals-row">
              <span style="color: #2563eb; font-weight: bold;">Taxa de Tecnologia SGM:</span>
              <span style="color: #2563eb; font-weight: bold;">${formatarMoeda(os.valor_total_os - os.custo_medidor)}</span>
            </div>

            <div class="totals-row grand"><span>Investimento Total:</span><span>${formatarMoeda(os.valor_total_os)}</span></div>
          </div>
        </body>
      </html>
    `
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none'; document.body.appendChild(iframe)
    iframe.contentWindow.document.open(); iframe.contentWindow.document.write(htmlDocumento); iframe.contentWindow.document.close()
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => { document.body.removeChild(iframe) }, 2000) }, 500)
  }

  const renderBriefingCliente = (briefing, ambientesOS) => {
    if (!briefing || !briefing.dados_json) return null;
    try {
      const dados = JSON.parse(briefing.dados_json); const { geral, ambientes } = dados;
      const mapLabels = { geladeira: 'Geladeira', fogao: 'Fogão/Cooktop', forno: 'Forno', microondas: 'Micro-ondas', coifa: 'Coifa', lavaloucas: 'Lava-louças', purificador: 'Filtro', cama: 'Cama', tv: 'TV', ar_condicionado: 'Ar Cond.', sofa: 'Sofá', cuba: 'Cuba', vaso: 'Vaso Sanitário', chuveiro: 'Chuveiro', mesa: 'Mesa' }
      let dataStr = '';
      if (geral?.data_agendada) { const p = geral.data_agendada.split('-'); dataStr = `${p[2]}/${p[1]}/${p[0]} às ${geral.hora_agendada}` }

      return (
        <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-slate-800">
          <p className="text-[10px] text-blue-500 uppercase font-black tracking-widest mb-4 flex items-center gap-2">📋 Briefing Preenchido pelo Cliente</p>
          {dataStr && (
            <div className="bg-emerald-950/30 border border-emerald-900/50 p-4 md:p-5 rounded-2xl mb-4 flex items-center gap-4">
              <span className="text-2xl md:text-3xl">📅</span>
              <div><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Data Agendada pelo Cliente</p><p className="text-lg md:text-xl font-black text-emerald-400">{dataStr}</p></div>
            </div>
          )}
          {geral && (
            <div className="bg-blue-950/20 border border-blue-900/30 p-4 md:p-5 rounded-2xl mb-6">
              <p className="font-bold text-white text-sm mb-3">Visão Geral da Obra</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                <div><span className="text-slate-500 block mb-1">Chaves Liberadas:</span> <strong className="text-slate-200">{geral.possui_chave}</strong></div>
                <div><span className="text-slate-500 block mb-1">Revestimentos:</span> <strong className="text-slate-200">{geral.revestimento_pronto}</strong></div>
              </div>
            </div>
          )}
          {ambientes && ambientesOS?.map(amb => {
            const ambData = ambientes[amb.id];
            if (!ambData) return null;
            const itensSelecionados = Object.keys(ambData.itens || {}).filter(key => ambData.itens[key].ativo)
            return (
              <div key={`briefing-${amb.id}`} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-3">
                <p className="font-bold text-blue-400 text-sm mb-3">{amb.nome}</p>
                {itensSelecionados.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Equipamentos Previstos:</p>
                    {itensSelecionados.map(key => {
                      const item = ambData.itens[key]
                      return (
                        <div key={key} className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-200">{mapLabels[key] || key}: <span className="text-blue-400">{item.tipo || 'Pendente'}</span></span>
                          {item.modelo && <span className="text-[10px] text-slate-500 font-mono">Mod: {item.modelo}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {ambData.instalacao_pedra && <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-1 rounded">Pedra/Mármore</span>}
                  {ambData.rebaixo && <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-1 rounded">Gesso</span>}
                  {ambData.eletrica_dif && <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-900/40 text-amber-400 border border-amber-900/50 px-2 py-1 rounded">⚡ Elétrica</span>}
                  {ambData.hidraulica_dif && <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-900/40 text-blue-400 border border-blue-900/50 px-2 py-1 rounded">💧 Água</span>}
                </div>
              </div>
            )
          })}
        </div>
      )
    } catch (e) { return <p className="text-red-500 text-xs mt-4">Erro ao processar briefing.</p> }
  }

  const carregarDados = () => {
    axios.get('/api/os').then(res => { 
        setOrdens(res.data || []); setLoading(false)
        if (osDetalhe) { const att = res.data?.find(o => o.id === osDetalhe.id); if (att) setOsDetalhe(att) }
    }).catch(() => setLoading(false))
  }

  const carregarCadastros = async () => {
    try {
      const [resLojas, resClientes, resMedidores] = await Promise.all([
        axios.get('/api/lojas'), axios.get('/api/clientes'), axios.get('/api/medidores')
      ])
      setLojas(resLojas.data); setClientes(resClientes.data); setMedidores(resMedidores.data)
    } catch (error) {}
  }

  useEffect(() => { carregarDados(); carregarCadastros() }, [])

  const deletarOS = async (id) => { if(window.confirm("Cancelar e excluir esta OS?")) { await axios.delete(`/api/os/${id}`); if (osDetalhe?.id === id) setOsDetalhe(null); carregarDados() } }
  const aceitarMedicao = async (osId, medidorId) => { try { await axios.put(`/api/os/${osId}/status`, { medidor_id: parseInt(medidorId), status: "EM_ROTA" }); alert("✅ Rota atualizada!"); carregarDados() } catch (error) { alert("Erro ao transferir.") } }
  const finalizarMedicao = async (os) => { if(window.confirm("Confirmar conclusão? O faturamento será consolidado.")) { await axios.put(`/api/os/${os.id}/status`, { medidor_id: os.medidor_id, status: "CONCLUIDO" }); setOsDetalhe({ ...os, status: "CONCLUIDO" }); carregarDados() } }
  
  const abrirLinkCliente = (token) => {
    window.open(`${window.location.origin}/cliente/${token}`, '_blank')
  }

  const copiarLinkCliente = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/cliente/${token}`).then(() => {
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000)
    })
  }

  const enviarWhatsAppCliente = (os) => {
    const url = `${window.location.origin}/cliente/${os.token}`
    const clienteObj = clientes.find(c => c.nome?.toLowerCase() === os.cliente_nome?.toLowerCase())
    const tel = (clienteObj?.telefone || '').replace(/\D/g, '')
    const msg = encodeURIComponent(`Olá, ${os.cliente_nome}!\n\nSegue o link para autorização e agendamento da medição técnica da sua obra (${os.loja?.nome_fantasia || 'SGM.PRO'}):\n\n🔗 ${url}\n\nPor favor, confirme os ambientes e selecione o melhor dia e horário!`)
    
    let waUrl = `https://api.whatsapp.com/send?text=${msg}`
    if (tel.length >= 10) {
      const ddi = tel.startsWith('55') ? tel : `55${tel}`
      waUrl = `https://api.whatsapp.com/send?phone=${ddi}&text=${msg}`
    }
    window.open(waUrl, '_blank')
  }

  const compartilharLinkCliente = (os) => {
    const url = `${window.location.origin}/cliente/${os.token}`
    if (navigator.share) {
      navigator.share({
        title: `Medição Técnica - ${os.cliente_nome}`,
        text: `Autorização e agendamento da medição técnica (${os.loja?.nome_fantasia || 'SGM.PRO'}):`,
        url: url
      }).catch(() => {})
    } else {
      copiarLinkCliente(os.token)
    }
  }

  const mesesDisponiveis = [...new Set(ordens.map(o => o.criado_em.substring(0,7)))].sort().reverse()
  const formatarMesAno = (m) => { const [ano, mes] = m.split('-'); return `${new Date(ano, mes-1).toLocaleString('pt-BR', {month:'short'}).toUpperCase()}/${ano}` }

  const ordensFiltradas = ordens.filter(os => {
    return (os.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase())) &&
           (filtroStatus === 'TODOS' || os.status === filtroStatus) &&
           (filtroLoja === 'TODAS' || os.loja_id.toString() === filtroLoja) &&
           (filtroMedidor === 'TODOS' || (os.medidor_id && os.medidor_id.toString() === filtroMedidor)) &&
           (filtroMes === 'TODOS' || os.criado_em.substring(0,7) === filtroMes)
  })

  if (loading) return <div className="p-8 text-slate-500 font-mono">Carregando painel...</div>

  return (
    <div className="animate-fade-in flex">
      <div className="flex-1 transition-all duration-300 w-full">
        <header className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div><h1 className="text-3xl font-black text-white">Gestão de Operações</h1><p className="text-slate-500 font-medium mt-1">Controle e distribuição de medições.</p></div>
          <button onClick={() => { setOsParaEditar(null); setIsModalOpen(true) }} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20"><span className="text-xl mr-2">+</span> Nova OS</button>
        </header>

        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Buscar Cliente</label><input type="text" placeholder="Nome do cliente..." className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Mês da OS</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 appearance-none font-bold text-sm" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}><option value="TODOS">Todos os Meses</option>{mesesDisponiveis.map(m => <option key={m} value={m}>{formatarMesAno(m)}</option>)}</select></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Lojista</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 appearance-none font-bold text-sm" value={filtroLoja} onChange={e => setFiltroLoja(e.target.value)}><option value="TODAS">Todas as Lojas</option>{lojas.map(l => <option key={l.id} value={l.id.toString()}>{l.nome_fantasia}</option>)}</select></div>
            <div><label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Medidor Alocado</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 appearance-none font-bold text-sm" value={filtroMedidor} onChange={e => setFiltroMedidor(e.target.value)}><option value="TODOS">Todos Medidores</option>{medidores.map(m => <option key={m} value={m.id.toString()}>{m.nome_completo}</option>)}</select></div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {['TODOS', 'PENDENTE_LOJA', 'EM_ROTA', 'CONCLUIDO'].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${filtroStatus === s ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white bg-slate-900 border border-slate-800'}`}>{s.replace('_', ' ')}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {ordensFiltradas.length === 0 ? ( <div className="col-span-full py-12 md:py-20 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800"><p className="text-slate-500 font-medium">Nenhuma medição encontrada.</p></div> ) : (
            ordensFiltradas.map(os => (
              <OsCard key={os.id} os={os} isActive={osDetalhe?.id === os.id} medidores={medidores} formatarMoeda={formatarMoeda}
                onView={setOsDetalhe} onDelete={deletarOS} onTransfer={aceitarMedicao}
                onEdit={(osData) => { setOsParaEditar(osData); setIsModalOpen(true) }} 
              />
            ))
          )}
        </div>
      </div>

      {osDetalhe && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOsDetalhe(null)}></div>
          <div className="relative w-[90vw] md:w-screen max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in-right overflow-y-auto custom-scrollbar">
            
            <div className="p-5 md:p-8 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex justify-between items-start">
              <div>
                <span className={`px-2 py-1 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest ${osDetalhe.status === 'EM_ROTA' ? 'bg-amber-500/10 text-amber-400' : osDetalhe.status === 'CONCLUIDO' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-500/10 text-slate-400'}`}>{osDetalhe.status.replace('_', ' ')}</span>
                <h2 className="text-xl md:text-2xl font-black text-white mt-2 md:mt-3 mb-1">OS #00{osDetalhe.id}{osDetalhe.urgencia && <span className="ml-2 text-[9px] md:text-[10px] bg-red-500 text-white px-2 py-1 rounded align-middle">URGÊNCIA</span>}</h2>
                <p className="text-slate-500 text-xs md:text-sm">Criada em {new Date(osDetalhe.criado_em).toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={() => setOsDetalhe(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full mt-1">✕</button>
            </div>
            
            <div className="p-5 md:p-8 flex flex-col gap-6 md:gap-8 flex-1">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 md:mb-3">Dados do Cliente</p>
                <div className="bg-slate-950 p-4 md:p-5 rounded-2xl border border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <p className="text-base md:text-lg font-bold text-white leading-tight">{osDetalhe.cliente_nome}</p>
                    {osDetalhe.termos_aceitos && <span className="text-emerald-500 bg-emerald-500/10 text-[10px] px-2 py-1 rounded font-bold inline-block self-start sm:self-auto">✅ Aceito</span>}
                  </div>
                  <div className="flex items-start gap-2 mt-3"><span className="text-slate-600 mt-0.5 text-sm">📍</span><p className="text-slate-400 text-xs md:text-sm leading-relaxed">{osDetalhe.endereco_obra}</p></div>
                </div>
                {osDetalhe.token && (
                  <div className="flex flex-col gap-2 md:gap-3 mt-3">
                    {/* Botão Principal: Abre diretamente a tela do Link Mágico */}
                    <button 
                      onClick={() => abrirLinkCliente(osDetalhe.token)} 
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-black text-xs md:text-sm transition-all shadow-lg shadow-blue-600/20 flex justify-center items-center gap-2"
                    >
                      🔗 Abrir Link do Cliente
                    </button>

                    {/* Ações Rápidas: WhatsApp, Copiar e Compartilhar */}
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => enviarWhatsAppCliente(osDetalhe)} 
                        className="bg-emerald-600/15 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-400 hover:text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1"
                        title="Enviar via WhatsApp"
                      >
                        💬 WhatsApp
                      </button>
                      <button 
                        onClick={() => copiarLinkCliente(osDetalhe.token)} 
                        className={`py-2.5 rounded-xl font-bold text-xs transition-all border flex items-center justify-center gap-1 ${linkCopiado ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`}
                        title="Copiar Link"
                      >
                        {linkCopiado ? "✅ Copiado" : "📋 Copiar"}
                      </button>
                      <button 
                        onClick={() => compartilharLinkCliente(osDetalhe)} 
                        className="bg-sky-600/15 hover:bg-sky-600 border border-sky-500/30 text-sky-400 hover:text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1"
                        title="Compartilhar Link"
                      >
                        📤 Enviar
                      </button>
                    </div>

                    <button onClick={() => gerarPDF(osDetalhe)} className="w-full bg-red-600/10 border border-red-500/30 hover:bg-red-600 hover:text-white text-red-400 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm transition-all flex justify-center items-center gap-2">📄 Gerar PDF (Imprimir)</button>
                  </div>
                )}
              </div>

              {osDetalhe.medidor && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 md:mb-3">Profissional em Campo</p>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-base md:text-lg">{osDetalhe.medidor.nome_completo.substring(0, 2).toUpperCase()}</div>
                    <div><p className="font-bold text-white text-sm md:text-base">{osDetalhe.medidor.nome_completo}</p><p className="text-xs md:text-sm text-slate-400">📱 {osDetalhe.medidor.telefone || 'Sem telefone'}</p></div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 md:mb-3">Ambientes ({osDetalhe.ambientes?.length || 0})</p>
                <div className="space-y-3">
                  {osDetalhe.ambientes?.map((amb, i) => (
                    <div key={amb.id || i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="flex justify-between items-center mb-2"><p className="font-bold text-blue-400 text-sm md:text-base">{amb.nome}</p><span className="text-[10px] md:text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded-md">Risco: {amb.complexidade.toFixed(1)}</span></div>
                      <div className="flex justify-between items-center text-xs md:text-sm text-slate-400"><span>Tipo: {amb.tipo_ambiente}</span><span>Área: {amb.area_estimada_m2} m²</span></div>
                      {(amb.caminho_planta_pdf || amb.CaminhoPlantaPDF) && (<a href={amb.caminho_planta_pdf || amb.CaminhoPlantaPDF} target="_blank" rel="noreferrer" className="mt-3 flex justify-center items-center gap-2 text-[10px] md:text-xs text-blue-400 hover:text-white font-bold bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 p-2 md:p-3 rounded-xl transition-all">📄 Planta Baixa</a>)}
                      {amb.observacoes && <p className="text-[10px] md:text-xs text-slate-500 mt-2 p-2 md:p-3 bg-slate-900/80 rounded-lg border border-slate-800 italic">"{amb.observacoes}"</p>}
                    </div>
                  ))}
                </div>
              </div>

              {renderBriefingCliente(osDetalhe.briefing, osDetalhe.ambientes)}

              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 md:mb-3">Financeiro</p>
                <div className="bg-slate-950 p-4 md:p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center text-xs md:text-sm pb-2 md:pb-3 border-b border-slate-800 border-dashed"><span className="text-slate-500">Deslocamento</span><span className="text-slate-300 font-mono">{formatarMoeda(osDetalhe.taxa_deslocamento)}</span></div>
                  <div className="flex justify-between items-center pt-1 md:pt-2"><span className="text-slate-400 font-bold text-xs md:text-sm">Total da Loja</span><span className="text-base md:text-lg font-black text-blue-400">{formatarMoeda(osDetalhe.valor_total_os)}</span></div>
                  <div className="flex justify-between items-center pb-2 md:pb-3 border-b border-slate-800 border-dashed"><span className="text-slate-500 text-xs md:text-sm">(-) Medidor</span><span className="text-xs md:text-sm font-black text-red-400">-{formatarMoeda(osDetalhe.custo_medidor)}</span></div>
                  <div className="flex justify-between items-center pt-1 md:pt-2"><span className="text-emerald-500 font-black uppercase text-[10px] md:text-xs tracking-widest">Lucro (SGM)</span><span className="text-xl md:text-2xl font-black text-emerald-400">{formatarMoeda(osDetalhe.valor_total_os - osDetalhe.custo_medidor)}</span></div>
                </div>
              </div>

              {osDetalhe.status === 'CONCLUIDO' && osDetalhe.caminho_medicao && (<a href={osDetalhe.caminho_medicao} target="_blank" rel="noreferrer" className="w-full mt-2 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white py-3 md:py-4 rounded-xl text-xs md:text-sm font-bold transition-all flex justify-center items-center gap-2 text-center px-4">📥 Baixar Medição (Upload)</a>)}
              {osDetalhe.status === 'EM_ROTA' && (<div className="mt-4 pb-8"><button onClick={() => finalizarMedicao(osDetalhe)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 md:py-4 rounded-2xl font-black text-sm md:text-lg transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-900/20"><span>✅</span> Faturar OS</button></div>)}
            </div>
          </div>
        </div>
      )}

      <NovaOsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} osParaEditar={osParaEditar} lojas={lojas} clientes={clientes} onSuccess={() => { setIsModalOpen(false); carregarDados() }} />
    </div>
  )
}