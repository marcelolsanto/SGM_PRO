import { useState, useEffect } from 'react'
import axios from 'axios'

export default function SeletorRedeLoja({
  lojaSelecionada = 'TODAS',
  onSelecionarLoja,
  lojasProp = null,
  mostrarTodas = true,
  className = ''
}) {
  const [lojas, setLojas] = useState(lojasProp || [])
  const [carregando, setCarregando] = useState(!lojasProp)

  useEffect(() => {
    if (lojasProp) {
      setLojas(lojasProp)
      setCarregando(false)
      return
    }
    axios.get('/api/lojas')
      .then(res => {
        setLojas(res.data || [])
        setCarregando(false)
      })
      .catch(() => setCarregando(false))
  }, [lojasProp])

  // Se estiver carregando
  if (carregando) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono ${className}`}>
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span> Carregando unidades...
      </div>
    )
  }

  // Se for apenas uma loja individual (Unidade única e isolada)
  if (lojas.length <= 1) {
    const lojaUnica = lojas[0]
    return (
      <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/80 border border-slate-800/80 rounded-xl text-xs text-slate-300 font-semibold shadow-inner ${className}`}>
        <span className="text-base">🏬</span>
        <span>{lojaUnica ? lojaUnica.nome_fantasia : 'Minha Unidade'}</span>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">Unidade Exclusiva</span>
      </div>
    )
  }

  // Se tiver 2 ou mais lojas (Gestor de Rede ou Admin com 12 a 16 filiais)
  const totalLojas = lojas.length
  const lojaAtual = lojas.find(l => l.id.toString() === lojaSelecionada.toString())

  return (
    <div className={`flex flex-wrap items-center gap-2 bg-slate-900/90 border border-blue-500/30 p-2 rounded-2xl shadow-xl backdrop-blur-md ${className}`}>
      <div className="flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wider text-blue-400">
        <span className="text-lg">🏢</span>
        <span className="hidden sm:inline">Rede de Lojas:</span>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <select
          value={lojaSelecionada}
          onChange={(e) => {
            const val = e.target.value
            const obj = lojas.find(l => l.id.toString() === val) || null
            if (onSelecionarLoja) onSelecionarLoja(val, obj)
          }}
          className="w-full bg-slate-950/80 border border-slate-700/80 text-white text-xs md:text-sm font-semibold rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
        >
          {mostrarTodas && (
            <option value="TODAS">
              🏢 Toda a Rede ({totalLojas} {totalLojas === 1 ? 'Loja' : 'Lojas Conectadas'})
            </option>
          )}
          {lojas.map(loja => (
            <option key={loja.id} value={loja.id.toString()}>
              🏬 {loja.nome_fantasia} {loja.eh_matriz ? '⭐ (Matriz)' : ''} {loja.cidade ? `- ${loja.cidade}/${loja.estado || ''}` : ''}
            </option>
          ))}
        </select>
      </div>

      {lojaSelecionada === 'TODAS' ? (
        <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold rounded-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
          Visão Consolidada ({totalLojas} Filiais)
        </span>
      ) : (
        <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold rounded-lg">
          <span>🏬</span>
          Filial Isolada: {lojaAtual?.nome_fantasia || 'Selecionada'}
        </span>
      )}
    </div>
  )
}
