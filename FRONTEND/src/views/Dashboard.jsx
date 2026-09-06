import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Dashboard() {
  const [ordens, setOrdens] = useState([])
  const [lojas, setLojas] = useState([])
  const [medidores, setMedidores] = useState([])
  const [loading, setLoading] = useState(true)
  
  // 🔥 OS 3 FILTROS PODEROSOS DO ADMIN 🔥
  const [filtroLoja, setFiltroLoja] = useState('TODAS')
  const [filtroMedidor, setFiltroMedidor] = useState('TODOS')
  const [filtroMes, setFiltroMes] = useState('TODOS')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resOs, resLojas, resMedidores] = await Promise.all([
          axios.get('/api/os'),
          axios.get('/api/lojas'),
          axios.get('/api/medidores')
        ])
        setOrdens(resOs.data)
        setLojas(resLojas.data)
        setMedidores(resMedidores.data)
        setLoading(false)
      } catch (error) { setLoading(false) }
    }
    fetchData()
  }, [])

  const formatarMoeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ==========================================
  // GERADOR AUTOMÁTICO DE MESES DISPONÍVEIS
  // ==========================================
  const mesesDisponiveis = [...new Set(ordens.map(o => {
    const d = new Date(o.criado_em)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }))].sort().reverse() // Ordena do mais recente para o mais antigo

  const formatarMesAno = (mesAnoStr) => {
    const [ano, mes] = mesAnoStr.split('-')
    const data = new Date(ano, mes - 1)
    const nomeMes = data.toLocaleString('pt-BR', { month: 'long' })
    return `${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}/${ano}`
  }

  // ==========================================
  // APLICAÇÃO DOS 3 FILTROS COMBINADOS
  // ==========================================
  const ordensFiltradas = ordens.filter(os => {
    // Filtro 1: Loja
    const passaLoja = filtroLoja === 'TODAS' || os.loja_id.toString() === filtroLoja
    
    // Filtro 2: Medidor
    const passaMedidor = filtroMedidor === 'TODOS' || (os.medidor_id && os.medidor_id.toString() === filtroMedidor)
    
    // Filtro 3: Mês
    const d = new Date(os.criado_em)
    const mesAnoOS = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const passaMes = filtroMes === 'TODOS' || mesAnoOS === filtroMes

    return passaLoja && passaMedidor && passaMes
  })

  // Cálculos Financeiros e Contábeis (Sobre as ordens filtradas)
  const gmvTotal = ordensFiltradas.reduce((acc, os) => acc + os.valor_total_os, 0)
  const repasseMedidores = ordensFiltradas.reduce((acc, os) => acc + os.custo_medidor, 0)
  const margemIntermediacaoSGM = gmvTotal - repasseMedidores
  const takeRateMedio = gmvTotal > 0 ? (margemIntermediacaoSGM / gmvTotal) * 100 : 0
  const ticketMedioGMV = ordensFiltradas.length > 0 ? gmvTotal / ordensFiltradas.length : 0
  const ticketMedioSGM = ordensFiltradas.length > 0 ? margemIntermediacaoSGM / ordensFiltradas.length : 0
  
  const concluidas = ordensFiltradas.filter(os => os.status === 'CONCLUIDO').length
  const emAndamento = ordensFiltradas.length - concluidas
  const urgencias = ordensFiltradas.filter(os => os.urgencia).length

  if (loading) return <div className="p-4 md:p-8 text-slate-500 font-mono">Carregando métricas...</div>

  return (
    <div className="animate-fade-in">
      <header className="mb-6 border-b border-slate-800 pb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white">Business Intelligence</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm md:text-base">Métricas operacionais, financeiras e contábeis do marketplace.</p>
        
        {/* BARRA DE FILTROS INTELIGENTE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 bg-slate-900/50 p-3 md:p-4 rounded-2xl border border-slate-800">
          
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">📅 Filtrar por Mês</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-blue-400 outline-none focus:border-blue-500 appearance-none font-bold text-sm" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
              <option value="TODOS">Todos os Meses</option>
              {mesesDisponiveis.map(m => <option key={m} value={m}>{formatarMesAno(m)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">🏢 Unidade / Rede de Lojas</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-blue-400 outline-none focus:border-blue-500 appearance-none font-bold text-sm" value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)}>
              <option value="TODAS">Todas as Lojas & Redes</option>
              {lojas.map(l => (
                <option key={l.id} value={l.id.toString()}>
                  {l.nome_fantasia} {l.nome_rede ? `• [Rede: ${l.nome_rede}]` : ''} {l.eh_matriz ? '⭐ (Matriz)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">🛵 Filtrar por Medidor</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-emerald-400 outline-none focus:border-emerald-500 appearance-none font-bold text-sm" value={filtroMedidor} onChange={(e) => setFiltroMedidor(e.target.value)}>
              <option value="TODOS">Todos os Medidores</option>
              {medidores.map(m => <option key={m.id} value={m.id.toString()}>{m.nome_completo}</option>)}
            </select>
          </div>

        </div>
      </header>

      {/* LINHA 1: RESULTADOS FINANCEIROS E CONTÁBEIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl md:text-5xl opacity-20">💳</div>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">GMV Transacionado (Total OSs)</p>
          <p className="text-3xl md:text-4xl font-black text-white">{formatarMoeda(gmvTotal)}</p>
          <p className="text-xs text-slate-400 mt-2 font-bold">Volume bruto intermediado</p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl md:text-5xl opacity-20">🛵</div>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Repasse aos Medidores</p>
          <p className="text-3xl md:text-4xl font-black text-red-400">-{formatarMoeda(repasseMedidores)}</p>
          <p className="text-xs text-red-400/80 mt-2 font-bold">Remuneração técnica direta</p>
        </div>
        
        <div className="bg-slate-900 border border-emerald-900/50 p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl md:text-5xl opacity-20">📈</div>
          <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest mb-1">Margem de Intermediação (SGM)</p>
          <p className="text-3xl md:text-4xl font-black text-emerald-400">{formatarMoeda(margemIntermediacaoSGM)}</p>
          <div className="flex items-center justify-between text-xs text-emerald-500/80 mt-2 font-bold">
            <span>Take-Rate Efetivo: {takeRateMedio.toFixed(1)}%</span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">Base NFS-e</span>
          </div>
        </div>
      </div>

      {/* LINHA 2: INDICADORES OPERACIONAIS E UNIT ECONOMICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total de OS</p>
          <p className="text-2xl md:text-3xl font-black text-blue-400">{ordensFiltradas.length}</p>
          <p className="text-[10px] text-slate-400 mt-1">{concluidas} concluídas ({emAndamento} em rota)</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Take-Rate SGM</p>
          <p className="text-2xl md:text-3xl font-black text-emerald-400">{takeRateMedio.toFixed(1)}%</p>
          <p className="text-[10px] text-slate-400 mt-1">Margem média / OS</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Ticket Médio (GMV)</p>
          <p className="text-2xl md:text-3xl font-black text-white">{formatarMoeda(ticketMedioGMV)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Valor médio por OS</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl col-span-2 md:col-span-1">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Ticket Médio (SGM)</p>
          <p className="text-2xl md:text-3xl font-black text-emerald-400">{formatarMoeda(ticketMedioSGM)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Spread médio capturado</p>
        </div>
      </div>

      {/* LINHA 3: TABELA DE AUDITORIA E CAIXA 100% TRANSPARENTE */}
      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>🔍</span> Auditoria de Caixa Transparente (Split por OS)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Discriminação de cada centavo transacionado: Mão de Obra, Adicional de Urgência, Deslocamento e Margem SGM.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            {ordensFiltradas.length} Registro(s) no Período
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className="bg-slate-950/60 text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-800">
              <tr>
                <th className="p-3">OS</th>
                <th className="p-3">Cliente / Loja</th>
                <th className="p-3">Profissional</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">GMV (Loja)</th>
                <th className="p-3 text-right">Mão de Obra</th>
                <th className="p-3 text-right">Urgência</th>
                <th className="p-3 text-right">Deslocamento</th>
                <th className="p-3 text-right text-red-400">Total Medidor</th>
                <th className="p-3 text-right text-emerald-400">Margem SGM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-xs">
              {ordensFiltradas.map(os => {
                const maoDeObra = os.mao_de_obra_medidor || (os.custo_medidor - os.taxa_deslocamento - (os.adicional_urgencia || 0))
                const adicionalUrg = os.adicional_urgencia || ((os.urgencia && maoDeObra > 0) ? maoDeObra * 0.5 : 0)
                const margem = os.valor_total_os - os.custo_medidor
                const takeRate = os.valor_total_os > 0 ? (margem / os.valor_total_os) * 100 : 0

                return (
                  <tr key={os.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-400">#{String(os.id).padStart(4, '0')}</td>
                    <td className="p-3">
                      <p className="font-bold text-white">{os.cliente_nome}</p>
                      <p className="text-[10px] text-blue-400 uppercase font-black tracking-wider">{os.loja?.nome_fantasia || 'Loja'}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-slate-300 font-medium">{os.medidor?.nome_completo || <span className="text-amber-500">Aguardando</span>}</p>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${os.status === 'CONCLUIDO' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {os.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-white">{formatarMoeda(os.valor_total_os)}</td>
                    <td className="p-3 text-right font-mono text-slate-300">{formatarMoeda(maoDeObra)}</td>
                    <td className="p-3 text-right font-mono">
                      {(os.urgencia || adicionalUrg > 0) ? (
                        <span className="text-amber-400 font-bold">+{formatarMoeda(adicionalUrg)}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-300">
                      <span>+{formatarMoeda(os.taxa_deslocamento)}</span>
                      {os.km_deslocamento > 0 && (
                        <span className="block text-[9px] text-slate-500 font-sans">
                          🚗 {os.km_deslocamento}km ({os.tempo_deslocamento_min}m)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-red-400">-{formatarMoeda(os.custo_medidor)}</td>
                    <td className="p-3 text-right font-mono">
                      <span className="font-bold text-emerald-400">{formatarMoeda(margem)}</span>
                      <span className="block text-[10px] text-slate-500">({takeRate.toFixed(1)}%)</span>
                    </td>
                  </tr>
                )
              })}
              {ordensFiltradas.length === 0 && (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-slate-500">
                    Nenhuma ordem de serviço encontrada nos filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {urgencias > 0 && (
        <div className="mt-6 md:mt-8 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-3xl">🚨</span>
          <div>
            <p className="text-red-400 font-black">Atenção Operacional</p>
            <p className="text-xs md:text-sm text-red-500/80">Você tem {urgencias} solicitação(ões) de Urgência filtradas no radar.</p>
          </div>
        </div>
      )}
    </div>
  )
}