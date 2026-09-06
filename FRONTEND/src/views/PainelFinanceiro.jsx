import { useState, useEffect } from 'react'
import axios from 'axios'
import ModalAuditoriaFinanceira from '../components/ModalAuditoriaFinanceira'

export default function PainelFinanceiro({ onVoltar }) {
  const [abaAtiva, setAbaAtiva] = useState('lotes') // 'lotes' | 'fluxo' | 'livro' | 'compliance'
  const [lotes, setLotes] = useState([])
  const [fluxoCaixa, setFluxoCaixa] = useState(null)
  const [lancamentos, setLancamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [gerandoLotes, setGerandoLotes] = useState(false)

  // Filtros de Lotes
  const [filtroStatus, setFiltroStatus] = useState('')
  const [buscaMedidor, setBuscaMedidor] = useState('')

  // Modal de Auditoria
  const [loteSelecionadoId, setLoteSelecionadoId] = useState(null)
  const [modalAuditoriaAberto, setModalAuditoriaAberto] = useState(false)

  // Modal Novo Lançamento Manual
  const [modalNovoLancamento, setModalNovoLancamento] = useState(false)
  const [novoTipo, setNovoTipo] = useState('SAIDA')
  const [novaCategoria, setNovaCategoria] = useState('DESPESA_OPERACIONAL')
  const [novoValor, setNovoValor] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')

  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [resLotes, resFluxo, resLanc] = await Promise.all([
        axios.get('/api/fechamentos'),
        axios.get('/api/financeiro/fluxo-caixa'),
        axios.get('/api/financeiro/lancamentos')
      ])
      setLotes(resLotes.data || [])
      setFluxoCaixa(resFluxo.data || null)
      setLancamentos(resLanc.data || [])
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAbrirAuditoria = (id) => {
    setLoteSelecionadoId(id)
    setModalAuditoriaAberto(true)
  }

  const handleLoteAtualizado = () => {
    carregarDados()
  }

  const handleGerarAutomatico = async () => {
    if (!window.confirm('Deseja compilar e gerar os lotes de fechamento automaticamente para todas as medições concluídas do ciclo?')) return
    setGerandoLotes(true)
    try {
      const res = await axios.post('/api/fechamentos/gerar-automatico')
      alert(res.data?.mensagem || 'Lotes compilados com sucesso!')
      carregarDados()
    } catch (err) {
      alert('Erro ao gerar lotes automáticos: ' + (err.response?.data?.erro || err.message))
    } finally {
      setGerandoLotes(false)
    }
  }

  const salvarLancamentoManual = async (e) => {
    e.preventDefault()
    if (!novoValor || !novaDescricao) return

    try {
      await axios.post('/api/financeiro/lancamentos', {
        tipo: novoTipo,
        categoria: novaCategoria,
        valor: parseFloat(novoValor),
        descricao: novaDescricao,
        forma_pagamento: 'PIX',
        status: 'REALIZADO'
      })
      alert('✓ Lançamento registrado com sucesso no Livro Caixa!')
      setModalNovoLancamento(false)
      setNovoValor('')
      setNovaDescricao('')
      carregarDados()
    } catch (err) {
      alert('Erro ao criar lançamento.')
    }
  }

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  // Filtragem dos lotes
  const lotesFiltrados = lotes.filter(l => {
    const matchStatus = filtroStatus ? l.status === filtroStatus : true
    const matchBusca = buscaMedidor 
      ? (l.medidor?.nome_completo?.toLowerCase().includes(buscaMedidor.toLowerCase()) || 
         l.numero_lote?.toLowerCase().includes(buscaMedidor.toLowerCase()))
      : true
    return matchStatus && matchBusca
  })

  // KPIs
  const totalPendente = lotes
    .filter(l => l.status !== 'PAGO' && l.status !== 'RECUSADO')
    .reduce((acc, l) => acc + l.valor_liquido, 0)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      
      {/* Header Superior */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏦</span>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                  Painel Financeiro & Contábil
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Gestão de Lotes de Medidores, Fluxo de Caixa (DRE) e Conformidade CLT / Tributária
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a 
              href="/api/financeiro/exportar-contabil"
              target="_blank"
              rel="noreferrer"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
            >
              📥 Exportar Relatório Contábil (CSV)
            </a>
            {onVoltar && (
              <button
                onClick={onVoltar}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
              >
                ← Voltar ao Sistema
              </button>
            )}
          </div>
        </div>

        {/* 4 Cards de Resumo Financeiro (KPIs) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Receitas Totais (Lojas)</span>
            <p className="text-2xl font-black text-white font-mono mt-1">
              {formatarMoeda(fluxoCaixa?.total_entradas)}
            </p>
            <span className="text-[10px] text-emerald-400 font-bold block mt-1">Faturamento Bruto</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Repasses Medidores (Saídas)</span>
            <p className="text-2xl font-black text-red-400 font-mono mt-1">
              - {formatarMoeda(fluxoCaixa?.total_saidas)}
            </p>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">Mão de Obra + Deslocamento</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Margem Líquida SGM</span>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {formatarMoeda(fluxoCaixa?.lucro_liquido)}
            </p>
            <span className="text-[10px] text-emerald-400 font-bold block mt-1">
              {fluxoCaixa?.margem_percentual || 0}% de Margem Operacional
            </span>
          </div>

          <div className="bg-amber-950/20 border border-amber-500/30 p-5 rounded-3xl shadow-xl">
            <span className="text-[10px] uppercase font-black tracking-widest text-amber-400">Lotes a Pagar (Abertos)</span>
            <p className="text-2xl font-black text-amber-400 font-mono mt-1">
              {formatarMoeda(totalPendente)}
            </p>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">Aguardando Auditoria/PIX</span>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
          <button
            onClick={() => setAbaAtiva('lotes')}
            className={`py-3 px-5 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              abaAtiva === 'lotes' 
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-2xl' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>📋</span> Lotes de Fechamento ({lotes.length})
          </button>
          <button
            onClick={() => setAbaAtiva('fluxo')}
            className={`py-3 px-5 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              abaAtiva === 'fluxo' 
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-2xl' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>📈</span> Fluxo de Caixa & DRE
          </button>
          <button
            onClick={() => setAbaAtiva('livro')}
            className={`py-3 px-5 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              abaAtiva === 'livro' 
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-2xl' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>📖</span> Livro Caixa ({lancamentos.length})
          </button>
          <button
            onClick={() => setAbaAtiva('compliance')}
            className={`py-3 px-5 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              abaAtiva === 'compliance' 
                ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-2xl' 
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <span>⚖️</span> Conformidade Trabalhista & CLT
          </button>
        </div>

        {/* ABA 1: LOTES DE FECHAMENTO */}
        {abaAtiva === 'lotes' && (
          <div className="space-y-4">
            
            {/* Filtros de Lote */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex flex-1 gap-3 w-full">
                <input 
                  type="text"
                  placeholder="Buscar por Medidor ou Protocolo do Lote..."
                  value={buscaMedidor}
                  onChange={(e) => setBuscaMedidor(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white text-xs flex-1 outline-none focus:border-blue-500"
                />
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-blue-500"
                >
                  <option value="">Todos os Status</option>
                  <option value="ENVIADO_CONFERENCIA">Em Conferência</option>
                  <option value="APROVADO">Aprovado p/ Pagamento</option>
                  <option value="PAGO">Pago (Quitação Plena)</option>
                  <option value="RECUSADO">Recusado</option>
                </select>
              </div>

              <button
                onClick={handleGerarAutomatico}
                disabled={gerandoLotes}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 whitespace-nowrap transition-all"
                title="Consolida automaticamente todas as OSs concluídas do mês em lotes mensais com vencimento no 5º dia útil"
              >
                <span>{gerandoLotes ? '⏳ Compilando...' : '⚡ Compilar Lotes do Mês'}</span>
              </button>
            </div>

            {/* Tabela de Lotes */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[950px] text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase font-black tracking-widest text-slate-400">
                  <tr>
                    <th className="p-4">Lote / Data</th>
                    <th className="p-4">Medidor Parceiro</th>
                    <th className="p-4">Período</th>
                    <th className="p-4 text-center">OSs</th>
                    <th className="p-4 text-right">Valor Bruto</th>
                    <th className="p-4 text-right">Retenções</th>
                    <th className="p-4 text-right">Valor Líquido</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {lotesFiltrados.length > 0 ? (
                    lotesFiltrados.map((lote) => {
                      const isPago = lote.status === 'PAGO'
                      const isAprovado = lote.status === 'APROVADO'

                      return (
                        <tr key={lote.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-mono">
                            <span className="font-bold text-white block">{lote.numero_lote}</span>
                            <span className="text-[10px] text-slate-500">{new Date(lote.criado_em).toLocaleDateString('pt-BR')}</span>
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-200">{lote.medidor?.nome_completo}</p>
                            <p className="text-[10px] text-slate-500 font-mono">PIX: {lote.chave_pix || 'N/A'}</p>
                          </td>
                          <td className="p-4 text-slate-400 font-mono text-[11px]">
                            {new Date(lote.periodo_inicio).toLocaleDateString('pt-BR')} a {new Date(lote.periodo_fim).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="p-4 text-center font-bold text-slate-300">
                            {lote.quantidade_os}
                          </td>
                          <td className="p-4 text-right font-mono text-slate-300">
                            {formatarMoeda(lote.valor_bruto)}
                          </td>
                          <td className="p-4 text-right font-mono text-amber-400">
                            {lote.valor_retencoes_impostos > 0 ? `- ${formatarMoeda(lote.valor_retencoes_impostos)}` : '-'}
                          </td>
                          <td className="p-4 text-right font-mono font-black text-emerald-400 text-sm">
                            {formatarMoeda(lote.valor_liquido)}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isPago ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                              isAprovado ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {lote.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleAbrirAuditoria(lote.id)}
                              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-700 transition-all"
                            >
                              {isPago ? 'Ver Detalhes' : 'Auditar & Pagar'}
                            </button>
                            {isPago && (
                              <a
                                href={`/api/fechamentos/${lote.id}/termo-quitacao`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-blue-900/60 hover:bg-blue-800 text-blue-300 font-bold text-xs px-2.5 py-1.5 rounded-xl transition-all inline-block"
                              >
                                📄 Quitação
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan="9" className="p-12 text-center text-slate-500">
                        Nenhum lote de fechamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 2: FLUXO DE CAIXA & DRE */}
        {abaAtiva === 'fluxo' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black text-white">Demonstrativo de Resultados do Exercício (DRE) • {fluxoCaixa?.ano}</h3>
                  <p className="text-xs text-slate-400">Visão consolidada mês a mês de entradas, saídas e resultado operacional</p>
                </div>
              </div>

              {/* Grid dos 12 meses */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                {fluxoCaixa?.grafico_mensal?.map((m, idx) => {
                  const isPositivo = m.saldo >= 0
                  return (
                    <div key={idx} className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{m.mes}</span>
                      <div className="space-y-1 font-mono text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-[10px] text-slate-500">Entradas:</span>
                          <span>{formatarMoeda(m.entradas)}</span>
                        </div>
                        <div className="flex justify-between text-red-400">
                          <span className="text-[10px] text-slate-500">Saídas:</span>
                          <span>- {formatarMoeda(m.saidas)}</span>
                        </div>
                        <div className={`flex justify-between font-black pt-1 border-t border-slate-800 ${isPositivo ? 'text-emerald-400' : 'text-red-500'}`}>
                          <span className="text-[10px] uppercase">Saldo:</span>
                          <span>{formatarMoeda(m.saldo)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: LIVRO CAIXA & LANÇAMENTOS */}
        {abaAtiva === 'livro' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-black text-white">Lançamentos Financeiros (Livro Caixa)</h3>
                <p className="text-xs text-slate-400">Registro analítico das movimentações bancárias</p>
              </div>
              <button
                onClick={() => setModalNovoLancamento(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
              >
                + Novo Lançamento Manual
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px] text-xs">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[10px] uppercase font-black tracking-widest text-slate-400">
                  <tr>
                    <th className="p-4">Data</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Descrição</th>
                    <th className="p-4 text-right">Valor</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {lancamentos.length > 0 ? (
                    lancamentos.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/40">
                        <td className="p-4 text-slate-400">{new Date(l.data_competencia).toLocaleDateString('pt-BR')}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            l.tipo === 'ENTRADA' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-red-950 text-red-400 border border-red-500/30'
                          }`}>
                            {l.tipo}
                          </span>
                        </td>
                        <td className="p-4 font-sans text-slate-300 font-bold">{l.categoria}</td>
                        <td className="p-4 font-sans text-slate-300">{l.descricao}</td>
                        <td className={`p-4 text-right font-black ${l.tipo === 'ENTRADA' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {l.tipo === 'ENTRADA' ? '+' : '-'} {formatarMoeda(l.valor)}
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">Nenhum lançamento registrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 4: COMPLIANCE & LEIS TRABALHISTAS (CLT) */}
        {abaAtiva === 'compliance' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 text-slate-300 text-xs md:text-sm leading-relaxed">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>⚖️</span> Fundamentação Jurídica & Blindagem Trabalhista (CLT)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Garantias técnicas e legais integradas ao SGM.PRO para afastar passivo trabalhista e assegurar a licitude das operações
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <span className="text-blue-400 font-bold text-xs uppercase tracking-wider block">
                  1. Artigo 442-B da CLT (Lei nº 13.467/2017)
                </span>
                <p className="text-slate-300 text-xs">
                  "A contratação do autônomo, cumpridas por este todas as formalidades legais, com ou sem exclusividade, de forma contínua ou não, afasta a qualidade de empregado prevista no art. 3º desta Consolidação."
                </p>
                <p className="text-[11px] text-slate-400">
                  O SGM.PRO implementa a liberdade de aceite ou recusa de ordens de serviço e a ausência de subordinação hierárquica, assegurando a autonomia plena do prestador.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <span className="text-emerald-400 font-bold text-xs uppercase tracking-wider block">
                  2. Tema 725 do STF & ADPF 324
                </span>
                <p className="text-slate-300 text-xs">
                  O Supremo Tribunal Federal fixou a tese de repercussão geral consolidando que é lícita a terceirização ou contratação de autônomos em qualquer etapa da atividade empresarial (atividade-meio ou atividade-fim).
                </p>
                <p className="text-[11px] text-slate-400">
                  A relação entre a plataforma SGM.PRO, as lojas e os medidores é formalizada por contrato de intermediação e parceria autônoma.
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <span className="text-purple-400 font-bold text-xs uppercase tracking-wider block">
                  3. Quitação Plena e Irrevogável (Art. 320 do Código Civil)
                </span>
                <p className="text-slate-300 text-xs">
                  A cada lote de medições liquidado via PIX, o sistema gera o Termo de Quitação com assinatura eletrônica, hash criptográfico SHA-256 e registro de IP conforme o Art. 15 da Lei 12.965/2014 (Marco Civil da Internet).
                </p>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2">
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block">
                  4. Enquadramento Tributário & Fiscal (NFS-e / RPA)
                </span>
                <p className="text-slate-300 text-xs">
                  Exigência de emissão de Nota Fiscal de Serviços Eletrônica (MEI/PJ) para liberação dos pagamentos. Para prestadores autônomos PF, retenção de INSS e IRRF conforme legislação previdenciária.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal de Auditoria e Pagamento */}
      <ModalAuditoriaFinanceira
        isOpen={modalAuditoriaAberto}
        onClose={() => { setModalAuditoriaAberto(false); setLoteSelecionadoId(null); }}
        fechamentoId={loteSelecionadoId}
        onFechamentoAtualizado={handleLoteAtualizado}
      />

      {/* Modal de Novo Lançamento Manual */}
      {modalNovoLancamento && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 animate-fade-in">
            <h3 className="text-base font-black text-white">Novo Lançamento no Livro Caixa</h3>
            <form onSubmit={salvarLancamentoManual} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-bold">Tipo de Movimentação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNovoTipo('SAIDA')}
                    className={`py-2 rounded-xl font-bold ${novoTipo === 'SAIDA' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    Saída (Despesa)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovoTipo('ENTRADA')}
                    className={`py-2 rounded-xl font-bold ${novoTipo === 'ENTRADA' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    Entrada (Receita)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">Categoria</label>
                <select
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="DESPESA_OPERACIONAL">Despesa Operacional</option>
                  <option value="COMBUSTIVEL">Combustível / Adiantamento</option>
                  <option value="INFRAESTRUTURA_TI">Infraestrutura & TI</option>
                  <option value="IMPOSTOS">Impostos & Taxas</option>
                  <option value="OUTROS">Outros</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-bold">Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Hospedagem servidores AWS / Adiantamento"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovoLancamento(false)}
                  className="bg-slate-800 text-slate-400 font-bold px-4 py-2 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
