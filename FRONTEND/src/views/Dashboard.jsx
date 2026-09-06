import { useEffect, useState } from 'react'
import axios from 'axios'

export default function Dashboard({ perfil = 'ADMIN' }) {
  const [ordens, setOrdens] = useState([])
  const [lojas, setLojas] = useState([])
  const [medidores, setMedidores] = useState([])
  const [dadosAnuais, setDadosAnuais] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // 🔥 FILTROS DE ANO, MÊS, LOJA E MEDIDOR 🔥
  const [filtroAno, setFiltroAno] = useState('2026')
  const [filtroMes, setFiltroMes] = useState('TODOS')
  const [filtroLoja, setFiltroLoja] = useState('TODAS')
  const [filtroMedidor, setFiltroMedidor] = useState('TODOS')

  const mesesNomes = [
    { num: '01', nome: 'Janeiro' },
    { num: '02', nome: 'Fevereiro' },
    { num: '03', nome: 'Março' },
    { num: '04', nome: 'Abril' },
    { num: '05', nome: 'Maio' },
    { num: '06', nome: 'Junho' },
    { num: '07', nome: 'Julho' },
    { num: '08', nome: 'Agosto' },
    { num: '09', nome: 'Setembro' },
    { num: '10', nome: 'Outubro' },
    { num: '11', nome: 'Novembro' },
    { num: '12', nome: 'Dezembro' }
  ]

  const anosDisponiveis = ['TODOS', '2026', '2025']

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [resOs, resLojas, resMedidores, resAnual] = await Promise.all([
        axios.get(`/api/os?ano=${filtroAno}&mes=${filtroMes}`),
        axios.get('/api/lojas'),
        axios.get('/api/medidores'),
        axios.get(`/api/estatisticas/anual?ano=${filtroAno === 'TODOS' ? '2026' : filtroAno}`)
      ])
      setOrdens(resOs.data || [])
      setLojas(resLojas.data || [])
      setMedidores(resMedidores.data || [])
      setDadosAnuais(resAnual.data || null)
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [filtroAno, filtroMes])

  const formatarMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ==========================================
  // FILTRAGEM DE ORDENS
  // ==========================================
  const ordensFiltradas = ordens.filter(os => {
    const passaLoja = filtroLoja === 'TODAS' || os.loja_id.toString() === filtroLoja
    const passaMedidor = filtroMedidor === 'TODOS' || (os.medidor_id && os.medidor_id.toString() === filtroMedidor)
    return passaLoja && passaMedidor
  })

  // Cálculos Financeiros Consolidados
  const faturamentoTotalLojas = ordensFiltradas.reduce((acc, os) => acc + (os.valor_total_os || 0), 0)
  const faturamentoMedidores = ordensFiltradas.reduce((acc, os) => acc + (os.custo_medidor || 0), 0)
  const lucroLiquidoSistema = faturamentoTotalLojas - faturamentoMedidores
  const ticketMedio = ordensFiltradas.length > 0 ? faturamentoTotalLojas / ordensFiltradas.length : 0
  
  const concluidas = ordensFiltradas.filter(os => os.status === 'CONCLUIDO').length
  const emAndamento = ordensFiltradas.length - concluidas
  const urgencias = ordensFiltradas.filter(os => os.urgencia).length

  // Comparativo de Economia com Terceirização (Custo equivalente de equipe própria CLT)
  // R$ 580/medição incluindo veículo, combustível, salário base R$ 2.800, 70% encargos, seguro e ociosidade
  const custoCLTEstimado = ordensFiltradas.length * 580.0
  const economiaGerada = Math.max(0, custoCLTEstimado - faturamentoTotalLojas)
  const percentualEconomia = custoCLTEstimado > 0 ? ((economiaGerada / custoCLTEstimado) * 100).toFixed(1) : '0'

  if (loading && ordens.length === 0) return <div className="p-4 md:p-8 text-slate-500 font-mono">Carregando métricas e histórico anual...</div>

  return (
    <div className="animate-fade-in pb-12">
      <header className="mb-6 border-b border-slate-800 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {perfil === 'LOJA' ? 'Resultados Financeiros & Economia' : 'Business Intelligence & Performance Anual'}
            </h1>
            <p className="text-slate-500 font-medium mt-1 text-sm md:text-base">
              {perfil === 'LOJA' 
                ? 'Monitore seus gastos com medição e a economia obtida ao terceirizar com a rede SGM.PRO.' 
                : 'Acompanhamento integrado de faturamento, repasses a medidores e economia das lojas.'}
            </p>
          </div>
          <button 
            onClick={carregarDados} 
            className="self-start md:self-auto bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            🔄 Atualizar Indicadores
          </button>
        </div>
        
        {/* BARRA DE FILTROS: ANO, MÊS, LOJA, MEDIDOR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-6 bg-slate-900/60 p-4 rounded-2xl border border-slate-800 shadow-xl">
          
          {/* FILTRO 1: ANO */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">🗓️ Ano de Referência</label>
            <select 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 font-bold text-sm" 
              value={filtroAno} 
              onChange={(e) => setFiltroAno(e.target.value)}
            >
              {anosDisponiveis.map(a => <option key={a} value={a}>{a === 'TODOS' ? 'Todos os Anos' : `Ano ${a}`}</option>)}
            </select>
          </div>

          {/* FILTRO 2: MÊS */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">📅 Mês do Ano</label>
            <select 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-blue-400 outline-none focus:border-blue-500 font-bold text-sm" 
              value={filtroMes} 
              onChange={(e) => setFiltroMes(e.target.value)}
            >
              <option value="TODOS">Todos os Meses</option>
              {mesesNomes.map(m => <option key={m.num} value={m.num}>{m.num} - {m.nome}</option>)}
            </select>
          </div>

          {/* FILTRO 3: LOJA OU REDE */}
          {(perfil === 'ADMIN' || lojas.length > 1) && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">🏢 Unidade / Rede de Lojas</label>
              <select 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-amber-400 outline-none focus:border-blue-500 font-bold text-sm" 
                value={filtroLoja} 
                onChange={(e) => setFiltroLoja(e.target.value)}
              >
                <option value="TODAS">Todas as Lojas & Redes ({lojas.length})</option>
                {lojas.map(l => (
                  <option key={l.id} value={l.id.toString()}>
                    {l.nome_fantasia} {l.nome_rede ? `• [Rede: ${l.nome_rede}]` : ''} {l.eh_matriz ? '⭐ (Matriz)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* FILTRO 4: MEDIDOR */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">👷 Filtrar Medidor</label>
            <select 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-emerald-400 outline-none focus:border-blue-500 font-bold text-sm" 
              value={filtroMedidor} 
              onChange={(e) => setFiltroMedidor(e.target.value)}
            >
              <option value="TODOS">Todos os Medidores ({medidores.length})</option>
              {medidores.map(m => <option key={m.id} value={m.id.toString()}>{m.nome_completo}</option>)}
            </select>
          </div>

        </div>
      </header>

      {/* LINHA 1: CARD DE DESTAQUE - ECONOMIA GERADA PELA TERCEIRIZAÇÃO */}
      <div className="mb-8 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-blue-950/70 border border-emerald-500/40 p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 text-8xl md:text-9xl opacity-10 select-none pointer-events-none">💰</div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              💡 Business Case: Terceirização Inteligente
            </span>
            <h2 className="text-xl md:text-2xl font-black text-white mt-3">
              Economia Estimada ao Contratar o SGM.PRO
            </h2>
            <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-2xl">
              Comparativo direto contra equipe própria interna CLT (salário fixo + 70% encargos trabalhistas + frota de veículos/combustível + equipamentos e seguro).
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end shrink-0 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Economia Líquida Gerada</span>
            <p className="text-3xl md:text-4xl font-black text-emerald-400 font-mono mt-0.5">
              {formatarMoeda(economiaGerada)}
            </p>
            <span className="text-xs font-black text-emerald-300 mt-1 bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-700/50">
              ⚡ {percentualEconomia}% de Redução de Custos
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Custo Projetado com CLT Próprio</p>
            <p className="text-xl font-bold text-slate-300 font-mono mt-1">{formatarMoeda(custoCLTEstimado)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Salários, encargos, combustível e frota</p>
          </div>
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Investimento Real no SGM.PRO</p>
            <p className="text-xl font-bold text-blue-400 font-mono mt-1">{formatarMoeda(faturamentoTotalLojas)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Pagamento sob demanda por medição executada</p>
          </div>
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Eliminação de Passivos</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-1">Zero Risco Trabalhista</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Sem ociosidade nem encargos de rescisão</p>
          </div>
        </div>
      </div>

      {/* LINHA 2: FATURAMENTO DAS LOJAS, MEDIDORES E SISTEMA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        
        {/* DESPESA DAS LOJAS */}
        <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl opacity-20">🏢</div>
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">
            {perfil === 'LOJA' ? 'Minha Despesa com Medições' : 'Despesa Total das Lojas (Entrada)'}
          </p>
          <p className="text-2xl md:text-3xl font-black text-white font-mono">{formatarMoeda(faturamentoTotalLojas)}</p>
          <p className="text-xs text-slate-500 mt-2">
            Valor total faturado em {ordensFiltradas.length} medições no período
          </p>
        </div>
        
        {/* FATURAMENTO DOS MEDIDORES */}
        <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl opacity-20">👷</div>
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">
            Faturamento dos Medidores (Repasse)
          </p>
          <p className="text-2xl md:text-3xl font-black text-emerald-400 font-mono">{formatarMoeda(faturamentoMedidores)}</p>
          <p className="text-xs text-slate-500 mt-2">
            Total repassado aos técnicos por mão de obra e deslocamento
          </p>
        </div>
        
        {/* FATURAMENTO DO SISTEMA SGM.PRO */}
        <div className="bg-slate-900 border border-blue-900/50 p-5 md:p-6 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl opacity-20">⚡</div>
          <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest mb-1">
            Faturamento do Sistema (Margem SGM.PRO)
          </p>
          <p className="text-2xl md:text-3xl font-black text-blue-400 font-mono">{formatarMoeda(lucroLiquidoSistema)}</p>
          <p className="text-xs text-blue-400/70 mt-2 font-bold">
            Margem Líquida da Plataforma: {faturamentoTotalLojas > 0 ? ((lucroLiquidoSistema / faturamentoTotalLojas) * 100).toFixed(1) : 0}%
          </p>
        </div>

      </div>

      {/* LINHA 3: INDICADORES OPERACIONAIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Volume de OS</p>
          <p className="text-2xl font-black text-blue-400 font-mono">{ordensFiltradas.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Medições Concluídas</p>
          <p className="text-2xl font-black text-emerald-400 font-mono">{concluidas}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Em Fila / Rota</p>
          <p className="text-2xl font-black text-amber-400 font-mono">{emAndamento}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Ticket Médio por OS</p>
          <p className="text-2xl font-black text-white font-mono">{formatarMoeda(ticketMedio)}</p>
        </div>
      </div>

      {/* LINHA 4: TABELA ANALÍTICA DE EVOLUÇÃO MÊS A MÊS DO ANO */}
      {dadosAnuais && dadosAnuais.meses && dadosAnuais.meses.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-lg md:text-xl font-black text-white">Evolução Mensal do Faturamento & Economia ({filtroAno})</h2>
              <p className="text-xs text-slate-500">Acompanhamento consolidado mês a mês das medições, despesas das lojas e repasses.</p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 self-start md:self-auto">
              Total no Ano: {formatarMoeda(dadosAnuais.faturamento_total_lojas)}
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="pb-3 px-3">Mês</th>
                  <th className="pb-3 px-3">Medições (OS)</th>
                  <th className="pb-3 px-3">Despesa Lojas</th>
                  <th className="pb-3 px-3">Faturamento Medidores</th>
                  <th className="pb-3 px-3">Margem SGM.PRO</th>
                  <th className="pb-3 px-3 text-right">Economia vs CLT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono text-xs">
                {dadosAnuais.meses.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-white">{m.mes}</td>
                    <td className="py-3 px-3 text-slate-300">{m.total_os.toLocaleString()}</td>
                    <td className="py-3 px-3 text-white font-bold">{formatarMoeda(m.faturamento_lojas)}</td>
                    <td className="py-3 px-3 text-emerald-400">{formatarMoeda(m.repasse_medidores)}</td>
                    <td className="py-3 px-3 text-blue-400">{formatarMoeda(m.lucro_sgm)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-emerald-400 font-bold">{formatarMoeda(m.economia_loja)}</span>
                      <span className="text-[10px] text-emerald-500/80 block">({m.percentual_economia}%)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {urgencias > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-4">
          <span className="text-3xl">🚨</span>
          <div>
            <p className="text-red-400 font-black">Atenção Operacional</p>
            <p className="text-xs md:text-sm text-red-500/80">Você tem {urgencias} solicitação(ões) de Urgência registradas no período selecionado.</p>
          </div>
        </div>
      )}
    </div>
  )
}
