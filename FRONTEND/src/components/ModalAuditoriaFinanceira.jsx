import { useState, useEffect } from 'react'
import axios from 'axios'

export default function ModalAuditoriaFinanceira({ isOpen, onClose, fechamentoId, onFechamentoAtualizado }) {
  const [fechamento, setFechamento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  // Ajustes de aprovação
  const [descontos, setDescontos] = useState(0)
  const [adicionais, setAdicionais] = useState(0)
  const [obsFinanceiro, setObsFinanceiro] = useState('')

  // Baixa de Pagamento
  const [comprovanteUrl, setComprovanteUrl] = useState('')
  const [uploadingComprovante, setUploadingComprovante] = useState(false)

  useEffect(() => {
    if (isOpen && fechamentoId) {
      carregarDetalhes()
    }
  }, [isOpen, fechamentoId])

  const carregarDetalhes = async () => {
    setLoading(true)
    setErro('')
    try {
      const res = await axios.get(`/api/fechamentos/${fechamentoId}`)
      setFechamento(res.data)
      setDescontos(res.data.valor_descontos || 0)
      setAdicionais(res.data.valor_adicionais || 0)
      setObsFinanceiro(res.data.observacoes_financeiro || '')
      setComprovanteUrl(res.data.url_comprovante_pix || '')
    } catch (err) {
      console.error('Erro ao carregar fechamento:', err)
      setErro('Não foi possível obter os detalhes do lote.')
    } finally {
      setLoading(false)
    }
  }

  const aprovarFechamento = async () => {
    setSalvando(true)
    try {
      const res = await axios.put(`/api/fechamentos/${fechamentoId}/aprovar`, {
        valor_descontos: parseFloat(descontos) || 0,
        valor_adicionais: parseFloat(adicionais) || 0,
        observacoes_financeiro: obsFinanceiro
      })
      alert('✅ Lote aprovado com sucesso para pagamento!')
      setFechamento(res.data.fechamento)
      if (onFechamentoAtualizado) onFechamentoAtualizado(res.data.fechamento)
    } catch (err) {
      alert('Erro ao aprovar lote: ' + (err.response?.data?.erro || err.message))
    } finally {
      setSalvando(false)
    }
  }

  const handleUploadComprovante = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingComprovante(true)
    const formData = new FormData()
    formData.append('arquivo', file)

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setComprovanteUrl(res.data.url)
    } catch (err) {
      alert('Falha ao subir comprovante bancário.')
    } finally {
      setUploadingComprovante(false)
    }
  }

  const liquidarPagamento = async () => {
    if (!comprovanteUrl) {
      if (!window.confirm("Atenção: Nenhum comprovante bancário foi anexado. Deseja efetivar a baixa do lote mesmo assim?")) {
        return
      }
    }

    setSalvando(true)
    try {
      const res = await axios.post(`/api/fechamentos/${fechamentoId}/pagar`, {
        url_comprovante_pix: comprovanteUrl
      })
      alert('🎉 Pagamento confirmado com sucesso! Quitação plena emitida e fluxo de caixa atualizado.')
      setFechamento(res.data.fechamento)
      if (onFechamentoAtualizado) onFechamentoAtualizado(res.data.fechamento)
    } catch (err) {
      alert('Erro ao processar baixa: ' + (err.response?.data?.erro || err.message))
    } finally {
      setSalvando(false)
    }
  }

  const copiarPix = () => {
    if (!fechamento?.chave_pix) return
    navigator.clipboard.writeText(fechamento.chave_pix).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    })
  }

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  if (!isOpen) return null

  const isPago = fechamento?.status === 'PAGO'
  const isAprovado = fechamento?.status === 'APROVADO'

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-fade-in">
        
        {/* Cabeçalho */}
        <div className="p-5 md:p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚖️</span>
              <h2 className="text-xl font-black text-white">Auditoria & Liquidação de Lote</h2>
              {fechamento && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isPago ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  isAprovado ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {fechamento.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Protocolo: {fechamento?.numero_lote || 'Carregando...'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-400 text-xs">
            ⚠️ {erro}
          </div>
        )}

        {/* Conteúdo com Scroll */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-slate-200 text-xs md:text-sm">
          {loading ? (
            <div className="p-12 text-center text-slate-500">Carregando dados da auditoria...</div>
          ) : fechamento ? (
            <>
              {/* Card de Identificação e Documentos Fiscais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl md:col-span-2 space-y-2">
                  <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Prestador de Serviço</div>
                  <p className="text-base font-bold text-white">{fechamento.medidor?.nome_completo}</p>
                  <p className="text-xs text-slate-400">
                    CPF: <span className="font-mono text-slate-300">{fechamento.medidor?.cpf}</span> • Tel: <span className="text-slate-300">{fechamento.medidor?.telefone}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                      Doc Fiscal: {fechamento.tipo_documento_fiscal} {fechamento.numero_documento_fiscal && `(${fechamento.numero_documento_fiscal})`}
                    </span>
                    {fechamento.url_documento_fiscal && (
                      <a 
                        href={fechamento.url_documento_fiscal} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px] font-bold hover:bg-blue-800 transition-colors"
                      >
                        📄 Ver Nota Fiscal Anexa
                      </a>
                    )}
                    {fechamento.url_planilha_enviada && (
                      <a 
                        href={fechamento.url_planilha_enviada} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 text-[10px] font-bold hover:bg-purple-800 transition-colors"
                      >
                        📊 Baixar Planilha do Medidor
                      </a>
                    )}
                  </div>
                </div>

                {/* Box de Chave PIX */}
                <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Chave PIX do Medidor</div>
                    <p className="text-xs font-mono font-bold text-emerald-400 mt-1 break-all select-all">
                      {fechamento.chave_pix || 'Não informada'}
                    </p>
                    <span className="text-[10px] text-slate-500 uppercase">{fechamento.tipo_chave_pix}</span>
                  </div>
                  <button
                    onClick={copiarPix}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-1.5 rounded-xl transition-all"
                  >
                    {copiado ? '✓ Chave Copiada!' : '📋 Copiar Chave PIX'}
                  </button>
                </div>
              </div>

              {/* Tabela de OSs Integrantes */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                  <span className="font-bold text-xs text-slate-400">Ordens de Serviço Integrantes do Lote ({fechamento.itens?.length || 0})</span>
                  <span className="text-xs text-slate-500 font-mono">Período: {new Date(fechamento.periodo_inicio).toLocaleDateString('pt-BR')} até {new Date(fechamento.periodo_fim).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-[10px] uppercase font-black tracking-wider text-slate-500">
                      <tr>
                        <th className="p-2.5">OS</th>
                        <th className="p-2.5">Loja</th>
                        <th className="p-2.5">Cliente</th>
                        <th className="p-2.5 text-right">Mão de Obra</th>
                        <th className="p-2.5 text-right">Desloc.</th>
                        <th className="p-2.5 text-right">Total Devido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-mono">
                      {fechamento.itens?.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-800/30">
                          <td className="p-2.5 text-blue-400">#{String(it.ordem_servico_id).padStart(4, '0')}</td>
                          <td className="p-2.5 font-sans text-slate-300">{it.ordem_servico?.loja?.nome_fantasia || '-'}</td>
                          <td className="p-2.5 font-sans text-slate-300">{it.ordem_servico?.cliente_nome}</td>
                          <td className="p-2.5 text-right text-slate-400">{formatarMoeda(it.valor_mao_de_obra)}</td>
                          <td className="p-2.5 text-right text-slate-400">{formatarMoeda(it.valor_deslocamento)}</td>
                          <td className="p-2.5 text-right text-emerald-400 font-bold">{formatarMoeda(it.valor_total_item)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Seção de Totalizadores & Ajustes Financeiros */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-4">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Demonstrativo Financeiro & Conciliação
                </span>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Valor Bruto</span>
                    <p className="text-sm md:text-base font-black text-white font-mono mt-1">{formatarMoeda(fechamento.valor_bruto)}</p>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Retenções Fiscais (RPA)</span>
                    <p className="text-sm md:text-base font-black text-amber-400 font-mono mt-1">- {formatarMoeda(fechamento.valor_retencoes_impostos)}</p>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Descontos / Adiantamentos</span>
                    <p className="text-sm md:text-base font-black text-red-400 font-mono mt-1">- {formatarMoeda(descontos)}</p>
                  </div>
                  <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold">Valor Líquido a Pagar</span>
                    <p className="text-base md:text-xl font-black text-emerald-400 font-mono mt-1">
                      {formatarMoeda(fechamento.valor_bruto + parseFloat(adicionais || 0) - fechamento.valor_retencoes_impostos - parseFloat(descontos || 0))}
                    </p>
                  </div>
                </div>

                {/* Campos de Ajuste (se não estiver pago) */}
                {!isPago && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Descontos / Estornos (R$)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={descontos} 
                        onChange={(e) => setDescontos(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Adicionais / Bônus (R$)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={adicionais} 
                        onChange={(e) => setAdicionais(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Observações do Financeiro</label>
                      <input 
                        type="text" 
                        value={obsFinanceiro} 
                        onChange={(e) => setObsFinanceiro(e.target.value)}
                        placeholder="Ex: Desconto adiantamento de combustível"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Seção de Baixa Bancária (PIX) */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Comprovante de Pagamento & Quitação Legal (Art. 320 Código Civil)
                </span>

                {isPago ? (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex flex-col md:flex-row justify-between items-center gap-3">
                    <div>
                      <span className="text-emerald-400 font-bold text-xs">✓ Lote Liquidado com Quitação Plena</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Pago em: {fechamento.pago_em ? new Date(fechamento.pago_em).toLocaleString('pt-BR') : '-'}
                      </p>
                      {fechamento.termo_quitacao_hash && (
                        <p className="text-[9px] font-mono text-slate-500 mt-1">Hash Quitação: {fechamento.termo_quitacao_hash}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {fechamento.url_comprovante_pix && (
                        <a 
                          href={fechamento.url_comprovante_pix} 
                          target="_blank" 
                          rel="noreferrer"
                          className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
                        >
                          📎 Comprovante PIX
                        </a>
                      )}
                      <a 
                        href={`/api/fechamentos/${fechamento.id}/termo-quitacao`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                      >
                        🖨️ Imprimir Termo de Quitação
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Anexar Comprovante da Transferência PIX</label>
                      <input 
                        type="file" 
                        accept="image/*, .pdf"
                        onChange={handleUploadComprovante}
                        className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
                      />
                      {comprovanteUrl && <span className="text-[10px] text-emerald-400 block mt-1">✓ Comprovante anexado</span>}
                    </div>
                    <button
                      onClick={liquidarPagamento}
                      disabled={salvando || uploadingComprovante}
                      className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center justify-center gap-2 h-[38px]"
                    >
                      {salvando ? 'Processando Baixa...' : '💰 Efetivar Pagamento & Emitir Quitação'}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Rodapé com Ações de Aprovação */}
        <div className="p-4 md:p-6 border-t border-slate-800 bg-slate-950 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
          >
            Fechar
          </button>
          <div className="flex items-center gap-3">
            {!isPago && !isAprovado && (
              <button
                onClick={aprovarFechamento}
                disabled={salvando}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-900/30 transition-all flex items-center gap-2"
              >
                {salvando ? 'Salvando...' : '✓ Aprovar Fechamento p/ Pagamento'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
