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

  // Cálculos Financeiros (Sobre as ordens filtradas)
  const faturamentoTotalLojas = ordensFiltradas.reduce((acc, os) => acc + os.valor_total_os, 0)
  const custoTotalMedidores = ordensFiltradas.reduce((acc, os) => acc + os.custo_medidor, 0)
  const lucroLiquidoReal = faturamentoTotalLojas - custoTotalMedidores
  const ticketMedio = ordensFiltradas.length > 0 ? faturamentoTotalLojas / ordensFiltradas.length : 0
  
  const concluidas = ordensFiltradas.filter(os => os.status === 'CONCLUIDO').length
  const emAndamento = ordensFiltradas.length - concluidas
  const urgencias = ordensFiltradas.filter(os => os.urgencia).length

  if (loading) return <div className="p-4 md:p-8 text-slate-500 font-mono">Carregando métricas...</div>

  return (
    <div className="animate-fade-in">
      <header className="mb-6 border-b border-slate-800 pb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white">Business Intelligence</h1>
        <p className="text-slate-500 font-medium mt-1 text-sm md:text-base">Acompanhamento financeiro global e filtrado.</p>
        
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
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">🏢 Filtrar por Loja</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-blue-400 outline-none focus:border-blue-500 appearance-none font-bold text-sm" value={filtroLoja} onChange={(e) => setFiltroLoja(e.target.value)}>
              <option value="TODAS">Todas as Lojas</option>
              {lojas.map(l => <option key={l.id} value={l.id.toString()}>{l.nome_fantasia}</option>)}
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

      {/* LINHA 1: RESULTADOS FINANCEIROS REAIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl md:text-5xl ">🏢</div>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Receita Lojas (Entrada)</p>
          <p className="text-3xl md:text-4xl font-black text-white">{formatarMoeda(faturamentoTotalLojas)}</p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl md:text-5xl ">🛵</div>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Custo Medidores (Saída)</p>
          <p className="text-3xl md:text-4xl font-black text-red-400">-{formatarMoeda(custoTotalMedidores)}</p>
        </div>
        
        <div className="bg-slate-900 border border-emerald-900/50 p-5 md:p-6 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 text-4xl md:text-5xl ">📈</div>
          <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest mb-1">Lucro Líquido (SGM)</p>
          <p className="text-3xl md:text-4xl font-black text-emerald-400">{formatarMoeda(lucroLiquidoReal)}</p>
          <p className="text-xs text-emerald-500/70 mt-2 font-bold">
            Margem Real: {faturamentoTotalLojas > 0 ? ((lucroLiquidoReal / faturamentoTotalLojas) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* LINHA 2: INDICADORES OPERACIONAIS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total de OS</p>
          <p className="text-2xl md:text-3xl font-black text-blue-400">{ordensFiltradas.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Concluídas</p>
          <p className="text-2xl md:text-3xl font-black text-emerald-400">{concluidas}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Em Fila / Rota</p>
          <p className="text-2xl md:text-3xl font-black text-amber-400">{emAndamento}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-xl col-span-2 md:col-span-1">
          <p className="text-[9px] md:text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Ticket Médio (Loja)</p>
          <p className="text-2xl md:text-3xl font-black text-white">{formatarMoeda(ticketMedio)}</p>
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