import { useState, useEffect } from 'react'
import axios from 'axios'

export default function ModalFechamentoMedidor({ isOpen, onClose, medidorId, onFechamentoCriado }) {
  const [etapa, setEtapa] = useState(1) // 1: Seleção/Simulação, 2: Planilha (opcional), 3: Dados Fiscais/PIX
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [simulacao, setSimulacao] = useState(null)
  const [loadingSimulacao, setLoadingSimulacao] = useState(false)

  // Planilha e Conciliação
  const [arquivoPlanilha, setArquivoPlanilha] = useState(null)
  const [uploadingPlanilha, setUploadingPlanilha] = useState(false)
  const [resultadoConciliacao, setResultadoConciliacao] = useState(null)
  const [urlPlanilhaEnviada, setUrlPlanilhaEnviada] = useState('')

  // Dados Fiscais (CLT / Fiscal)
  const [tipoDocumentoFiscal, setTipoDocumentoFiscal] = useState('MEI') // 'MEI', 'NFSE', 'RPA'
  const [numeroDocFiscal, setNumeroDocFiscal] = useState('')
  const [urlDocFiscal, setUrlDocFiscal] = useState('')
  const [uploadingDocFiscal, setUploadingDocFiscal] = useState(false)

  // PIX e Aceite Legal
  const [chavePix, setChavePix] = useState('')
  const [tipoChavePix, setTipoChavePix] = useState('CPF')
  const [termoAceito, setTermoAceito] = useState(false)
  const [processandoSubmissao, setProcessandoSubmissao] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (isOpen) {
      // Padrão: início do mês atual até hoje
      const hoje = new Date()
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      const inicioFormatado = primeiroDia.toISOString().split('T')[0]
      const fimFormatado = hoje.toISOString().split('T')[0]

      setDataInicio(inicioFormatado)
      setDataFim(fimFormatado)
      setEtapa(1)
      setResultadoConciliacao(null)
      setArquivoPlanilha(null)
      setTermoAceito(false)
      setErro('')
      simular(inicioFormatado, fimFormatado)
    }
  }, [isOpen, medidorId])

  const simular = async (inicio, fim) => {
    setLoadingSimulacao(true)
    setErro('')
    try {
      const res = await axios.post('/api/fechamentos/simular', {
        medidor_id: medidorId,
        periodo_inicio: inicio || dataInicio,
        periodo_fim: fim || dataFim
      })
      setSimulacao(res.data)
      if (res.data.medidor) {
        setChavePix(res.data.medidor.chave_pix || '')
        setTipoChavePix(res.data.medidor.tipo_chave_pix || 'CPF')
      }
    } catch (err) {
      console.error('Erro na simulação:', err)
      setErro(err.response?.data?.erro || 'Falha ao carregar ordens de serviço do período.')
    } finally {
      setLoadingSimulacao(false)
    }
  }

  const selecionarMesAnterior = () => {
    const hoje = new Date()
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    const inicioStr = primeiroDia.toISOString().split('T')[0]
    const fimStr = ultimoDia.toISOString().split('T')[0]
    setDataInicio(inicioStr)
    setDataFim(fimStr)
    simular(inicioStr, fimStr)
  }

  const selecionarMesAtual = () => {
    const hoje = new Date()
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const inicioStr = primeiroDia.toISOString().split('T')[0]
    const fimStr = hoje.toISOString().split('T')[0]
    setDataInicio(inicioStr)
    setDataFim(fimStr)
    simular(inicioStr, fimStr)
  }

  const handleUploadPlanilha = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setArquivoPlanilha(file)
    setUploadingPlanilha(true)
    setErro('')

    const formData = new FormData()
    formData.append('planilha', file)
    if (medidorId) formData.append('medidor_id', medidorId)

    try {
      const res = await axios.post('/api/fechamentos/upload-planilha', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResultadoConciliacao(res.data.resultado)
      setUrlPlanilhaEnviada(res.data.url_planilha)
    } catch (err) {
      console.error('Erro no upload da planilha:', err)
      setErro(err.response?.data?.erro || 'Falha ao analisar a planilha. Verifique o formato (.xlsx ou .csv).')
    } finally {
      setUploadingPlanilha(false)
    }
  }

  const handleUploadDocFiscal = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingDocFiscal(true)
    const formData = new FormData()
    formData.append('arquivo', file)

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUrlDocFiscal(res.data.url)
    } catch (err) {
      alert('Erro ao enviar documento fiscal.')
    } finally {
      setUploadingDocFiscal(false)
    }
  }

  const submeterFechamento = async () => {
    if (!termoAceito) {
      setErro('É obrigatório aceitar o Termo de Parceria e Quitação Legal (Art. 442-B da CLT).')
      return
    }
    if (!chavePix) {
      setErro('Informe sua Chave PIX para recebimento.')
      return
    }
    // Regime fiscal flexível: tanto MEI/PJ quanto Autônomo PF (RPA) são permitidos sem travar o envio

    setProcessandoSubmissao(true)
    setErro('')

    try {
      const osIds = simulacao.ordens.map(o => o.id)
      const payload = {
        medidor_id: medidorId,
        periodo_inicio: dataInicio,
        periodo_fim: dataFim,
        os_ids: osIds,
        tipo_documento_fiscal: tipoDocumentoFiscal,
        numero_documento_fiscal: numeroDocFiscal,
        url_documento_fiscal: urlDocFiscal,
        url_planilha_enviada: urlPlanilhaEnviada,
        chave_pix: chavePix,
        tipo_chave_pix: tipoChavePix,
        divergencias_json: resultadoConciliacao ? JSON.stringify(resultadoConciliacao) : ''
      }

      const res = await axios.post('/api/fechamentos/solicitar', payload)
      alert('✅ Lote de fechamento submetido com sucesso! O setor financeiro iniciará a auditoria e liquidação.')
      if (onFechamentoCriado) onFechamentoCriado(res.data.fechamento)
      onClose()
    } catch (err) {
      console.error('Erro ao submeter fechamento:', err)
      setErro(err.response?.data?.erro || 'Erro ao submeter o fechamento.')
    } finally {
      setProcessandoSubmissao(false)
    }
  }

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  if (!isOpen) return null

  // Cálculo de prévia líquida com RPA
  const valorBruto = simulacao?.valor_bruto || 0
  const valorMaoObra = simulacao?.valor_mao_de_obra || 0
  const inssRpa = tipoDocumentoFiscal === 'RPA' ? Math.min(valorMaoObra * 0.11, 908.85) : 0
  const valorLiquidoPrevisto = valorBruto - inssRpa

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-fade-in">
        
        {/* Cabeçalho */}
        <div className="p-5 md:p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <h2 className="text-xl font-black text-white">Solicitação de Fechamento de Medições</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Conferência quinzenal/mensal, conciliação de planilha e liquidação via PIX
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Indicador de Etapas */}
        <div className="grid grid-cols-3 bg-slate-950/70 border-b border-slate-800 shrink-0 text-xs font-bold">
          <button 
            onClick={() => setEtapa(1)}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              etapa === 1 ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-transparent text-slate-400'
            }`}
          >
            <span>1.</span> Período & Ordens
          </button>
          <button 
            onClick={() => setEtapa(2)}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              etapa === 2 ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-transparent text-slate-400'
            }`}
          >
            <span>2.</span> Planilha & Conferência
          </button>
          <button 
            onClick={() => setEtapa(3)}
            className={`py-3 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              etapa === 3 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-transparent text-slate-400'
            }`}
          >
            <span>3.</span> Fiscal & PIX
          </button>
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center justify-between">
            <span>⚠️ {erro}</span>
            <button onClick={() => setErro('')} className="text-red-400 font-bold hover:text-white">✕</button>
          </div>
        )}

        {/* Corpo com Scroll */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-slate-200 text-sm">
          
          {/* ETAPA 1: SELEÇÃO DE PERÍODO E OSs */}
          {etapa === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Ciclo de Liquidação:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selecionarMesAnterior}
                    className="bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-500/30 transition-all flex items-center gap-1.5"
                  >
                    <span>📅</span> Mês Fechado (Vence no 5º Dia Útil)
                  </button>
                  <button
                    type="button"
                    onClick={selecionarMesAtual}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <span>⚡</span> Mês Atual (Em Andamento)
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Início do Período
                  </label>
                  <input 
                    type="date" 
                    value={dataInicio} 
                    onChange={(e) => { setDataInicio(e.target.value); simular(e.target.value, dataFim); }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Fim do Período
                  </label>
                  <input 
                    type="date" 
                    value={dataFim} 
                    onChange={(e) => { setDataFim(e.target.value); simular(dataInicio, e.target.value); }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-blue-500 outline-none"
                  />
                </div>
                <button
                  onClick={() => simular(dataInicio, dataFim)}
                  disabled={loadingSimulacao}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all h-[38px] flex items-center gap-2"
                >
                  {loadingSimulacao ? 'Calculando...' : '🔄 Atualizar'}
                </button>
              </div>

              {/* Cards de Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Medições Concluídas</span>
                  <p className="text-2xl font-black text-white mt-1">{simulacao?.quantidade_os || 0} OS</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mão de Obra</span>
                  <p className="text-xl font-black text-slate-200 mt-1">{formatarMoeda(simulacao?.valor_mao_de_obra)}</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Deslocamento</span>
                  <p className="text-xl font-black text-slate-200 mt-1">{formatarMoeda(simulacao?.valor_deslocamento)}</p>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/30 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Total a Faturar</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{formatarMoeda(simulacao?.valor_bruto)}</p>
                </div>
              </div>

              {/* Tabela de OSs localizadas */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-3 bg-slate-950 border-b border-slate-800 font-bold text-xs text-slate-400 flex justify-between">
                  <span>Ordens de Serviço Selecionadas para este Fechamento</span>
                  <span>{simulacao?.ordens?.length || 0} itens</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {simulacao?.ordens?.length > 0 ? (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/50 text-[10px] uppercase font-black tracking-wider text-slate-500">
                        <tr>
                          <th className="p-2.5">OS</th>
                          <th className="p-2.5">Cliente / Loja</th>
                          <th className="p-2.5">Data</th>
                          <th className="p-2.5 text-right">Mão de Obra</th>
                          <th className="p-2.5 text-right">Deslocamento</th>
                          <th className="p-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {simulacao.ordens.map(os => (
                          <tr key={os.id} className="hover:bg-slate-800/40">
                            <td className="p-2.5 text-blue-400">#{String(os.id).padStart(4, '0')}</td>
                            <td className="p-2.5 font-sans font-medium text-slate-300">
                              {os.cliente_nome} <span className="text-slate-500 text-[10px] block">{os.loja?.nome_fantasia}</span>
                            </td>
                            <td className="p-2.5 text-slate-400">{os.data_conclusao ? new Date(os.data_conclusao).toLocaleDateString('pt-BR') : '-'}</td>
                            <td className="p-2.5 text-right text-slate-300">{formatarMoeda(os.mao_de_obra_medidor || (os.custo_medidor - os.taxa_deslocamento))}</td>
                            <td className="p-2.5 text-right text-slate-400">{formatarMoeda(os.taxa_deslocamento)}</td>
                            <td className="p-2.5 text-right text-emerald-400 font-bold">{formatarMoeda(os.custo_medidor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Nenhuma medição concluída encontrada no período selecionado ou todas já foram faturadas.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 2: PLANILHA PESSOAL E CONCILIAÇÃO */}
          {etapa === 2 && (
            <div className="space-y-5">
              <div className="bg-blue-950/20 border border-blue-500/20 p-4 rounded-2xl text-xs text-blue-300 leading-relaxed">
                💡 <strong>Conferência Inteligente:</strong> Você pode enviar a sua própria planilha de controle pessoal em formato <strong>.xlsx (Excel)</strong> ou <strong>.csv</strong>. O sistema irá cruzar automaticamente cada linha com os dados da plataforma para certificar que os valores e quilometragens conferem perfeitamente.
              </div>

              {/* Upload Box */}
              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 text-center transition-all bg-slate-950/30">
                <input 
                  type="file" 
                  accept=".xlsx, .csv" 
                  id="input-planilha" 
                  className="hidden" 
                  onChange={handleUploadPlanilha}
                />
                <label htmlFor="input-planilha" className="cursor-pointer flex flex-col items-center gap-2">
                  <span className="text-3xl">📊</span>
                  <span className="font-bold text-sm text-white">
                    {uploadingPlanilha ? 'Processando e Conciliando Planilha...' : 'Clique para selecionar sua planilha (.xlsx ou .csv)'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {arquivoPlanilha ? `Arquivo selecionado: ${arquivoPlanilha.name}` : 'Arraste ou selecione o arquivo do seu computador'}
                  </span>
                </label>
              </div>

              {/* Relatório de Conciliação */}
              {resultadoConciliacao && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${resultadoConciliacao.status_geral === '100%_CONCILIADO' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span className="font-bold text-xs uppercase tracking-wider text-white">
                        Resultado: {resultadoConciliacao.status_geral === '100%_CONCILIADO' ? '100% Conciliado com Sucesso' : 'Divergências Encontradas'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      Planilha: <strong className="text-white">{formatarMoeda(resultadoConciliacao.valor_total_planilha)}</strong> | Sistema: <strong className="text-emerald-400">{formatarMoeda(resultadoConciliacao.valor_total_sistema)}</strong>
                    </div>
                  </div>

                  {/* Linhas da Conciliação */}
                  <div className="max-h-56 overflow-y-auto bg-slate-950/40 border border-slate-800 rounded-2xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/60 text-[10px] uppercase font-black tracking-wider text-slate-500">
                        <tr>
                          <th className="p-2.5">OS ID</th>
                          <th className="p-2.5">Cliente</th>
                          <th className="p-2.5">Valor Planilha</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Observação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {resultadoConciliacao.linhas.map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="p-2.5 font-mono text-blue-400">#{l.os_id}</td>
                            <td className="p-2.5 text-slate-300">{l.cliente_nome}</td>
                            <td className="p-2.5 font-mono text-white">{formatarMoeda(l.valor_total)}</td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                l.status === 'CONCILIADO' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                              }`}>
                                {l.status}
                              </span>
                            </td>
                            <td className="p-2.5 text-[11px] text-slate-400">{l.mensagem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3: DADOS FISCAIS, CHAVE PIX E TERMO CLT */}
          {etapa === 3 && (
            <div className="space-y-5">
              
              {/* Regime Fiscal */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  1. Enquadramento Fiscal do Recebimento (Legislação Tributária & CLT)
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoDocumentoFiscal('MEI')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      tipoDocumentoFiscal === 'MEI' 
                        ? 'border-blue-500 bg-blue-500/10 text-white' 
                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">🏢 MEI (Recomendado)</div>
                    <div className="text-[10px] text-slate-400 mt-1">Emissão de NFS-e sem retenções extras.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoDocumentoFiscal('NFSE')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      tipoDocumentoFiscal === 'NFSE' 
                        ? 'border-blue-500 bg-blue-500/10 text-white' 
                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">📄 Empresa / PJ (Simples/Lucro)</div>
                    <div className="text-[10px] text-slate-400 mt-1">Nota Fiscal de Serviços Eletrônica.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoDocumentoFiscal('RPA')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      tipoDocumentoFiscal === 'RPA' 
                        ? 'border-blue-500 bg-blue-500/10 text-white' 
                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">👤 Autônomo PF (RPA)</div>
                    <div className="text-[10px] text-slate-400 mt-1">Retenção de 11% INSS e tabela IRRF.</div>
                  </button>
                </div>

                {tipoDocumentoFiscal !== 'RPA' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Número da NFS-e</label>
                      <input 
                        type="text" 
                        value={numeroDocFiscal} 
                        onChange={(e) => setNumeroDocFiscal(e.target.value)}
                        placeholder="Ex: NFS-e 2026/0014" 
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Anexar PDF da Nota Fiscal</label>
                      <input 
                        type="file" 
                        accept=".pdf, .xml, image/*" 
                        onChange={handleUploadDocFiscal}
                        className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                      />
                      {urlDocFiscal && <span className="text-[10px] text-emerald-400 block mt-1">✓ Arquivo anexado</span>}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                    ⚠️ <strong>Demonstrativo de Retenção RPA:</strong><br />
                    Mão de Obra: <strong>{formatarMoeda(valorMaoObra)}</strong> | Retenção INSS (11%): <strong className="text-red-400">- {formatarMoeda(inssRpa)}</strong><br />
                    Valor Líquido Previsto: <strong className="text-emerald-400">{formatarMoeda(valorLiquidoPrevisto)}</strong>
                  </div>
                )}
              </div>

              {/* Dados do PIX */}
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  2. Chave PIX para Liquidação Bancária
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo de Chave</label>
                    <select 
                      value={tipoChavePix} 
                      onChange={(e) => setTipoChavePix(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-blue-500"
                    >
                      <option value="CPF">CPF</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="TELEFONE">Telefone</option>
                      <option value="EMAIL">E-mail</option>
                      <option value="ALEATORIA">Chave Aleatória</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Chave PIX</label>
                    <input 
                      type="text" 
                      value={chavePix} 
                      onChange={(e) => setChavePix(e.target.value)}
                      placeholder="Informe sua chave PIX de recebimento"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Termo Jurídico de Quitação (Art. 442-B CLT e Art. 320 CC) */}
              <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-2xl space-y-2">
                <div className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="chk-termo" 
                    checked={termoAceito} 
                    onChange={(e) => setTermoAceito(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 bg-slate-900 border-slate-700 rounded cursor-pointer"
                  />
                  <label htmlFor="chk-termo" className="text-xs text-slate-300 leading-relaxed cursor-pointer">
                    <strong className="text-white">Declaração de Autonomia & Quitação de Medições (Art. 442-B da CLT e Art. 320 do Código Civil):</strong><br />
                    Declaro expressamente que todas as medições integrantes deste fechamento foram prestadas com plena autonomia técnico-operacional, sem subordinação jurídica, sem exclusividade e sem controle de horários. Reconheço que com a efetivação da transferência PIX pelo financeiro sobre o valor líquido acordado, concedo quitação plena, geral e irrevogável sobre a mão de obra, adicionais e deslocamento das respectivas Ordens de Serviço.
                  </label>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 md:p-6 border-t border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
          <div>
            {etapa > 1 && (
              <button
                onClick={() => setEtapa(etapa - 1)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
              >
                ← Voltar
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="bg-transparent hover:bg-slate-800 text-slate-400 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
            >
              Cancelar
            </button>
            {etapa < 3 ? (
              <button
                onClick={() => setEtapa(etapa + 1)}
                disabled={!simulacao || simulacao.quantidade_os === 0}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2"
              >
                Avançar →
              </button>
            ) : (
              <button
                onClick={submeterFechamento}
                disabled={processandoSubmissao || !termoAceito}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2"
              >
                {processandoSubmissao ? 'Enviando Lote...' : '🚀 Enviar Fechamento para o Financeiro'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
