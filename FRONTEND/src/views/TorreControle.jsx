import { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import PortalUsuario from './PortalUsuario'

// Distância aproximada em KM
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

export default function TorreControle({ perfil, setToken }) {
  // Modo: 'panorama' (Torre de Controle Global) ou 'simulacao' (Visão do Medidor)
  const [modo, setModo] = useState('panorama')
  const [medidorSimuladoId, setMedidorSimuladoId] = useState(null)

  // Dados principais
  const [lojas, setLojas] = useState([])
  const [medidores, setMedidores] = useState([])
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)

  // Controles do Mapa
  const [tipoMapa, setTipoMapa] = useState('google_streets') // 'google_streets', 'google_sat', 'dark'
  const [mostrarLojas, setMostrarLojas] = useState(true)
  const [mostrarMedidores, setMostrarMedidores] = useState(true)
  const [mostrarDemandas, setMostrarDemandas] = useState(true)

  // Filtros e Painel Lateral
  const [drawerAberto, setDrawerAberto] = useState(true)
  const [abaFeed, setAbaFeed] = useState('medidores') // 'medidores', 'demandas', 'lojas'
  const [buscaFeed, setBuscaFeed] = useState('')
  const [filtroStatusMedidor, setFiltroStatusMedidor] = useState('TODOS')

  // Refs do Leaflet
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersLojasRef = useRef(null)
  const markersMedidoresRef = useRef(null)
  const markersDemandasRef = useRef(null)
  const tileLayerRef = useRef(null)

  const formatarMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // 1. Carregar dados da rede inteira
  const carregarDadosRede = async () => {
    try {
      const [resLojas, resMedidores, resOs] = await Promise.all([
        axios.get('/api/lojas'),
        axios.get('/api/medidores'),
        axios.get('/api/os')
      ])
      setLojas(resLojas.data || [])
      setMedidores(resMedidores.data || [])
      setOrdens(resOs.data || [])
      setLoading(false)
    } catch (e) {
      console.error("Erro ao carregar dados da torre de controle:", e)
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDadosRede()
    const interval = setInterval(carregarDadosRede, 30000) // auto-refresh a cada 30s
    return () => clearInterval(interval)
  }, [])

  // 2. Classificação de medidores (Livres vs Em Rota)
  const medidoresComStatus = useMemo(() => {
    return medidores.map(m => {
      const osEmRota = ordens.find(o => o.medidor_id === m.id && o.status === 'EM_ROTA')
      const totalOSConcluidas = ordens.filter(o => o.medidor_id === m.id && o.status === 'CONCLUIDO').length
      return {
        ...m,
        statusCampo: osEmRota ? 'EM_ROTA' : 'LIVRE',
        osAtual: osEmRota || null,
        totalConcluidas: totalOSConcluidas
      }
    })
  }, [medidores, ordens])

  // KPIs
  const totalLojas = lojas.length
  const totalMedidores = medidores.length
  const medidoresEmRota = medidoresComStatus.filter(m => m.statusCampo === 'EM_ROTA').length
  const medidoresLivres = totalMedidores - medidoresEmRota
  const demandasAbertas = ordens.filter(o => o.status === 'PENDENTE_LOJA' || o.status === 'PENDENTE').length
  const demandasEmRota = ordens.filter(o => o.status === 'EM_ROTA').length

  // 3. Inicializar Mapa Leaflet quando no modo 'panorama'
  useEffect(() => {
    if (modo !== 'panorama') return
    if (!mapContainerRef.current || !window.L) return

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        center: [-15.7942, -47.8822], // Centro de Brasília
        zoom: 11,
        zoomControl: false
      })

      window.L.control.zoom({ position: 'bottomright' }).addTo(map)

      markersLojasRef.current = window.L.layerGroup().addTo(map)
      markersMedidoresRef.current = window.L.layerGroup().addTo(map)
      markersDemandasRef.current = window.L.layerGroup().addTo(map)

      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [modo])

  // 3.1 Camadas de Tile (Google Maps Ruas, Satélite, Dark)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.L) return

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current)
    }

    let url = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
    let options = { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], attribution: '&copy; Google Maps' }

    if (tipoMapa === 'google_sat') {
      url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
      options.attribution = '&copy; Google Maps Satélite'
    } else if (tipoMapa === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      options = { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; CartoDB & OpenStreetMap' }
    }

    tileLayerRef.current = window.L.tileLayer(url, options).addTo(map)
  }, [tipoMapa, modo])

  // 3.2 Atualização dos Marcadores no Mapa
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = window.L
    if (!map || !L || modo !== 'panorama') return

    const bounds = []

    // A. Marcadores de Lojas
    if (markersLojasRef.current) {
      markersLojasRef.current.clearLayers()
      if (mostrarLojas) {
        lojas.forEach(loja => {
          const lat = Number(loja.latitude) || -15.8202
          const lon = Number(loja.longitude) || -47.9548
          const osDaLoja = ordens.filter(o => o.loja_id === loja.id)

          const iconeLoja = L.divIcon({
            className: 'icone-torre-loja',
            html: `
              <div style="width: 32px; height: 32px; background: #0f172a; border: 2px solid #38bdf8; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.6); cursor: pointer;">
                🏢
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })

          const m = L.marker([lat, lon], { icon: iconeLoja }).addTo(markersLojasRef.current)
          m.bindPopup(`
            <div style="color: #0f172a; font-family: sans-serif; font-size: 12px; min-width: 190px;">
              <strong style="color: #0284c7; font-size: 13px;">🏢 ${loja.nome_fantasia}</strong><br/>
              <span style="color: #64748b; font-size: 11px;">${loja.endereco || 'Brasília - DF'}</span><br/>
              <span style="color: #64748b; font-size: 11px;">📞 ${loja.telefone || 'N/A'}</span><br/>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                <span style="font-weight: bold; color: #334155;">Volume de OSs:</span>
                <span style="font-weight: 900; color: #0284c7;">${osDaLoja.length}</span>
              </div>
            </div>
          `)
          bounds.push([lat, lon])
        })
      }
    }

    // B. Marcadores de Medidores
    if (markersMedidoresRef.current) {
      markersMedidoresRef.current.clearLayers()
      if (mostrarMedidores) {
        medidoresComStatus.forEach(med => {
          const lat = Number(med.latitude) || -15.7790
          const lon = Number(med.longitude) || -47.9979
          const emRota = med.statusCampo === 'EM_ROTA'

          const corPrincipal = emRota ? '#2563eb' : '#10b981'
          const corPulsante = emRota ? 'rgba(37,99,235,0.35)' : 'rgba(16,185,129,0.35)'

          const iconeMed = L.divIcon({
            className: 'icone-torre-medidor',
            html: `
              <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <div style="position: absolute; width: 42px; height: 42px; background: ${corPulsante}; border-radius: 50%; animation: pulse 2s infinite;"></div>
                <div style="width: 32px; height: 32px; background: ${corPrincipal}; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                  🛵
                </div>
              </div>
            `,
            iconSize: [42, 42],
            iconAnchor: [21, 21]
          })

          const m = L.marker([lat, lon], { icon: iconeMed }).addTo(markersMedidoresRef.current)
          m.bindPopup(`
            <div style="color: #0f172a; font-family: sans-serif; font-size: 12px; min-width: 210px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: #0f172a; font-size: 13px;">${med.nome_completo}</strong>
                <span style="font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 999px; background: ${emRota ? '#dbeafe; color: #1d4ed8;' : '#dcfce7; color: #15803d;'}">
                  ${emRota ? 'EM ROTA' : 'LIVRE'}
                </span>
              </div>
              <span style="color: #64748b; font-size: 11px;">📞 ${med.telefone || 'N/A'}</span><br/>
              <span style="color: #64748b; font-size: 11px;">💰 Taxa: ${formatarMoeda(med.taxa_por_m2)}/m²</span><br/>
              ${emRota ? `<div style="margin-top: 4px; padding: 4px 6px; background: #eff6ff; border-radius: 6px; font-size: 10px; color: #1e40af;"><strong>Cliente:</strong> ${med.osAtual?.cliente_nome}</div>` : ''}
              <button onclick="window.simularMedidorGlobal(${med.id})" style="margin-top: 8px; width: 100%; background: #2563eb; color: white; border: none; padding: 6px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer;">
                👁️ Simular Visão Deste Medidor
              </button>
            </div>
          `)
          bounds.push([lat, lon])
        })
      }
    }

    // C. Marcadores de Demandas / Obras
    if (markersDemandasRef.current) {
      markersDemandasRef.current.clearLayers()
      if (mostrarDemandas) {
        const demandasExibir = ordens.filter(o => o.status === 'PENDENTE_LOJA' || o.status === 'PENDENTE' || o.status === 'EM_ROTA').slice(0, 100)
        demandasExibir.forEach(os => {
          const lat = Number(os.latitude_obra) || -15.7971
          const lon = Number(os.longitude_obra) || -47.8894
          const emRota = os.status === 'EM_ROTA'
          const cor = emRota ? '#2563eb' : '#f59e0b'

          const iconeDemanda = L.divIcon({
            className: 'icone-torre-demanda',
            html: `
              <div style="width: 28px; height: 28px; background: ${cor}; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); cursor: pointer;">
                ${emRota ? '🚀' : '🚨'}
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })

          const m = L.marker([lat, lon], { icon: iconeDemanda }).addTo(markersDemandasRef.current)
          m.bindPopup(`
            <div style="color: #0f172a; font-family: sans-serif; font-size: 12px; min-width: 190px;">
              <strong style="font-size: 13px;">OS #00${os.id} - ${os.cliente_nome}</strong><br/>
              <span style="color: #64748b; font-size: 11px;">📍 ${os.endereco_obra}</span><br/>
              <span style="color: #64748b; font-size: 11px;">🏢 Loja: ${os.loja?.nome_fantasia || 'N/A'}</span><br/>
              <div style="margin-top: 4px; display: flex; justify-content: space-between; font-weight: bold;">
                <span style="color: #334155;">Valor:</span>
                <span style="color: #16a34a;">${formatarMoeda(os.valor_total_os)}</span>
              </div>
            </div>
          `)
          bounds.push([lat, lon])
        })
      }
    }
  }, [lojas, medidoresComStatus, ordens, mostrarLojas, mostrarMedidores, mostrarDemandas, modo])

  // Injetar função global para clique no popup do Leaflet
  useEffect(() => {
    window.simularMedidorGlobal = (id) => {
      setMedidorSimuladoId(id)
      setModo('simulacao')
    }
    return () => { delete window.simularMedidorGlobal }
  }, [])

  const focarNoPonto = (lat, lon) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([Number(lat), Number(lon)], 15, { animate: true, duration: 1.2 })
    }
  }

  const enquadrarTudo = () => {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.setView([-15.7942, -47.8822], 11)
  }

  // Se o admin estiver no modo de simulação de um medidor específico
  if (modo === 'simulacao' && medidorSimuladoId) {
    const medAtual = medidores.find(m => m.id === medidorSimuladoId)
    return (
      <div className="space-y-4">
        {/* Banner de Aviso de Impersonação */}
        <div className="bg-gradient-to-r from-blue-900/80 via-indigo-900/80 to-slate-900 border-2 border-blue-500/50 p-4 md:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30">
              🛵
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                  Modo Simulação Ativo
                </span>
                <span className="text-slate-400 text-xs font-mono">ID #{medidorSimuladoId}</span>
              </div>
              <h2 className="text-lg md:text-xl font-black text-white mt-1">
                Visualizando como: <span className="text-blue-400">{medAtual?.nome_completo || 'Medidor'}</span>
              </h2>
              <p className="text-xs text-slate-300">
                Você tem controle total sobre o roteiro diário, demandas de rua, checklist e caixa deste medidor.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={medidorSimuladoId}
              onChange={(e) => setMedidorSimuladoId(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl outline-none focus:border-blue-500"
            >
              {medidores.map(m => (
                <option key={m.id} value={m.id}>
                  {m.nome_completo} ({m.telefone || 'Sem fone'})
                </option>
              ))}
            </select>

            <button
              onClick={() => { setModo('panorama'); setMedidorSimuladoId(null) }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              ← Voltar à Torre Geral
            </button>
          </div>
        </div>

        {/* Renderiza o painel real do medidor */}
        <PortalUsuario perfil="MEDIDOR" refId={medidorSimuladoId} setToken={setToken} />
      </div>
    )
  }

  // --- VISÃO PANORÂMICA: TORRE DE CONTROLE ---
  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">
      {/* 1. CABEÇALHO DE KPIS DA OPERAÇÃO DE CAMPO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 shrink-0">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-xl">🏢</div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Lojas Conectadas</p>
            <p className="text-xl md:text-2xl font-black text-white">{totalLojas}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-xl">🛵</div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Medidores em Campo</p>
            <div className="flex items-center gap-2">
              <span className="text-xl md:text-2xl font-black text-white">{totalMedidores}</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                {medidoresLivres} livres
              </span>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                {medidoresEmRota} rota
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center text-xl">🚨</div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Demandas Pendentes</p>
            <p className="text-xl md:text-2xl font-black text-amber-400">{demandasAbertas}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xl">🚀</div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Medições em Rota Hoje</p>
            <p className="text-xl md:text-2xl font-black text-indigo-400">{demandasEmRota}</p>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FERRAMENTAS E CONTROLES */}
      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-white uppercase tracking-wider mr-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Torre de Controle
          </span>

          {/* Filtros de Camada */}
          <button
            onClick={() => setMostrarLojas(!mostrarLojas)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${mostrarLojas ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
          >
            🏢 Lojas ({totalLojas})
          </button>

          <button
            onClick={() => setMostrarMedidores(!mostrarMedidores)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${mostrarMedidores ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
          >
            🛵 Medidores ({totalMedidores})
          </button>

          <button
            onClick={() => setMostrarDemandas(!mostrarDemandas)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${mostrarDemandas ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
          >
            📍 Demandas Ativas ({demandasAbertas + demandasEmRota})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Seletor do Tipo de Mapa */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setTipoMapa('google_streets')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${tipoMapa === 'google_streets' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Ruas
            </button>
            <button
              onClick={() => setTipoMapa('google_sat')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${tipoMapa === 'google_sat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Satélite
            </button>
            <button
              onClick={() => setTipoMapa('dark')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${tipoMapa === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Dark
            </button>
          </div>

          <button
            onClick={enquadrarTudo}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
            title="Enquadrar Brasília"
          >
            🎯 Centrar
          </button>

          <button
            onClick={() => setDrawerAberto(!drawerAberto)}
            className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1"
          >
            {drawerAberto ? '✕ Fechar Feed' : '📋 Abrir Feed'}
          </button>
        </div>
      </div>

      {/* 3. ÁREA PRINCIPAL: MAPA INTERATIVO + FEED LATERAL */}
      <div className="flex-1 flex gap-4 overflow-hidden relative rounded-2xl border border-slate-800 shadow-2xl">
        {/* Container do Mapa Leaflet */}
        <div ref={mapContainerRef} className="flex-1 h-full w-full bg-slate-950 z-10" />

        {/* Drawer Lateral de Operações */}
        {drawerAberto && (
          <aside className="w-80 md:w-96 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 flex flex-col z-20 shrink-0">
            {/* Abas do Feed */}
            <div className="flex border-b border-slate-800 bg-slate-950/60 p-2 gap-1">
              <button
                onClick={() => setAbaFeed('medidores')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${abaFeed === 'medidores' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                🛵 Medidores ({totalMedidores})
              </button>
              <button
                onClick={() => setAbaFeed('demandas')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${abaFeed === 'demandas' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                🚨 Demandas
              </button>
              <button
                onClick={() => setAbaFeed('lojas')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${abaFeed === 'lojas' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                🏢 Lojas ({totalLojas})
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="p-3 border-b border-slate-800">
              <input
                type="text"
                value={buscaFeed}
                onChange={(e) => setBuscaFeed(e.target.value)}
                placeholder={`Buscar no feed de ${abaFeed}...`}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
              />
            </div>

            {/* Conteúdo do Feed com Scroll */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {/* FEED DE MEDIDORES */}
              {abaFeed === 'medidores' && (
                medidoresComStatus
                  .filter(m => m.nome_completo?.toLowerCase().includes(buscaFeed.toLowerCase()) || m.telefone?.includes(buscaFeed))
                  .slice(0, 100)
                  .map(med => (
                    <div key={med.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-black text-xs text-white">{med.nome_completo}</p>
                          <p className="text-[10px] text-slate-500 font-mono">📞 {med.telefone || 'Sem fone'}</p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${med.statusCampo === 'EM_ROTA' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                          {med.statusCampo === 'EM_ROTA' ? 'Em Rota' : 'Livre'}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between mb-2">
                        <span>Taxa: <strong className="text-slate-200">{formatarMoeda(med.taxa_por_m2)}/m²</strong></span>
                        <span>Entregas: <strong className="text-blue-400">{med.totalConcluidas}</strong></span>
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-slate-900">
                        <button
                          onClick={() => focarNoPonto(med.latitude, med.longitude)}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                        >
                          📍 Ver no Mapa
                        </button>
                        <button
                          onClick={() => { setMedidorSimuladoId(med.id); setModo('simulacao') }}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded-lg text-[10px] font-black transition-colors"
                        >
                          👁️ Simular
                        </button>
                      </div>
                    </div>
                  ))
              )}

              {/* FEED DE DEMANDAS */}
              {abaFeed === 'demandas' && (
                ordens
                  .filter(o => o.status === 'PENDENTE_LOJA' || o.status === 'PENDENTE' || o.status === 'EM_ROTA')
                  .filter(o => o.cliente_nome?.toLowerCase().includes(buscaFeed.toLowerCase()) || o.endereco_obra?.toLowerCase().includes(buscaFeed.toLowerCase()))
                  .slice(0, 100)
                  .map(os => (
                    <div key={os.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-mono text-blue-400 font-bold">OS #00{os.id}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${os.status === 'EM_ROTA' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {os.status === 'EM_ROTA' ? 'Em Rota' : 'Pendente'}
                        </span>
                      </div>

                      <p className="font-bold text-xs text-white truncate">{os.cliente_nome}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">📍 {os.endereco_obra}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">🏢 Loja: {os.loja?.nome_fantasia || 'N/A'}</p>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900">
                        <span className="text-[11px] font-black text-emerald-400">{formatarMoeda(os.valor_total_os)}</span>
                        <button
                          onClick={() => focarNoPonto(os.latitude_obra, os.longitude_obra)}
                          className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-[10px] font-bold"
                        >
                          📍 Localizar
                        </button>
                      </div>
                    </div>
                  ))
              )}

              {/* FEED DE LOJAS */}
              {abaFeed === 'lojas' && (
                lojas
                  .filter(l => l.nome_fantasia?.toLowerCase().includes(buscaFeed.toLowerCase()) || l.endereco?.toLowerCase().includes(buscaFeed.toLowerCase()))
                  .slice(0, 100)
                  .map(loja => {
                    const osCount = ordens.filter(o => o.loja_id === loja.id).length
                    return (
                      <div key={loja.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-black text-xs text-sky-400 truncate">{loja.nome_fantasia}</p>
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                            {osCount} OSs
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">📍 {loja.endereco || 'Brasília - DF'}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">📞 {loja.telefone || 'N/A'}</p>

                        <button
                          onClick={() => focarNoPonto(loja.latitude, loja.longitude)}
                          className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-slate-300 py-1 rounded-lg text-[10px] font-bold"
                        >
                          📍 Focar no Mapa
                        </button>
                      </div>
                    )
                  })
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
