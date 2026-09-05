import { useState, useEffect } from 'react'
import axios from 'axios'

export default function ModalPagamentoPix({ isOpen, onClose, os, onPagamentoConfirmado }) {
  const [pixData, setPixData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (isOpen && os?.id) {
      carregarDadosPix()
    }
  }, [isOpen, os?.id])

  const carregarDadosPix = async () => {
    setLoading(true)
    setErro('')
    try {
      const res = await axios.get(`/api/os/${os.id}/pix`)
      setPixData(res.data)
    } catch (err) {
      console.error('Erro ao carregar dados do Pix:', err)
      setErro('Não foi possível gerar a cobrança PIX no momento.')
    } finally {
      setLoading(false)
    }
  }

  const copiarPix = () => {
    if (!pixData?.pix_copia_e_cola) return
    navigator.clipboard.writeText(pixData.pix_copia_e_cola).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    })
  }

  const confirmarPagamento = async () => {
    if (!window.confirm("Deseja confirmar o pagamento desta medição técnica?")) return
    setProcessando(true)
    try {
      await axios.post(`/api/os/${os.id}/confirmar-pagamento`)
      alert("✅ Pagamento confirmado com sucesso!")
      if (onPagamentoConfirmado) onPagamentoConfirmado()
      carregarDadosPix()
    } catch (err) {
      alert("❌ Erro ao confirmar o pagamento.")
    } finally {
      setProcessando(false)
    }
  }

  const formatarMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  if (!isOpen) return null

  const isPago = pixData?.status_pagamento === 'PAGO' || os?.status_pagamento === 'PAGO'

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in my-8">
        
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h2 className="text-lg font-black text-white">Pagamento Instantâneo PIX</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Ordem de Serviço #{String(os?.id || '').padStart(4, '0')}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-bold">Gerando cobrança e split automático...</p>
            </div>
          ) : erro ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center text-red-400 text-sm">
              {erro}
            </div>
          ) : (
            <>
              {/* Badge de Status */}
              <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Status do Pagamento</p>
                  <p className={`text-sm font-black mt-0.5 ${isPago ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isPago ? '✅ Medição Quitada (PAGO)' : '⏳ Aguardando Liquidação PIX'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Valor Total (GMV)</p>
                  <p className="text-xl font-black text-white font-mono">{formatarMoeda(pixData?.valor_total)}</p>
                </div>
              </div>

              {/* QR Code & Copia e Cola (apenas se não estiver pago) */}
              {!isPago ? (
                <div className="text-center space-y-4">
                  <div className="inline-block p-4 bg-white rounded-2xl shadow-xl shadow-blue-500/5">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pixData?.pix_copia_e_cola || '')}`} 
                      alt="QR Code Pix"
                      className="w-48 h-48 mx-auto"
                    />
                  </div>
                  <p className="text-xs text-slate-400">Abra o app do seu banco e escaneie o código acima</p>

                  <div className="space-y-2">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-left">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Pix Copia e Cola</p>
                      <p className="text-xs font-mono text-slate-300 break-all select-all line-clamp-2">
                        {pixData?.pix_copia_e_cola}
                      </p>
                    </div>

                    <button 
                      onClick={copiarPix}
                      className={`w-full py-3 rounded-xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 ${
                        copiado 
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' 
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                      }`}
                    >
                      {copiado ? '✅ Código PIX Copiado!' : '📋 Copiar Código PIX (Copia e Cola)'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
                  <div className="text-4xl">🎉</div>
                  <p className="font-bold text-emerald-400 text-base">Pagamento Confirmado!</p>
                  <p className="text-xs text-slate-400">
                    Data: {pixData?.data_pagamento ? new Date(pixData.data_pagamento).toLocaleString('pt-BR') : 'Hoje'}
                  </p>
                </div>
              )}

              {/* Transparência e Split Financeiro Totalmente Discriminado */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Detalhamento Transparente do Split</span>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold">Auditado</span>
                </div>

                {/* Bloco Medidor */}
                <div className="space-y-1.5 pb-2 border-b border-slate-800/60 border-dashed">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white font-bold flex items-center gap-1">
                      <span>👷</span> Repasse ao Medidor ({pixData?.split?.medidor_nome})
                    </span>
                    <span className="text-emerald-400 font-bold font-mono">{formatarMoeda(pixData?.split?.repasse_medidor)}</span>
                  </div>

                  <div className="pl-4 space-y-1 text-[11px] text-slate-400">
                    <div className="flex justify-between items-center">
                      <span>• Mão de Obra Técnica (m²):</span>
                      <span className="font-mono text-slate-300">
                        {formatarMoeda(pixData?.split?.mao_de_obra_medidor || (pixData?.split?.repasse_medidor - pixData?.split?.taxa_deslocamento - (pixData?.split?.adicional_urgencia_medidor || 0)))}
                      </span>
                    </div>

                    {(pixData?.split?.urgencia || pixData?.split?.adicional_urgencia_medidor > 0) && (
                      <div className="flex justify-between items-center text-amber-400">
                        <span>• Adicional de Urgência (+50%):</span>
                        <span className="font-mono font-bold">
                          +{formatarMoeda(pixData?.split?.adicional_urgencia_medidor)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span>• Auxílio Deslocamento (Gasolina/Trajeto):</span>
                      <span className="font-mono text-slate-300">
                        +{formatarMoeda(pixData?.split?.taxa_deslocamento)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500 pt-0.5">
                      <span>Chave PIX ({pixData?.split?.tipo_chave_medidor}):</span>
                      <span className="font-mono text-slate-400">{pixData?.split?.chave_pix_medidor}</span>
                    </div>
                  </div>
                </div>

                {/* Bloco SGM */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-bold flex items-center gap-1">
                      <span>🏢</span> Margem de Intermediação (SGM PRO)
                    </span>
                    <span className="text-blue-400 font-bold font-mono">{formatarMoeda(pixData?.split?.margem_sgm)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 pl-4">
                    <span>Take-Rate Efetivo da Plataforma:</span>
                    <span className="font-bold text-blue-400 font-mono">
                      {pixData?.split?.take_rate_percentual ? pixData.split.take_rate_percentual.toFixed(1) : '0.0'}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Ação de confirmação manual para testes/admin */}
              {!isPago && (
                <button 
                  onClick={confirmarPagamento}
                  disabled={processando}
                  className="w-full bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 py-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  {processando ? 'Processando...' : 'Simular / Confirmar Pagamento do Pix'}
                </button>
              )}
            </>
          )}
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-500">
            🔒 Transação protegida e auditada conforme Marco Civil da Internet e Banco Central do Brasil.
          </p>
        </div>

      </div>
    </div>
  )
}
