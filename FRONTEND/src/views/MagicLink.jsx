import { useEffect, useState, useMemo, useRef } from 'react'
import axios from 'axios'

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

function MapaRastreioCliente({ os }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef(null);
  const [posMedidor, setPosMedidor] = useState({
    lat: Number(os?.medidor?.latitude) || -23.550520,
    lon: Number(os?.medidor?.longitude) || -46.633308
  });

  useEffect(() => {
    if (!os?.medidor_id) return;
    const buscarLocalizacao = () => {
      axios.get(`/api/medidores/${os.medidor_id}/localizacao`).then(res => {
        if (res.data?.latitude && res.data?.longitude) {
          setPosMedidor({ lat: Number(res.data.latitude), lon: Number(res.data.longitude) });
        }
      }).catch(() => {});
    };
    buscarLocalizacao();
    const interval = setInterval(buscarLocalizacao, 6000);
    return () => clearInterval(interval);
  }, [os?.medidor_id]);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    const latObra = Number(os?.latitude_obra) || -23.548900;
    const lonObra = Number(os?.longitude_obra) || -46.638800;
    const latMed = posMedidor.lat;
    const lonMed = posMedidor.lon;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapRef.current, {
        center: [latObra, lonObra],
        zoom: 13,
        zoomControl: false
      });

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      window.L.control.zoom({ position: 'bottomright' }).addTo(map);
      layersRef.current = window.L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const L = window.L;

    if (layersRef.current) {
      layersRef.current.clearLayers();
    }

    const iconeObra = L.divIcon({
      className: 'cliente-casa-icon',
      html: `<div style="width: 36px; height: 36px; background: #059669; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">🏠</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    L.marker([latObra, lonObra], { icon: iconeObra }).addTo(layersRef.current).bindPopup(`<b>Seu Imóvel</b><br/>${os?.endereco_obra || ''}`);

    const iconeMed = L.divIcon({
      className: 'cliente-med-icon',
      html: `<div style="width: 38px; height: 38px; background: #2563eb; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 14px rgba(37,99,235,0.5);">🛵</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    L.marker([latMed, lonMed], { icon: iconeMed }).addTo(layersRef.current).bindPopup(`<b>${os?.medidor?.nome_completo || 'Medidor'}</b><br/>Profissional a caminho`);

    L.polyline([[latMed, lonMed], [latObra, lonObra]], { color: '#2563eb', weight: 3, dashArray: '6, 6' }).addTo(layersRef.current);
    map.fitBounds([[latMed, lonMed], [latObra, lonObra]], { padding: [30, 30], maxZoom: 15 });

  }, [os, posMedidor]);

  const dist = calcularDistanciaKm(posMedidor.lat, posMedidor.lon, Number(os?.latitude_obra) || -23.548900, Number(os?.longitude_obra) || -46.638800);

  return (
    <div className="mt-6 bg-slate-50 border-2 border-blue-500/30 rounded-3xl overflow-hidden shadow-lg w-full text-left">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-90">Rastreamento em Tempo Real</span>
          <p className="font-black text-sm flex items-center gap-1.5 mt-0.5">
            <span>🛵</span> {os?.status === 'NO_LOCAL' ? 'Medidor no Local!' : 'Medidor a Caminho!'}
          </p>
        </div>
        <div className="bg-white/20 backdrop-blur px-3 py-1 rounded-xl text-xs font-mono font-bold">
          ~{dist} km
        </div>
      </div>

      <div className="h-60 w-full relative">
        <div ref={mapRef} className="w-full h-full" />
      </div>

      <div className="p-3 bg-white text-xs text-slate-500 flex justify-between items-center border-t border-slate-100">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          GPS Atualizado ao Vivo
        </span>
        <span className="font-semibold text-slate-700">{os?.medidor?.nome_completo}</span>
      </div>
    </div>
  );
}

const PRESETS_ITENS = {
  'Cozinha / Área Gourmet': [
    { id: 'geladeira', label: 'Geladeira', opcoes: ['Simples (1 Porta)', 'Duplex', 'Side by Side (2 Portas)', 'French Door', 'Apenas Frigobar'] },
    { id: 'fogao', label: 'Fogão / Cooktop', opcoes: ['Cooktop 4 Bocas', 'Cooktop 5 Bocas', 'Cooktop Indução', 'Fogão de Piso', 'Fogão Embutir'] },
    { id: 'forno', label: 'Forno', opcoes: ['Elétrico (Embutir)', 'A Gás (Embutir)', 'De Bancada', 'Forno de Pizza'] },
    { id: 'microondas', label: 'Micro-ondas', opcoes: ['De Embutir', 'De Bancada'] },
    { id: 'coifa', label: 'Coifa / Depurador', opcoes: ['De Parede', 'De Ilha', 'Depurador Simples'] },
    { id: 'lavaloucas', label: 'Lava-louças', opcoes: ['8 Serviços', '10 Serviços', '14 Serviços'] },
    { id: 'purificador', label: 'Purificador / Filtro', opcoes: ['De Parede', 'De Bancada'] }
  ],
  'Quarto / Sala / Corredor': [
    { id: 'cama', label: 'Cama', opcoes: ['Solteiro', 'Viúva', 'Casal Padrão', 'Queen Size', 'King Size', 'Beliche/Bicama'] },
    { id: 'tv', label: 'Televisão', opcoes: ['Até 43 polegadas', '50 a 55 polegadas', '65 polegadas ou maior', 'Não terá TV'] },
    { id: 'ar_condicionado', label: 'Ar-condicionado', opcoes: ['Split Wall (Padrão)', 'Cassete (Teto)', 'De Janela'] },
    { id: 'sofa', label: 'Sofá', opcoes: ['Fixo Padrão', 'Retrátil / Reclinável', 'Sofá em L / Canto'] }
  ],
  'Banheiro (com recortes)': [
    { id: 'cuba', label: 'Cuba da Pia', opcoes: ['De Apoio', 'De Embutir', 'De Sobrepor', 'Esculpida na Pedra'] },
    { id: 'vaso', label: 'Vaso Sanitário', opcoes: ['Com Caixa Acoplada', 'Convencional (Válvula Parede)', 'Suspenso'] },
    { id: 'chuveiro', label: 'Chuveiro', opcoes: ['Elétrico Padrão', 'Ducha (Aquecimento Gás/Solar)', 'Com Banheira'] }
  ],
  'Escritório / Consultório': [
    { id: 'mesa', label: 'Mesa de Trabalho', opcoes: ['Mesa Reta', 'Mesa em L', 'Bancada Dupla'] },
    { id: 'ar_condicionado', label: 'Ar-condicionado', opcoes: ['Split Wall', 'Cassete', 'Portátil'] }
  ],
  'Outro': [
    { id: 'tv', label: 'Televisão', opcoes: ['Pequena', 'Grande'] },
    { id: 'ar_condicionado', label: 'Ar-condicionado', opcoes: ['Split Wall', 'Cassete'] }
  ]
}

export default function MagicLink({ token }) {
  const [os, setOs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [aceito, setAceito] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [enviando, setEnviando] = useState(false)

  // 1. Estado Atualizado: Inclui Data e Hora
  const [briefingGeral, setBriefingGeral] = useState({
    data_agendada: '', hora_agendada: '', // NOVOS CAMPOS
    possui_chave: 'Sim', revestimento_pronto: 'Sim', observacoesGerais: ''
  })

  const [briefingAmbientes, setBriefingAmbientes] = useState({})

  // ==========================================
  // MOTOR DE CALENDÁRIO (DIAS E HORAS)
  // ==========================================
  const diasDisponiveis = useMemo(() => {
    const dias = []
    let d = new Date()
    while(dias.length < 14) { // Gera os próximos 14 dias úteis/sábados
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0) dias.push(new Date(d)) // Pula o Domingo (0)
    }
    return dias
  }, [])

  const horariosDisponiveis = useMemo(() => {
    if (!briefingGeral.data_agendada) return []
    const [ano, mes, dia] = briefingGeral.data_agendada.split('-')
    const dataSelecionada = new Date(ano, mes - 1, dia) // Força a data correta
    
    const isSabado = dataSelecionada.getDay() === 6
    const limite = isSabado ? 12 : 17
    const horas = []
    for (let i = 8; i <= limite; i++) {
      horas.push(`${i.toString().padStart(2, '0')}:00`)
    }
    return horas
  }, [briefingGeral.data_agendada])

  const formatarDataBotao = (data) => {
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    return {
      diaMes: `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}`,
      semana: diasSemana[data.getDay()],
      valorISO: `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}-${data.getDate().toString().padStart(2, '0')}`
    }
  }
  // ==========================================

  useEffect(() => {
    console.log(`🚀 [FRONTEND] 1. Iniciando carregamento do Magic Link. Token da URL: ${token}`);
    setLoading(true);
    setErro(false);

    fetch(`/api/magic/${token}`)
      .then(res => {
        console.log(`📡 [FRONTEND] 2. Backend respondeu com Status HTTP: ${res.status}`);
        if (!res.ok) throw new Error('Link inválido ou expirado');
        return res.json();
      })
      .then(data => {
        console.log('✅ [FRONTEND] 3. Dados da Obra recebidos perfeitamente:', data);
        setOs(data);
        if (data.termos_aceitos) {
          setAceito(true);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ [FRONTEND] 3. Erro no carregamento:', err.message);
        setErro(true);
        setLoading(false);
      });
  }, [token]);

  const toggleItem = (ambId, itemId) => {
    setBriefingAmbientes(prev => {
      const ambData = { ...prev[ambId] }; const itens = { ...ambData.itens }
      if (itens[itemId]) delete itens[itemId]
      else itens[itemId] = { ativo: true, tipo: '', modelo: '' }
      return { ...prev, [ambId]: { ...ambData, itens } }
    })
  }

  const updateItemOption = (ambId, itemId, campo, valor) => {
    setBriefingAmbientes(prev => {
      const ambData = { ...prev[ambId] }; const itens = { ...ambData.itens }
      if (itens[itemId]) itens[itemId] = { ...itens[itemId], [campo]: valor }
      return { ...prev, [ambId]: { ...ambData, itens } }
    })
  }

  const handleAmbTexto = (id, campo, valor) => { setBriefingAmbientes(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } })) }
  const handleAmbCheck = (id, campo) => { setBriefingAmbientes(prev => ({ ...prev, [id]: { ...prev[id], [campo]: !prev[id][campo] } })) }

  const enviarBriefing = async (e) => {
    e.preventDefault()
    if (!briefingGeral.data_agendada || !briefingGeral.hora_agendada) {
      return alert("Por favor, selecione a Data e o Horário da medição.")
    }

    setEnviando(true)
    try {
      const pacoteCompleto = { geral: briefingGeral, ambientes: briefingAmbientes }
      await axios.put(`/api/magic/${token}/aceitar`, { dados_json: JSON.stringify(pacoteCompleto) })
      setShowForm(false); setAceito(true)
    } catch (error) { alert("Erro ao enviar formulário.") } 
    finally { setEnviando(false) }
  }

  // Helper para formatar a data final para exibição na tela de sucesso
  const mostrarDataFormatada = (iso) => {
    if(!iso) return ''
    const partes = iso.split('-')
    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  // Tenta extrair a data se o cliente já enviou
  let dataAgendadaSucesso = ''; let horaAgendadaSucesso = '';
  if (os?.briefing?.dados_json) {
    try {
      const b = JSON.parse(os.briefing.dados_json)
      dataAgendadaSucesso = mostrarDataFormatada(b.geral.data_agendada)
      horaAgendadaSucesso = b.geral.hora_agendada
    } catch(e){}
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Carregando detalhes...</div>
  if (erro) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xl font-black text-red-500">🚫 Link Expirado</div>

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans sm:bg-slate-200 sm:py-10">
      
      <div className={`max-w-md mx-auto bg-white min-h-screen sm:min-h-0 sm:rounded-[2rem] sm:shadow-2xl flex flex-col ${showForm ? 'hidden' : 'block'}`}>
        <div className="bg-blue-600 p-8 text-center text-white">
          <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Autorização de Medição</p>
          <h1 className="text-2xl font-black">{os?.loja?.nome_fantasia}</h1>
        </div>

        {aceito ? (
          <div className="p-10 text-center my-auto flex flex-col items-center">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-5xl mb-6">✅</div>
            <h2 className="text-3xl font-black text-emerald-600">Agendado!</h2>
            <p className="text-slate-500 mt-2 leading-relaxed">Nossa equipe já tem suas especificações e a data foi reservada com sucesso.</p>

            {/* 👇 EXIBIÇÃO DA DATA NA TELA DE SUCESSO 👇 */}
            {dataAgendadaSucesso && (
               <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-2xl w-full flex items-center justify-center gap-3">
                 <span className="text-3xl">📅</span>
                 <div className="text-left">
                   <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Sua medição será em:</p>
                   <p className="font-black text-blue-900 text-lg">{dataAgendadaSucesso} às {horaAgendadaSucesso}</p>
                 </div>
               </div>
            )}
            
            {os?.medidor && (
              <div className="mt-6 bg-slate-50 border border-slate-200 p-5 rounded-2xl w-full text-left">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">O seu medidor será:</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black text-lg border border-blue-200">
                    {os.medidor.nome_completo.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{os.medidor.nome_completo}</p>
                    <p className="text-sm text-slate-500">WhatsApp: {os.medidor.telefone}</p>
                  </div>
                </div>
              </div>
            )}

            {os?.medidor && (os?.status === 'EM_ROTA' || os?.status === 'NO_LOCAL') && (
              <MapaRastreioCliente os={os} />
            )}
          </div>
        ) : (
          <div className="p-8 flex flex-col flex-1">
            <p className="text-xl font-black text-slate-800 mb-2">Olá, {os?.cliente_nome}!</p>
            <p className="text-sm text-slate-500 mb-6">Sua medição foi solicitada. Precisamos que você **escolha a data e hora**, e confirme alguns detalhes do seu imóvel.</p>
            
            {os?.medidor && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Profissional Designado</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black border border-blue-200">
                    {os.medidor.nome_completo.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{os.medidor.nome_completo}</p>
                    <p className="text-xs text-slate-500">{os.medidor.telefone}</p>
                  </div>
                </div>
              </div>
            )}

            <button onClick={() => setShowForm(true)} className="w-full mt-auto bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-lg">
              📅 Agendar e Iniciar
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto sm:p-4 sm:bg-slate-900/50 sm:backdrop-blur-sm">
          <div className="max-w-2xl mx-auto bg-white sm:rounded-[2rem] sm:shadow-2xl overflow-hidden min-h-full flex flex-col animate-fade-in">
            
            <div className="bg-blue-600 p-6 flex justify-between items-center text-white sticky top-0 z-10 shadow-md">
              <h2 className="font-black text-lg">📅 Agendamento e Briefing</h2>
              <button type="button" onClick={() => setShowForm(false)} className="bg-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold">Voltar</button>
            </div>

            <form onSubmit={enviarBriefing} className="p-6 space-y-8 pb-32">
              
              {/* 👇 1. BLOCO DE CALENDÁRIO GAMIFICADO 👇 */}
              <div className="space-y-4 border-b border-slate-200 pb-8">
                <h3 className="text-lg font-black text-blue-600 mb-4">1. Escolha a Data e Hora</h3>
                
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Qual o melhor dia?</p>
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar snap-x">
                    {diasDisponiveis.map(diaObj => {
                      const f = formatarDataBotao(diaObj)
                      const selecionado = briefingGeral.data_agendada === f.valorISO
                      return (
                        <button type="button" key={f.valorISO} onClick={() => setBriefingGeral({...briefingGeral, data_agendada: f.valorISO, hora_agendada: ''})}
                          className={`snap-center flex-shrink-0 flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all w-20 ${selecionado ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md scale-105' : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300'}`}>
                          <span className="text-xs font-bold uppercase mb-1">{f.semana}</span>
                          <span className="text-lg font-black">{f.diaMes.split('/')[0]}</span>
                          <span className="text-[10px] opacity-70">/{f.diaMes.split('/')[1]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className={`transition-opacity duration-500 ${briefingGeral.data_agendada ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4 mb-3">Qual o melhor horário?</p>
                  <div className="flex flex-wrap gap-2">
                    {horariosDisponiveis.length > 0 ? horariosDisponiveis.map(hora => {
                      const selecionado = briefingGeral.hora_agendada === hora
                      return (
                        <button type="button" key={hora} onClick={() => setBriefingGeral({...briefingGeral, hora_agendada: hora})}
                          className={`px-4 py-2 rounded-xl font-black text-sm border-2 transition-all ${selecionado ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'}`}>
                          {hora}
                        </button>
                      )
                    }) : <p className="text-xs text-amber-500">Selecione um dia primeiro.</p>}
                  </div>
                </div>
              </div>

              {/* BLOCO DE INFRAESTRUTURA */}
              <div className="space-y-4 border-b border-slate-200 pb-8">
                <h3 className="text-lg font-black text-blue-600">2. Infraestrutura Geral</h3>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">O imóvel já está liberado (com chaves)?</label>
                  <select value={briefingGeral.possui_chave} onChange={e => setBriefingGeral({...briefingGeral, possui_chave: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500">
                    <option>Sim, já tenho as chaves</option><option>Não, aguardando liberação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">O piso e os revestimentos já estão instalados?</label>
                  <select value={briefingGeral.revestimento_pronto} onChange={e => setBriefingGeral({...briefingGeral, revestimento_pronto: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500">
                    <option>Sim, 100% finalizado</option><option>Não, ainda está em obra</option>
                  </select>
                </div>
              </div>

              {/* BLOCO DE ITENS (GAMIFICADO) */}
              <div className="space-y-6">
                <h3 className="text-lg font-black text-blue-600 mb-4">3. O que você vai colocar em cada ambiente?</h3>
                <p className="text-xs text-slate-500 mb-4 -mt-3">Selecione os itens abaixo para facilitar o projeto dos seus móveis.</p>
                
                {os?.ambientes?.map((amb) => {
                  const itensDesteAmbiente = PRESETS_ITENS[amb.tipo_ambiente] || PRESETS_ITENS['Outro']
                  const estadoDoAmbiente = briefingAmbientes[amb.id]

                  return (
                    <div key={amb.id} className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 p-4 font-black text-slate-800 text-lg border-b border-slate-200 flex items-center gap-2">📍 {amb.nome}</div>
                      <div className="p-5 space-y-6">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Quais itens ficarão aqui?</label>
                          <div className="flex flex-wrap gap-2">
                            {itensDesteAmbiente.map(preset => {
                              const estaAtivo = estadoDoAmbiente?.itens[preset.id]?.ativo
                              return (
                                <button type="button" key={preset.id} onClick={() => toggleItem(amb.id, preset.id)} 
                                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${estaAtivo ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}>
                                  {estaAtivo ? '✓ ' : '+ '} {preset.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {Object.keys(estadoDoAmbiente?.itens || {}).length > 0 && (
                          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                            {itensDesteAmbiente.map(preset => {
                              const itemSelecionado = estadoDoAmbiente?.itens[preset.id]
                              if (!itemSelecionado) return null
                              return (
                                <div key={`detalhe-${preset.id}`} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm animate-fade-in">
                                  <p className="font-bold text-blue-800 mb-2">{preset.label}</p>
                                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 mb-2"
                                    value={itemSelecionado.tipo} onChange={e => updateItemOption(amb.id, preset.id, 'tipo', e.target.value)} required>
                                    <option value="" disabled>Selecione o tamanho/modelo geral...</option>
                                    {preset.opcoes.map(op => <option key={op} value={op}>{op}</option>)}
                                  </select>
                                  <input type="text" placeholder="Sabe a marca ou modelo exato? (Opcional)" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500"
                                    value={itemSelecionado.modelo} onChange={e => updateItemOption(amb.id, preset.id, 'modelo', e.target.value)} />
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Outros itens não listados?</label>
                           <textarea rows="2" placeholder="Ex: Adega de Vinhos..." value={estadoDoAmbiente?.outros_equipamentos || ''} onChange={e => handleAmbTexto(amb.id, 'outros_equipamentos', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-500"></textarea>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Intervenções de obra:</p>
                          <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-slate-700">
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={estadoDoAmbiente?.instalacao_pedra || false} onChange={() => handleAmbCheck(amb.id, 'instalacao_pedra')} className="w-5 h-5 accent-blue-600" /> Terá Mármore/Pedra</label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={estadoDoAmbiente?.rebaixo || false} onChange={() => handleAmbCheck(amb.id, 'rebaixo')} className="w-5 h-5 accent-blue-600" /> Rebaixo de Gesso</label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={estadoDoAmbiente?.eletrica_dif || false} onChange={() => handleAmbCheck(amb.id, 'eletrica_dif')} className="w-5 h-5 accent-blue-600" /> Ponto Elétrico Extra</label>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={estadoDoAmbiente?.hidraulica_dif || false} onChange={() => handleAmbCheck(amb.id, 'hidraulica_dif')} className="w-5 h-5 accent-blue-600" /> Ponto Água Extra</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">📝 Alguma observação geral para o medidor?</label>
                <textarea rows="2" placeholder="Ex: O porteiro precisa autorizar a entrada..." value={briefingGeral.observacoesGerais} onChange={e => setBriefingGeral({...briefingGeral, observacoesGerais: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none focus:border-blue-500"></textarea>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 sm:relative sm:border-t-0 sm:p-0 sm:bg-transparent">
                <button type="submit" disabled={enviando} className="w-full max-w-2xl mx-auto bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg flex justify-center items-center gap-2">
                  {enviando ? 'Enviando...' : '✅ Salvar Respostas e Agendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}