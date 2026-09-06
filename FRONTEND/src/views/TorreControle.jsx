import { useState, useEffect, useRef, useMemo } from 'react'
import axios from 'axios'
import PortalUsuario from './PortalUsuario'

// Coordenadas centrais e zoom para os estados cobertos
const COORDENADAS_ESTADOS = {
  DF: { lat: -15.7942, lon: -47.8822, zoom: 11, nome: 'Distrito Federal' },
  SP: { lat: -23.5505, lon: -46.6333, zoom: 10, nome: 'São Paulo' },
  RJ: { lat: -22.9068, lon: -43.1729, zoom: 11, nome: 'Rio de Janeiro' },
  MG: { lat: -19.9167, lon: -43.9345, zoom: 11, nome: 'Minas Gerais' },
  PR: { lat: -25.4284, lon: -49.2733, zoom: 11, nome: 'Paraná' },
  RS: { lat: -30.0346, lon: -51.2177, zoom: 11, nome: 'Rio Grande do Sul' },
  GO: { lat: -16.6869, lon: -49.2648, zoom: 11, nome: 'Goiás' },
  BA: { lat: -12.9777, lon: -38.5016, zoom: 11, nome: 'Bahia' },
}

// Extrai UF e Cidade de endereços textuais e coordenadas
function extrairUfECidade(endereco, lat, lon) {
  let uf = ''
  let cidade = ''

  if (endereco) {
    // Tenta padrão: "..., Cidade - UF" ou "... - Cidade, UF"
    const matchUf = endereco.match(/-\s*([A-Z]{2})(?:\s*$|\s*,)/i) || endereco.match(/,\s*([A-Z]{2})(?:\s*$)/i)
    if (matchUf) uf = matchUf[1].toUpperCase()

    const partes = endereco.split(',')
    if (partes.length > 1) {
      const parteFinal = partes[partes.length - 1]
      const sub = parteFinal.split('-')
      if (sub.length > 1) {
        cidade = sub[0].trim()
      } else {
        cidade = parteFinal.trim()
      }
    }
  }

  // Fallback baseado em coordenadas geográficas
  if (!uf && lat && lon) {
    const nLat = Number(lat)
    if (nLat > -16.2 && nLat < -15.4) { uf = 'DF'; cidade = cidade || 'Brasília'; }
    else if (nLat > -24.2 && nLat < -22.0) { uf = 'SP'; cidade = cidade || 'São Paulo'; }
    else if (nLat > -23.1 && nLat < -22.0) { uf = 'RJ'; cidade = cidade || 'Rio de Janeiro'; }
    else if (nLat > -20.5 && nLat < -19.0) { uf = 'MG'; cidade = cidade || 'Belo Horizonte'; }
    else if (nLat > -26.0 && nLat < -24.8) { uf = 'PR'; cidade = cidade || 'Curitiba'; }
    else if (nLat > -30.5 && nLat < -29.5) { uf = 'RS'; cidade = cidade || 'Porto Alegre'; }
    else if (nLat > -17.2 && nLat < -16.0) { uf = 'GO'; cidade = cidade || 'Goiânia'; }
    else if (nLat > -13.5 && nLat < -12.2) { uf = 'BA'; cidade = cidade || 'Salvador'; }
  }

  if (!uf) uf = 'DF'
  if (!cidade) cidade = uf === 'DF' ? 'Brasília' : 'Capital'

  return { uf, cidade }
}

export default function TorreControle({ perfil, setToken }) {
  const [modo, setModo] = useState('panorama')
  const [medidorSimuladoId, setMedidorSimuladoId] = useState(null)

  // Dados brutos da API
  const [lojas, setLojas] = useState([])
  const [medidores, setMedidores] = useState([])
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)

  // FILTROS AVANÇADOS DO ADMINISTRADOR
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [filtroCidade, setFiltroCidade] = useState('TODAS')
  const [filtroLoja, setFiltroLoja] = useState('TODAS')
  const [filtroMedidor, setFiltroMedidor] = useState('TODOS')
  const [filtroAno, setFiltroAno] = useState('TODOS')
  const [filtroMes, setFiltroMes] = useState('TODOS')
  const [filtroStatusOS, setFiltroStatusOS] = useState('TODOS') // 'TODOS', 'EM_ABERTO', 'EM_EXECUCAO', 'CONCLUIDO', 'CANCELADO'

  // Controles de Visualização do Mapa
  const [tipoMapa, setTipoMapa] = useState('google_streets') // 'google_streets', 'google_sat', 'dark'
  const [mostrarLojas, setMostrarLojas] = useState(true)
  const [mostrarMedidores, setMostrarMedidores] = useState(true)
  const [mostrarDemandas, setMostrarDemandas] = useState(true)
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(true)

  // Drawer Lateral
  const [drawerAberto, setDrawerAberto] = useState(true)
  const [abaFeed, setAbaFeed] = useState('medidores') // 'medidores', 'demandas', 'lojas'
  const [buscaFeed, setBuscaFeed] = useState('')

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
    const interval = setInterval(carregarDadosRede, 30000)
    return () => clearInterval(interval)
  }, [])

  // 2. Análise e extração dinâmica de listas para os Dropdowns
  const { estadosDisponiveis, cidadesDisponiveis, anosDisponiveis } = useMemo(() => {
    const estadosSet = new Set()
    const cidadesSet = new Set()
    const anosSet = new Set()

    lojas.forEach(l => {
      const { uf, cidade } = extrairUfECidade(l.endereco, l.latitude, l.longitude)
      if (uf) estadosSet.add(uf)
      if (cidade && (filtroEstado === 'TODOS' || uf === filtroEstado)) cidadesSet.add(cidade)
    })

    ordens.forEach(o => {
      const { uf, cidade } = extrairUfECidade(o.endereco_obra, o.latitude_obra, o.longitude_obra)
      if (uf) estadosSet.add(uf)
      if (cidade && (filtroEstado === 'TODOS' || uf === filtroEstado)) cidadesSet.add(cidade)
      if (o.criado_em) {
        const ano = new Date(o.criado_em).getFullYear()
        if (ano) anosSet.add(ano.toString())
      }
    })

    return {
      estadosDisponiveis: Array.from(estadosSet).sort(),
      cidadesDisponiveis: Array.from(cidadesSet).sort(),
      anosDisponiveis: Array.from(anosSet).sort().reverse()
    }
  }, [lojas, ordens, filtroEstado])

  // Resetar cidade se o estado mudar
  useEffect(() => {
    setFiltroCidade('TODAS')
  }, [filtroEstado])

  // 3. Aplicação dos Filtros Multi-Dimensionais
  const { lojasFiltradas, medidoresFiltrados, ordensFiltradas } = useMemo(() => {
    // A. Filtro de Lojas
    const lojasRes = lojas.filter(l => {
      const { uf, cidade } = extrairUfECidade(l.endereco, l.latitude, l.longitude)
      if (filtroEstado !== 'TODOS' && uf !== filtroEstado) return false
      if (filtroCidade !== 'TODAS' && cidade !== filtroCidade) return false
      if (filtroLoja !== 'TODAS' && l.id.toString() !== filtroLoja) return false
      return true
    })

    // B. Filtro de Ordens de Serviço
    const ordensRes = ordens.filter(o => {
      const { uf, cidade } = extrairUfECidade(o.endereco_obra, o.latitude_obra, o.longitude_obra)
      if (filtroEstado !== 'TODOS' && uf !== filtroEstado) return false
      if (filtroCidade !== 'TODAS' && cidade !== filtroCidade) return false
      if (filtroLoja !== 'TODAS' && o.loja_id.toString() !== filtroLoja) return false
      if (filtroMedidor !== 'TODOS' && (!o.medidor_id || o.medidor_id.toString() !== filtroMedidor)) return false

      if (o.criado_em) {
        const d = new Date(o.criado_em)
        if (filtroAno !== 'TODOS' && d.getFullYear().toString() !== filtroAno) return false
        if (filtroMes !== 'TODOS') {
          const mesStr = String(d.getMonth() + 1).padStart(2, '0')
          if (mesStr !== filtroMes) return false
        }
      }

      // Status da OS
      if (filtroStatusOS === 'EM_ABERTO' && o.status !== 'PENDENTE_LOJA' && o.status !== 'PENDENTE') return false
      if (filtroStatusOS === 'EM_EXECUCAO' && o.status !== 'EM_ROTA') return false
      if (filtroStatusOS === 'CONCLUIDO' && o.status !== 'CONCLUIDO') return false
      if (filtroStatusOS === 'CANCELADO' && o.status !== 'CANCELADO') return false

      return true
    })

    // C. Filtro de Medidores
    const medidoresRes = medidores.map(m => {
      const osEmRota = ordensRes.find(o => o.medidor_id === m.id && o.status === 'EM_ROTA')
      const totalOSConcluidas = ordensRes.filter(o => o.medidor_id === m.id && o.status === 'CONCLUIDO').length
      const { uf, cidade } = extrairUfECidade(m.endereco, m.latitude, m.longitude)
      return {
        ...m,
        uf,
        cidade,
        statusCampo: osEmRota ? 'EM_ROTA' : 'LIVRE',
        osAtual: osEmRota || null,
        totalConcluidas: totalOSConcluidas
      }
    }).filter(m => {
      if (filtroMedidor !== 'TODOS' && m.id.toString() !== filtroMedidor) return false
      if (filtroEstado !== 'TODOS' && m.uf !== filtroEstado) return false
      if (filtroCidade !== 'TODAS' && m.cidade !== filtroCidade) return false
      return true
    })

    return { lojasFiltradas: lojasRes, medidoresFiltrados: medidoresRes, ordensFiltradas: ordensRes }
  }, [lojas, medidores, ordens, filtroEstado, filtroCidade, filtroLoja, filtroMedidor, filtroAno, filtroMes, filtroStatusOS])

  // KPIs dinâmicos baseados no filtro atual
  const totalLojasExibidas = lojasFiltradas.length
  const totalMedidoresExibidos = medidoresFiltrados.length
  const medidoresEmRotaExibidos = medidoresFiltrados.filter(m => m.statusCampo === 'EM_ROTA').length
  const medidoresLivresExibidos = totalMedidoresExibidos - medidoresEmRotaExibidos
  const demandasAbertasExibidas = ordensFiltradas.filter(o => o.status === 'PENDENTE_LOJA' || o.status === 'PENDENTE').length
  const demandasEmRotaExibidas = ordensFiltradas.filter(o => o.status === 'EM_ROTA').length
  const totalConcluidasExibidas = ordensFiltradas.filter(o => o.status === 'CONCLUIDO').length

  // 4. Inicializar Mapa Leaflet
  useEffect(() => {
    if (modo !== 'panorama') return
    if (!mapContainerRef.current || !window.L) return

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        center: [-15.7942, -47.8822],
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

  // 4.1 Camadas do Mapa
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !window.L) return

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current)

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

  // 4.2 Auto-ajuste de câmera quando o Estado selecionado mudar
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (filtroEstado !== 'TODOS' && COORDENADAS_ESTADOS[filtroEstado]) {
      const alvo = COORDENADAS_ESTADOS[filtroEstado]
      map.flyTo([alvo.lat, alvo.lon], alvo.zoom, { duration: 1.2 })
    }
  }, [filtroEstado])

  // 4.3 Renderizar Marcadores Filtrados no Mapa
  useEffect(() => {
    const map = mapInstanceRef.current
    const L = window.L
    if (!map || !L || modo !== 'panorama') return

    // Lojas
    if (markersLojasRef.current) {
      markersLojasRef.current.clearLayers()
      if (mostrarLojas) {
        lojasFiltradas.forEach(loja => {
          const lat = Number(loja.latitude) || -15.8202
          const lon = Number(loja.longitude) || -47.9548
          const osDaLoja = ordensFiltradas.filter(o => o.loja_id === loja.id)

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
              <span style="color: #64748b; font-size: 11px;">${loja.endereco || 'Endereço não informado'}</span><br/>
              <span style="color: #64748b; font-size: 11px;">📞 ${loja.telefone || 'N/A'}</span><br/>
              <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
                <span style="font-weight: bold; color: #334155;">Volume Filtrado:</span>
                <span style="font-weight: 900; color: #0284c7;">${osDaLoja.length} OSs</span>
              </div>
            </div>
          `)
        })
      }
    }

    // Medidores
    if (markersMedidoresRef.current) {
      markersMedidoresRef.current.clearLayers()
      if (mostrarMedidores) {
        medidoresFiltrados.forEach(med => {
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
        })
      }
    }

    // Demandas e Medições
    if (markersDemandasRef.current) {
      markersDemandasRef.current.clearLayers()
      if (mostrarDemandas) {
        const demandasExibir = ordensFiltradas.slice(0, 150)
        demandasExibir.forEach(os => {
          const lat = Number(os.latitude_obra) || -15.7971
          const lon = Number(os.longitude_obra) || -47.8894
          const emRota = os.status === 'EM_ROTA'
          const concluido = os.status === 'CONCLUIDO'
          
          let cor = '#f59e0b' // pendente (amarelo)
          let iconeEmoji = '🚨'
          if (emRota) { cor = '#2563eb'; iconeEmoji = '🚀'; }
          else if (concluido) { cor = '#10b981'; iconeEmoji = '✅'; }

          const iconeDemanda = L.divIcon({
            className: 'icone-torre-demanda',
            html: `
              <div style="width: 28px; height: 28px; background: ${cor}; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); cursor: pointer;">
                ${iconeEmoji}
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
                <span style="color: #334155;">Status:</span>
                <span style="color: ${cor};">${os.status.replace('_', ' ')}</span>
              </div>
              <div style="margin-top: 2px; display: flex; justify-content: space-between; font-weight: bold;">
                <span style="color: #334155;">Valor:</span>
                <span style="color: #16a34a;">${formatarMoeda(os.valor_total_os)}</span>
              </div>
            </div>
          `)
        })
      }
    }
  }, [lojasFiltradas, medidoresFiltrados, ordensFiltradas, mostrarLojas, mostrarMedidores, mostrarDemandas, modo])

  // Injetar função global de simulação
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

  const limparFiltros = () => {
    setFiltroEstado('TODOS')
    setFiltroCidade('TODAS')
    setFiltroLoja('TODAS')
    setFiltroMedidor('TODOS')
    setFiltroAno('TODOS')
    setFiltroMes('TODOS')
    setFiltroStatusOS('TODOS')
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([-15.7942, -47.8822], 11)
    }
  }

  // MODO SIMULAÇÃO
  if (modo === 'simulacao' && medidorSimuladoId) {
    const medAtual = medidores.find(m => m.id === medidorSimuladoId)
    return (
      <div className="space-y-4">
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

        <PortalUsuario perfil="MEDIDOR" refId={medidorSimuladoId} setToken={setToken} />
      </div>
    )
  }

  // --- MODO PANORAMA (TORRE DE CONTROLE) ---
  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-3">
      {/* 1. CABEÇALHO DE KPIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-xl">🏢</div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Lojas no Filtro</p>
            <p className="text-xl md:text-2xl font-black text-white">{totalLojasExibidas}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-xl">🛵</div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Medidores em Campo</p>
            <div className="flex items-center gap-2">
              <span className="text-xl md:text-2xl font-black text-white">{totalMedidoresExibidos}</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                {medidoresLivresExibidos} livres
              </span>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                {medidoresEmRotaExibidos} rota
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center text-xl">🚨</div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Demandas Pendentes</p>
            <p className="text-xl md:text-2xl font-black text-amber-400">{demandasAbertasExibidas}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-xl">🚀</div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Medições Concluídas</p>
            <p className="text-xl md:text-2xl font-black text-indigo-400">{totalConcluidasExibidas}</p>
          </div>
        </div>
      </div>

      {/* 2. PAINEL DE SUPER FILTROS INTELIGENTES */}
      <div className="bg-slate-900/95 border border-slate-800 p-3 rounded-2xl shrink-0 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-xs font-black text-white uppercase tracking-wider">Filtros da Torre de Controle</span>
            <span className="text-[10px] text-slate-500 font-bold bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
              {ordensFiltradas.length} OSs selecionadas
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={limparFiltros}
              className="text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg font-bold transition-all"
            >
              🔄 Limpar Filtros
            </button>
            <button
              onClick={() => setMostrarFiltrosAvancados(!mostrarFiltrosAvancados)}
              className="text-[10px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg font-bold"
            >
              {mostrarFiltrosAvancados ? '▲ Ocultar Filtros' : '▼ Expandir Filtros'}
            </button>
          </div>
        </div>

        {mostrarFiltrosAvancados && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1 border-t border-slate-800/80">
            {/* 1. ESTADO (UF) */}
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-0.5">🗺️ Estado (UF)</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold py-1.5 px-2 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="TODOS">Todos os Estados</option>
                {estadosDisponiveis.map(uf => (
                  <option key={uf} value={uf}>{uf} - {COORDENADAS_ESTADOS[uf]?.nome || uf}</option>
                ))}
              </select>
            </div>

            {/* 2. CIDADE */}
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-0.5">🏙️ Cidade</label>
              <select
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold py-1.5 px-2 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="TODAS">Todas as Cidades</option>
                {cidadesDisponiveis.map(cid => (
                  <option key={cid} value={cid}>{cid}</option>
                ))}
              </select>
            </div>

            {/* 3. LOJA */}
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-0.5">🏢 Loja Parceira</label>
              <select
                value={filtroLoja}
                onChange={(e) => setFiltroLoja(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold py-1.5 px-2 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="TODAS">Todas as Lojas ({lojasFiltradas.length})</option>
                {lojasFiltradas.slice(0, 100).map(l => (
                  <option key={l.id} value={l.id.toString()}>{l.nome_fantasia}</option>
                ))}
              </select>
            </div>

            {/* 4. MEDIDOR */}
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-0.5">🛵 Medidor</label>
              <select
                value={filtroMedidor}
                onChange={(e) => setFiltroMedidor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold py-1.5 px-2 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="TODOS">Todos os Medidores ({medidoresFiltrados.length})</option>
                {medidoresFiltrados.slice(0, 100).map(m => (
                  <option key={m.id} value={m.id.toString()}>{m.nome_completo}</option>
                ))}
              </select>
            </div>

            {/* 5. STATUS DA MEDIÇÃO */}
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-0.5">⚡ Status</label>
              <select
                value={filtroStatusOS}
                onChange={(e) => setFiltroStatusOS(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold py-1.5 px-2 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="EM_ABERTO">🚨 Em Aberto (Pendente)</option>
                <option value="EM_EXECUCAO">🚀 Em Execução (Em Rota)</option>
                <option value="CONCLUIDO">✅ Concluído</option>
                <option value="CANCELADO">❌ Cancelado</option>
              </select>
            </div>

            {/* 6. ANO */}
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-0.5">📅 Ano</label>
              <select
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold py-1.5 px-2 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="TODOS">Todos os Anos</option>
                {anosDisponiveis.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* 7. MÊS */}
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1 ml-0.5">🗓️ Mês</label>
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs font-bold py-1.5 px-2 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="TODOS">Todos os Meses</option>
                <option value="01">Janeiro</option>
                <option value="02">Fevereiro</option>
                <option value="03">Março</option>
                <option value="04">Abril</option>
                <option value="05">Maio</option>
                <option value="06">Junho</option>
                <option value="07">Julho</option>
                <option value="08">Agosto</option>
                <option value="09">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 3. BARRA DE FERRAMENTAS DO MAPA */}
      <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setMostrarLojas(!mostrarLojas)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${mostrarLojas ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
          >
            🏢 Lojas ({totalLojasExibidas})
          </button>

          <button
            onClick={() => setMostrarMedidores(!mostrarMedidores)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${mostrarMedidores ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
          >
            🛵 Medidores ({totalMedidoresExibidos})
          </button>

          <button
            onClick={() => setMostrarDemandas(!mostrarDemandas)}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${mostrarDemandas ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
          >
            📍 Medições ({ordensFiltradas.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setTipoMapa('google_streets')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${tipoMapa === 'google_streets' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Ruas
            </button>
            <button
              onClick={() => setTipoMapa('google_sat')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${tipoMapa === 'google_sat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Satélite
            </button>
            <button
              onClick={() => setTipoMapa('dark')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${tipoMapa === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Dark
            </button>
          </div>

          <button
            onClick={() => {
              if (mapInstanceRef.current) {
                if (filtroEstado !== 'TODOS' && COORDENADAS_ESTADOS[filtroEstado]) {
                  const c = COORDENADAS_ESTADOS[filtroEstado]
                  mapInstanceRef.current.setView([c.lat, c.lon], c.zoom)
                } else {
                  mapInstanceRef.current.setView([-15.7942, -47.8822], 11)
                }
              }
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition-all flex items-center gap-1"
          >
            🎯 Centrar
          </button>

          <button
            onClick={() => setDrawerAberto(!drawerAberto)}
            className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
          >
            {drawerAberto ? '✕ Fechar Feed' : '📋 Abrir Feed'}
          </button>
        </div>
      </div>

      {/* 4. MAPA + FEED LATERAL */}
      <div className="flex-1 flex gap-3 overflow-hidden relative rounded-2xl border border-slate-800 shadow-2xl">
        <div ref={mapContainerRef} className="flex-1 h-full w-full bg-slate-950 z-10" />

        {drawerAberto && (
          <aside className="w-80 md:w-96 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 flex flex-col z-20 shrink-0">
            <div className="flex border-b border-slate-800 bg-slate-950/60 p-2 gap-1">
              <button
                onClick={() => setAbaFeed('medidores')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${abaFeed === 'medidores' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                🛵 Medidores ({totalMedidoresExibidos})
              </button>
              <button
                onClick={() => setAbaFeed('demandas')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${abaFeed === 'demandas' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                🚨 Medições ({ordensFiltradas.length})
              </button>
              <button
                onClick={() => setAbaFeed('lojas')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${abaFeed === 'lojas' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                🏢 Lojas ({totalLojasExibidas})
              </button>
            </div>

            <div className="p-2.5 border-b border-slate-800">
              <input
                type="text"
                value={buscaFeed}
                onChange={(e) => setBuscaFeed(e.target.value)}
                placeholder={`Buscar no feed de ${abaFeed}...`}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
              {abaFeed === 'medidores' && (
                medidoresFiltrados
                  .filter(m => m.nome_completo?.toLowerCase().includes(buscaFeed.toLowerCase()) || m.telefone?.includes(buscaFeed))
                  .slice(0, 100)
                  .map(med => (
                    <div key={med.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <p className="font-black text-xs text-white">{med.nome_completo}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{med.uf} • {med.cidade}</p>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${med.statusCampo === 'EM_ROTA' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                          {med.statusCampo === 'EM_ROTA' ? 'Em Rota' : 'Livre'}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between mb-2">
                        <span>Taxa: <strong className="text-slate-200">{formatarMoeda(med.taxa_por_m2)}/m²</strong></span>
                        <span>Entregas: <strong className="text-blue-400">{med.totalConcluidas}</strong></span>
                      </div>

                      <div className="flex gap-2 pt-1.5 border-t border-slate-900">
                        <button
                          onClick={() => focarNoPonto(med.latitude, med.longitude)}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 py-1 rounded-lg text-[10px] font-bold"
                        >
                          📍 Ver no Mapa
                        </button>
                        <button
                          onClick={() => { setMedidorSimuladoId(med.id); setModo('simulacao') }}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1 rounded-lg text-[10px] font-black"
                        >
                          👁️ Simular
                        </button>
                      </div>
                    </div>
                  ))
              )}

              {abaFeed === 'demandas' && (
                ordensFiltradas
                  .filter(o => o.cliente_nome?.toLowerCase().includes(buscaFeed.toLowerCase()) || o.endereco_obra?.toLowerCase().includes(buscaFeed.toLowerCase()))
                  .slice(0, 100)
                  .map(os => (
                    <div key={os.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono text-blue-400 font-bold">OS #00${os.id}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${os.status === 'EM_ROTA' ? 'bg-blue-500/20 text-blue-400' : (os.status === 'CONCLUIDO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400')}`}>
                          {os.status.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="font-bold text-xs text-white truncate">{os.cliente_nome}</p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">📍 {os.endereco_obra}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">🏢 Loja: {os.loja?.nome_fantasia || 'N/A'}</p>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-900">
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

              {abaFeed === 'lojas' && (
                lojasFiltradas
                  .filter(l => l.nome_fantasia?.toLowerCase().includes(buscaFeed.toLowerCase()) || l.endereco?.toLowerCase().includes(buscaFeed.toLowerCase()))
                  .slice(0, 100)
                  .map(loja => {
                    const osCount = ordensFiltradas.filter(o => o.loja_id === loja.id).length
                    const { uf, cidade } = extrairUfECidade(loja.endereco, loja.latitude, loja.longitude)
                    return (
                      <div key={loja.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-black text-xs text-sky-400 truncate">{loja.nome_fantasia}</p>
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                            {osCount} OSs
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">📍 {cidade} - {uf}</p>
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
