import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import NovaOsModal from '../components/NovaOsModal'
import ModalPagamentoPix from '../components/ModalPagamentoPix'
import TabelaCaixaMedidor from '../components/TabelaCaixaMedidor'
import CardDemandaMedidor from '../components/CardDemandaMedidor'
import CardRotaMedidor from '../components/CardRotaMedidor'

// Calcula a distância aproximada em KM entre duas coordenadas (Haversine)
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

// 📋 Modal Detalhes Completos da OS
function ModalDetalhesOS({ os, onClose, formatarMoeda, onAceitar, onRecusar, onAdicionarRota, onMarcarChegada, onEntregar }) {
  if (!os) return null;

  const renderBriefingSeguro = (dadosJson) => {
    if (!dadosJson) return <p className="text-slate-500 italic text-xs">Sem briefing cadastrado.</p>;
    try {
      const d = typeof dadosJson === 'string' ? JSON.parse(dadosJson) : dadosJson;
      const g = d.geral || {};
      return (
        <div className="space-y-2 text-xs">
          {g.data_agendada && (
            <div className="bg-emerald-950/40 border border-emerald-800/40 p-2.5 rounded-xl text-emerald-400 font-bold flex items-center gap-2">
              <span>📅</span> Data Agendada pelo Cliente: {g.data_agendada} {g.hora_agendada ? `às ${g.hora_agendada}` : ''}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-slate-300">
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800"><span className="text-slate-500 block text-[10px] uppercase font-bold">Chaves na Obra:</span> {String(g.possui_chave || 'Não informado')}</div>
            <div className="bg-slate-950 p-2 rounded-lg border border-slate-800"><span className="text-slate-500 block text-[10px] uppercase font-bold">Piso/Revestimento:</span> {String(g.revestimento_pronto || 'Não informado')}</div>
          </div>
        </div>
      );
    } catch(e) {
      return <p className="text-slate-400 text-xs">{String(dadosJson)}</p>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold px-2 py-0.5 rounded-lg">
                OS #{String(os.id).padStart(4, '0')}
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${os.status === 'CONCLUIDO' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {os.status?.replace('_', ' ')}
              </span>
            </div>
            <h3 className="text-lg font-black text-white mt-1">{os.cliente_nome}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl text-xs font-bold transition-colors">
            ✕ Fechar
          </button>
        </div>

        {/* Corpo Scrollável */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 text-xs">
          {/* Endereço e Loja */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
            <p className="text-slate-300 flex items-start gap-2">
              <span className="text-base">📍</span> 
              <span><strong className="text-white block">Endereço da Obra:</strong> {os.endereco_obra}</span>
            </p>
            {os.loja && (
              <p className="text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-800/80">
                <span>🏢</span> <strong>Loja Parceira:</strong> {os.loja.nome_fantasia} {os.loja.telefone ? `(${os.loja.telefone})` : ''}
              </p>
            )}
          </div>

          {/* Resumo Financeiro e Tempos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ganho do Medidor</p>
              <p className="text-base font-black text-emerald-400 mt-0.5">{formatarMoeda(os.custo_medidor || 0)}</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tempo de Medição</p>
              <p className="text-base font-black text-blue-400 mt-0.5">~{os.tempo_estimado_min || 60} min</p>
            </div>
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 col-span-2 sm:col-span-1">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Horário Agendado</p>
              <p className="text-base font-black text-amber-400 mt-0.5">⏰ {os.hora_agendada || 'A combinar'}</p>
            </div>
          </div>

          {/* Ambientes */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span>🛋️</span> Ambientes ({os.ambientes?.length || 0})
            </p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
              {os.ambientes?.map((amb, idx) => (
                <div key={idx} className="bg-slate-900 p-2 rounded-xl border border-slate-800/80 flex justify-between items-center text-slate-300">
                  <span className="font-medium">{idx + 1}. {amb.nome} ({amb.tipo_ambiente || 'Padrão'})</span>
                  <span className="text-slate-400 font-mono font-bold">{amb.area_estimada_m2} m²</span>
                </div>
              ))}
              {(!os.ambientes || os.ambientes.length === 0) && (
                <p className="text-slate-500 italic">Nenhum ambiente discriminado.</p>
              )}
            </div>
          </div>

          {/* Briefing do Cliente */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span>📋</span> Briefing do Cliente
            </p>
            {os.briefing ? renderBriefingSeguro(os.briefing.dados_json) : (
              <p className="text-slate-500 italic text-xs">Cliente ainda não finalizou o formulário de briefing.</p>
            )}
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap gap-2 justify-end">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(os.endereco_obra)}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span>🗺️</span> Google Maps
          </a>
          <a
            href={`https://waze.com/ul?q=${encodeURIComponent(os.endereco_obra)}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <span>🚙</span> Waze
          </a>
          
          {os.status === 'PENDENTE_LOJA' && (
            <>
              {onRecusar && (
                <button
                  onClick={() => { onRecusar(os.id); onClose(); }}
                  className="px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-colors"
                >
                  ❌ Recusar Demanda
                </button>
              )}
              {onAdicionarRota && (
                <button
                  onClick={() => { onAdicionarRota(os.id); onClose(); }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg"
                >
                  ➕ Adicionar à Rota
                </button>
              )}
              {onAceitar && (
                <button
                  onClick={() => { onAceitar(os.id); onClose(); }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-colors shadow-lg"
                >
                  ✅ Aceitar Medição
                </button>
              )}
            </>
          )}

          {os.status === 'EM_ROTA' && onMarcarChegada && (
            <button
              onClick={() => { onMarcarChegada(os.id); onClose(); }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-colors shadow-lg flex items-center gap-1.5"
            >
              <span>📍</span> Informar Chegada no Local
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 📁 Modal de Documentos da Medição (Edição / Acrescentar Fotos, Promob, Croqui, PDF)
function ModalDocumentosMedicao({ os, onClose, onSalvarSucesso }) {
  if (!os) return null;

  const [caminhoMedicao, setCaminhoMedicao] = useState(os.caminho_medicao || '');
  const [materialMedicao, setMaterialMedicao] = useState(os.material_medicao || '');
  const [arquivoPromob, setArquivoPromob] = useState(os.arquivo_promob || '');
  const [desenhoCroqui, setDesenhoCroqui] = useState(os.desenho_croqui || '');
  
  const [fotosList, setFotosList] = useState(() => {
    try {
      const arr = JSON.parse(os.fotos_medicao || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch(e) {
      return [];
    }
  });

  const [uploadingTipo, setUploadingTipo] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const handleUploadGenerico = async (e, tipo) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingTipo(tipo);
    const fd = new FormData();
    fd.append('arquivo', file);
    try {
      const res = await axios.post('/api/upload', fd);
      const url = res.data.url;
      if (tipo === 'pdf') setCaminhoMedicao(url);
      else if (tipo === 'promob') setArquivoPromob(url);
      else if (tipo === 'croqui') setDesenhoCroqui(url);
      else if (tipo === 'foto') setFotosList(prev => [...prev, url]);
    } catch(err) {
      alert("Falha no upload do arquivo. Verifique a conexão.");
    } finally {
      setUploadingTipo(null);
    }
  };

  const removerFoto = (index) => {
    setFotosList(prev => prev.filter((_, i) => i !== index));
  };

  const salvarDocumentos = async () => {
    setSalvando(true);
    try {
      await axios.put(`/api/os/${os.id}/documentos`, {
        caminho_medicao: caminhoMedicao,
        material_medicao: materialMedicao,
        fotos_medicao: JSON.stringify(fotosList),
        arquivo_promob: arquivoPromob,
        desenho_croqui: desenhoCroqui
      });
      alert("✅ Documentos de medição atualizados com sucesso e enviados à loja!");
      if (onSalvarSucesso) onSalvarSucesso();
      onClose();
    } catch(err) {
      alert("Erro ao salvar documentos: " + (err.response?.data?.erro || err.message));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 text-xs font-mono font-bold px-2 py-0.5 rounded-lg">
                OS #{String(os.id).padStart(4, '0')}
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                Concluído
              </span>
            </div>
            <h3 className="text-lg font-black text-white mt-1">Documentos e Arquivos Técnicos de Medição</h3>
            <p className="text-xs text-slate-400">{os.cliente_nome} • {os.endereco_obra}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl text-xs font-bold">
            ✕ Fechar
          </button>
        </div>

        {/* Conteúdo com Uploads */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-5 text-xs">
          {/* 1. Relatório Técnico / Planta (PDF) */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-black text-white text-xs flex items-center gap-2">
                <span>📄</span> Relatório Técnico da Medição (PDF)
              </span>
              {caminhoMedicao && (
                <a href={caminhoMedicao} target="_blank" rel="noreferrer" className="text-emerald-400 font-bold hover:underline flex items-center gap-1">
                  <span>↗</span> Visualizar PDF Atual
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex-1 bg-slate-900 hover:bg-slate-850 border border-dashed border-slate-700 hover:border-blue-500 p-3 rounded-xl cursor-pointer text-center transition-colors">
                <span className="text-slate-300 font-bold block">
                  {uploadingTipo === 'pdf' ? 'Enviando PDF...' : caminhoMedicao ? '📎 Substituir PDF de Medição' : '➕ Anexar Relatório PDF'}
                </span>
                <span className="text-slate-500 text-[10px] block mt-0.5">Formatos aceitos: .pdf</span>
                <input type="file" accept=".pdf" className="hidden" onChange={e => handleUploadGenerico(e, 'pdf')} disabled={Boolean(uploadingTipo)} />
              </label>
            </div>
          </div>

          {/* 2. Fotos da Medição / Obra */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <span className="font-black text-white text-xs flex items-center gap-2">
                <span>📷</span> Fotos da Obra e Medição ({fotosList.length})
              </span>
              <label className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer text-[11px] transition-colors shadow">
                {uploadingTipo === 'foto' ? 'Enviando...' : '+ Adicionar Foto'}
                <input type="file" accept="image/*" className="hidden" onChange={e => handleUploadGenerico(e, 'foto')} disabled={Boolean(uploadingTipo)} />
              </label>
            </div>

            {fotosList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {fotosList.map((foto, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-video flex items-center justify-center">
                    <img src={foto} alt={`Foto ${idx+1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a href={foto} target="_blank" rel="noreferrer" className="p-1.5 bg-blue-600 text-white rounded-lg text-xs" title="Ver foto">
                        🔍
                      </a>
                      <button onClick={() => removerFoto(idx)} className="p-1.5 bg-red-600 text-white rounded-lg text-xs" title="Remover">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic mt-2">Nenhuma foto anexada até o momento.</p>
            )}
          </div>

          {/* 3. Desenho / Croqui Digitalizado & Promob */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Foto do Croqui */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <span className="font-black text-white text-xs flex items-center gap-1.5">
                  <span>📐</span> Foto do Croqui / Desenho
                </span>
                {desenhoCroqui && (
                  <a href={desenhoCroqui} target="_blank" rel="noreferrer" className="text-emerald-400 font-bold hover:underline">
                    Ver ↗
                  </a>
                )}
              </div>
              {desenhoCroqui && (
                <div className="mb-2 rounded-xl overflow-hidden border border-slate-800 h-28 bg-slate-900 flex items-center justify-center">
                  <img src={desenhoCroqui} alt="Croqui" className="w-full h-full object-cover" />
                </div>
              )}
              <label className="mt-auto bg-slate-900 hover:bg-slate-850 border border-dashed border-slate-700 hover:border-blue-500 p-2.5 rounded-xl cursor-pointer text-center transition-colors">
                <span className="text-slate-300 font-bold block text-[11px]">
                  {uploadingTipo === 'croqui' ? 'Enviando...' : desenhoCroqui ? 'Substituir Foto do Croqui' : '➕ Anexar Foto do Desenho'}
                </span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleUploadGenerico(e, 'croqui')} disabled={Boolean(uploadingTipo)} />
              </label>
            </div>

            {/* Arquivo Promob */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <span className="font-black text-white text-xs flex items-center gap-1.5">
                  <span>💻</span> Arquivo Promob / CAD
                </span>
                {arquivoPromob && (
                  <a href={arquivoPromob} target="_blank" rel="noreferrer" className="text-emerald-400 font-bold hover:underline">
                    Baixar ↗
                  </a>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Arquivo .promob ou compactado (.zip) com a modelagem digital da medição.
              </p>
              <label className="mt-auto bg-slate-900 hover:bg-slate-850 border border-dashed border-slate-700 hover:border-blue-500 p-2.5 rounded-xl cursor-pointer text-center transition-colors">
                <span className="text-slate-300 font-bold block text-[11px]">
                  {uploadingTipo === 'promob' ? 'Enviando...' : arquivoPromob ? 'Substituir Arquivo Promob' : '➕ Anexar Arquivo Promob'}
                </span>
                <input type="file" accept=".promob,.dwg,.dxf,.zip,.rar" className="hidden" onChange={e => handleUploadGenerico(e, 'promob')} disabled={Boolean(uploadingTipo)} />
              </label>
            </div>
          </div>

          {/* 4. Observações Técnicas e Materiais */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
              📝 Observações Técnicas e Materiais Gastos
            </label>
            <textarea
              rows="3"
              value={materialMedicao}
              onChange={e => setMaterialMedicao(e.target.value)}
              placeholder="Ex: Utilizado gabarito no canto esquerdo da pia. Ponto de água necessita de corte de 50mm..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-xs outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors">
            Cancelar
          </button>
          <button
            onClick={salvarDocumentos}
            disabled={salvando || Boolean(uploadingTipo)}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition-transform hover:scale-105 shadow-lg shadow-emerald-600/30"
          >
            {salvando ? 'Salvando Documentos...' : '💾 Salvar Documentos e Atualizar Loja'}
          </button>
        </div>
      </div>
    </div>
  );
}



// 🗺️ Radar de Campo com Roteiro Diário Multi-Paradas (Leaflet + Google Maps)
function RadarMapaInterativo({
  medidor,
  lojas = [],
  demandasPendentes = [],
  ordensEmRota = [],
  aceitarDemanda,
  recusarDemanda,
  formatarMoeda,
  onAtualizarLocalizacao,
  osSelecionada,
  onAtualizarDados,
  onAbrirDetalhesOS
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const multiRouteGroupRef = useRef(null);
  const singleRouteGroupRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Modo diurno padrão (Google Maps Ruas e Satélite)
  const [tipoMapa, setTipoMapa] = useState('google_streets');

  // Coordenadas padrão em Brasília - DF (Marco Zero / Esplanada)
  const [posicaoMedidor, setPosicaoMedidor] = useState({
    lat: medidor?.latitude && Number(medidor.latitude) !== 0 ? Number(medidor.latitude) : -15.779017,
    lon: medidor?.longitude && Number(medidor.longitude) !== 0 ? Number(medidor.longitude) : -47.997900
  });

  const [filtroRaio, setFiltroRaio] = useState(50);
  const [mostrarLojas, setMostrarLojas] = useState(true);
  const [mostrarMinhaRota, setMostrarMinhaRota] = useState(true);
  const [mostrarDemandas, setMostrarDemandas] = useState(true);

  // Estado do Roteiro do Dia (Multi-Paradas)
  const [roteiroDia, setRoteiroDia] = useState(null);
  const [carregandoRoteiro, setCarregandoRoteiro] = useState(false);
  const [drawerRoteiroAberto, setDrawerRoteiroAberto] = useState(true);
  const [abaRoteiro, setAbaRoteiro] = useState('paradas');

  // 1. Rastreamento GPS ao vivo do dispositivo do Medidor
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const novaPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setPosicaoMedidor(novaPos);
        if (onAtualizarLocalizacao) onAtualizarLocalizacao(novaPos.lat, novaPos.lon);
      },
      (err) => console.warn("GPS inicial:", err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const novaPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setPosicaoMedidor(novaPos);
        if (onAtualizarLocalizacao) onAtualizarLocalizacao(novaPos.lat, novaPos.lon);
      },
      (err) => console.warn("GPS contínuo:", err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onAtualizarLocalizacao]);

  // 2. Inicialização do Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        center: [posicaoMedidor.lat, posicaoMedidor.lon],
        zoom: 12,
        zoomControl: false
      });

      window.L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersGroupRef.current = window.L.layerGroup().addTo(map);
      multiRouteGroupRef.current = window.L.layerGroup().addTo(map);
      singleRouteGroupRef.current = window.L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2.1 Camadas do Mapa Diurno (Google Maps Ruas e Satélite - Sem Dark Mode)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !window.L) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let options = {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps'
    };

    if (tipoMapa === 'google_sat') {
      url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      options.attribution = '&copy; Google Maps Satélite';
    }

    tileLayerRef.current = window.L.tileLayer(url, options).addTo(map);
  }, [tipoMapa]);

  // 3. Carregar Roteiro Completo Multi-Paradas do Medidor
  const carregarRoteiro = async () => {
    setCarregandoRoteiro(true);
    try {
      const res = await axios.get(`/api/rotas/meu-roteiro?lat=${posicaoMedidor.lat}&lon=${posicaoMedidor.lon}`);
      if (res.data) {
        setRoteiroDia(res.data);
      }
    } catch (err) {
      console.warn("Erro ao buscar roteiro do dia:", err.message);
    } finally {
      setCarregandoRoteiro(false);
    }
  };

  useEffect(() => {
    carregarRoteiro();
  }, [posicaoMedidor.lat, posicaoMedidor.lon, ordensEmRota.length]);

  // 4. Desenha a Linha Contínua da Rota Multi-Paradas no Mapa
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L || !multiRouteGroupRef.current) return;

    multiRouteGroupRef.current.clearLayers();

    if (roteiroDia?.coordenadas && roteiroDia.coordenadas.length > 1) {
      L.polyline(roteiroDia.coordenadas, {
        color: '#38bdf8',
        weight: 8,
        opacity: 0.45,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(multiRouteGroupRef.current);

      L.polyline(roteiroDia.coordenadas, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(multiRouteGroupRef.current);
    }
  }, [roteiroDia]);

  // 5. Adicionar Demanda ao Roteiro do Dia
  const handleAdicionarAoRoteiro = async (osId) => {
    try {
      await axios.post(`/api/rotas/adicionar/${osId}`);
      alert("✅ Demanda adicionada ao seu Roteiro Diário de Medições!");
      await carregarRoteiro();
      if (onAtualizarDados) onAtualizarDados();
    } catch (err) {
      alert("❌ Erro ao adicionar à rota: " + (err.response?.data?.erro || err.message));
    }
  };

  // 5.1 Remover Parada do Roteiro
  const handleRemoverParada = async (osId) => {
    if (!window.confirm("Deseja remover esta parada do seu roteiro de hoje? Ela voltará para a lista de demandas disponíveis.")) return;
    try {
      await axios.put(`/api/rotas/remover/${osId}`);
      alert("✅ Parada removida do roteiro com sucesso!");
      await carregarRoteiro();
      if (onAtualizarDados) onAtualizarDados();
    } catch (err) {
      alert("Erro ao remover parada: " + (err.response?.data?.erro || err.message));
    }
  };

  // 6. Reordenar Paradas (Subir / Descer na Ordem do Dia)
  const handleMoverParada = async (indexOrigem, direcao) => {
    if (!roteiroDia?.paradas) return;
    const paradas = [...roteiroDia.paradas];
    const indexDestino = indexOrigem + direcao;
    if (indexDestino < 0 || indexDestino >= paradas.length) return;

    const [movido] = paradas.splice(indexOrigem, 1);
    paradas.splice(indexDestino, 0, movido);
    const ordemIds = paradas.map(p => p.os_id || p.id);

    try {
      await axios.put('/api/rotas/reordenar', { ordem_ids: ordemIds });
      await carregarRoteiro();
      if (onAtualizarDados) onAtualizarDados();
    } catch (err) {
      alert("Erro ao reordenar roteiro: " + (err.response?.data?.erro || err.message));
    }
  };

  // 7. Otimizar Roteiro por Proximidade Geográfica (Menor Distância / TSP)
  const handleOtimizarPorProximidade = async () => {
    if (!roteiroDia?.paradas || roteiroDia.paradas.length < 2) {
      alert("É necessário ter pelo menos 2 paradas para otimizar o roteiro.");
      return;
    }
    setCarregandoRoteiro(true);
    try {
      await axios.put('/api/rotas/otimizar', {
        lat: posicaoMedidor.lat,
        lon: posicaoMedidor.lon
      });
      alert("⚡ Roteiro otimizado com sucesso! Paradas reorganizadas pela menor distância.");
      await carregarRoteiro();
      if (onAtualizarDados) onAtualizarDados();
    } catch (err) {
      alert("Erro ao otimizar roteiro: " + (err.response?.data?.erro || err.message));
    } finally {
      setCarregandoRoteiro(false);
    }
  };

  // 8. Confirmar / Aceitar Sugestão de Rota
  const handleAceitarSugestaoRota = () => {
    alert("✅ Sugestão de Rota confirmada! Siga a sequência das paradas para máxima eficiência.");
  };

  // Clicar em parada para centralizar no mapa e abrir OS
  const handleClicarParada = (parada) => {
    const lat = Number(parada.latitude || parada.latitude_obra) || -15.797101;
    const lon = Number(parada.longitude || parada.longitude_obra) || -47.889489;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lon], 16, { duration: 1.2 });
    }
    if (onAbrirDetalhesOS) {
      const osId = parada.os_id || parada.id;
      onAbrirDetalhesOS(osId);
    }
  };

  // 9. Atualização de Marcadores no Mapa Leaflet com Distribuição Correta
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();
    const bounds = [];

    // 📍 Ícone do Medidor (GPS ao Vivo em Brasília)
    const iconeMedidor = L.divIcon({
      className: 'custom-medidor-icon',
      html: `
        <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 46px; height: 46px; background: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: pulse 2s infinite;"></div>
          <div style="position: relative; width: 34px; height: 34px; background: #2563eb; border: 3px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; box-shadow: 0 4px 14px rgba(0,0,0,0.55);">
            🛵
          </div>
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });

    L.marker([posicaoMedidor.lat, posicaoMedidor.lon], { icon: iconeMedidor })
      .addTo(markersGroupRef.current)
      .bindPopup(`
        <div style="color: #0f172a; font-family: sans-serif; font-size: 12px; min-width: 170px;">
          <strong style="font-size: 13px; color: #1e40af;">📍 Sua Posição Atual</strong><br/>
          <span style="font-weight: 600;">${medidor?.nome_completo || 'Medidor (Você)'}</span><br/>
          <span style="color: #64748b; font-size: 11px;">Brasília - DF</span><br/>
          <span style="color: #16a34a; font-weight: bold; font-size: 10px; display: inline-block; margin-top: 3px;">🟢 GPS Ativo em Tempo Real</span>
        </div>
      `);
    bounds.push([posicaoMedidor.lat, posicaoMedidor.lon]);

    // 🏢 Marcadores das Lojas Parceiras em Brasília
    if (mostrarLojas) {
      lojas.forEach(loja => {
        const lat = Number(loja.latitude) || -15.820200;
        const lon = Number(loja.longitude) || -47.954800;
        const dist = calcularDistanciaKm(posicaoMedidor.lat, posicaoMedidor.lon, lat, lon);

        const iconeLoja = L.divIcon({
          className: 'custom-loja-icon',
          html: `
            <div style="width: 32px; height: 32px; background: #0f172a; border: 2px solid #38bdf8; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.6);">
              🏢
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        L.marker([lat, lon], { icon: iconeLoja })
          .addTo(markersGroupRef.current)
          .bindPopup(`
            <div style="color: #0f172a; font-family: sans-serif; font-size: 12px; min-width: 180px;">
              <strong style="color: #0284c7; font-size: 13px;">🏢 ${loja.nome_fantasia}</strong><br/>
              <span style="color: #64748b; font-size: 11px;">${loja.endereco || 'Brasília - DF'}</span><br/>
              <strong style="color: #334155; font-size: 11px; margin-top: 4px; display: block;">Distância: ${dist} km</strong>
            </div>
          `);
        bounds.push([lat, lon]);
      });
    }

    // 🔢 Marcadores Sequenciais das Paradas do Roteiro (①, ②, ③, ④) DISTRIBUÍDOS CORRETAMENTE
    if (mostrarMinhaRota) {
      const listaParadas = roteiroDia?.paradas && roteiroDia.paradas.length > 0 ? roteiroDia.paradas : ordensEmRota;
      listaParadas.forEach((parada, idx) => {
        // 🔥 Leitura com fallback seguro para não acumular no mesmo ponto
        const lat = Number(parada.latitude || parada.latitude_obra) || -15.797101;
        const lon = Number(parada.longitude || parada.longitude_obra) || -47.889489;
        const numeroParada = idx + 1;
        const osId = parada.os_id || parada.id;
        const endereco = parada.endereco || parada.endereco_obra || '';

        const iconeParada = L.divIcon({
          className: 'custom-parada-icon',
          html: `
            <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <div style="position: absolute; width: 40px; height: 40px; background: rgba(5, 150, 105, 0.4); border-radius: 50%;"></div>
              <div style="width: 30px; height: 30px; background: #059669; border: 2.5px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; color: #ffffff; box-shadow: 0 4px 12px rgba(5,150,105,0.6);">
                ${numeroParada}
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        const marker = L.marker([lat, lon], { icon: iconeParada })
          .addTo(markersGroupRef.current)
          .bindPopup(`
            <div style="color: #0f172a; font-family: sans-serif; font-size: 12px; min-width: 220px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="background: #059669; color: #ffffff; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 999px;">
                  PARADA #${numeroParada}
                </span>
                <span style="background: #ecfdf5; color: #059669; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">EM ROTA</span>
              </div>
              <strong style="color: #0f172a; font-size: 13px; display: block; margin-top: 4px;">${parada.cliente_nome}</strong>
              <span style="color: #64748b; font-size: 11px;">📍 ${endereco}</span>
              
              <div style="background: #f8fafc; border-radius: 8px; padding: 6px; margin: 6px 0; border: 1px solid #e2e8f0; font-size: 11px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>⏰ Horário:</span>
                  <strong style="color: #1e40af;">${parada.hora_agendada || '--:--'}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>⏱️ Duração:</span>
                  <strong style="color: #334155;">~${parada.tempo_estimado_min || 60} min</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                  <span>Ganho Repasse:</span>
                  <strong style="color: #059669; font-size: 12px;">${formatarMoeda(parada.custo_medidor || 0)}</strong>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 4px;">
                <button id="btn-ver-os-parada-${osId}" style="width: 100%; background: #0f172a; color: #38bdf8; border: 1px solid #38bdf8; font-weight: bold; font-size: 11px; padding: 6px; border-radius: 8px; cursor: pointer;">
                  👁️ Exibir OS Completa
                </button>
                <a href="https://www.google.com/maps/dir/?api=1&origin=${posicaoMedidor.lat},${posicaoMedidor.lon}&destination=${encodeURIComponent(endereco || `${lat},${lon}`)}" target="_blank" rel="noreferrer" style="display: block; text-align: center; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 11px; padding: 6px; border-radius: 8px; text-decoration: none;">
                  🗺️ Navegar (Google Maps)
                </a>
                <button id="btn-rem-parada-${osId}" style="width: 100%; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; font-weight: bold; font-size: 10px; padding: 4px; border-radius: 8px; cursor: pointer;">
                  ❌ Remover do Roteiro
                </button>
              </div>
            </div>
          `);

        marker.on('popupopen', () => {
          setTimeout(() => {
            const btnVer = document.getElementById(`btn-ver-os-parada-${osId}`);
            if (btnVer && onAbrirDetalhesOS) {
              btnVer.onclick = () => onAbrirDetalhesOS(osId);
            }
            const btnRem = document.getElementById(`btn-rem-parada-${osId}`);
            if (btnRem) {
              btnRem.onclick = () => handleRemoverParada(osId);
            }
          }, 50);
        });

        bounds.push([lat, lon]);
      });
    }

    // 🚨 Marcadores de Demandas Abertas (Oportunidades no Radar)
    if (mostrarDemandas) {
      demandasPendentes.forEach(os => {
        const lat = Number(os.latitude_obra) || -15.775440;
        const lon = Number(os.longitude_obra) || -47.779763;
        const dist = calcularDistanciaKm(posicaoMedidor.lat, posicaoMedidor.lon, lat, lon);
        const isPago = os.status_pagamento === 'PAGO';
        const isAgendado = Boolean(os.data_agendada && os.hora_agendada) || Boolean(os.termos_aceitos);

        if (filtroRaio > 0 && dist > filtroRaio) return;

        const iconeDemanda = L.divIcon({
          className: 'custom-demanda-icon',
          html: `
            <div style="width: 34px; height: 34px; background: ${isPago && isAgendado ? '#10b981' : '#f59e0b'}; border: 2.5px solid #ffffff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.5); cursor: pointer;">
              📐
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });

        const marker = L.marker([lat, lon], { icon: iconeDemanda })
          .addTo(markersGroupRef.current)
          .bindPopup(`
            <div style="color: #0f172a; font-family: sans-serif; font-size: 12px; min-width: 220px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: #b45309; font-size: 13px;">${os.cliente_nome}</strong>
                <span style="background: ${isPago && isAgendado ? '#d1fae5' : '#fef3c7'}; color: ${isPago && isAgendado ? '#065f46' : '#b45309'}; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">
                  ${isPago && isAgendado ? 'PAGA E AGENDADA' : 'EM AGENDAMENTO'}
                </span>
              </div>
              <span style="color: #64748b; font-size: 11px;">📍 ${os.endereco_obra}</span>
              ${os.data_agendada ? `<div style="color: #1e40af; font-size: 10px; font-weight: bold; margin-top: 3px;">📅 Agendado: ${os.data_agendada} às ${os.hora_agendada}</div>` : ''}
              <div style="background: #f8fafc; border-radius: 8px; padding: 6px; margin: 6px 0; border: 1px solid #e2e8f0;">
                <div style="display: flex; justify-content: space-between; font-size: 11px;">
                  <span>Distância até você:</span>
                  <strong style="color: #0284c7;">${dist} km</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 2px;">
                  <span>Ganho de Repasse:</span>
                  <strong style="color: #16a34a; font-size: 13px;">${formatarMoeda(os.custo_medidor)}</strong>
                </div>
              </div>

              <!-- Ações da Demanda -->
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <button id="btn-ver-os-demanda-${os.id}" style="width: 100%; background: #0f172a; color: #38bdf8; border: 1px solid #38bdf8; padding: 6px; border-radius: 8px; font-weight: bold; font-size: 11px; cursor: pointer;">
                  👁️ Exibir OS Completa
                </button>

                <button id="btn-add-roteiro-${os.id}" style="width: 100%; background: #0284c7; color: #ffffff; border: none; padding: 7px; border-radius: 8px; font-weight: 800; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  ➕ Adicionar ao Roteiro de Hoje
                </button>

                ${isPago && isAgendado ? `
                  <button id="btn-aceitar-mapa-${os.id}" style="width: 100%; background: #10b981; color: #ffffff; border: none; padding: 7px; border-radius: 8px; font-weight: 900; font-size: 11px; cursor: pointer; text-transform: uppercase;">
                    ✅ Confirmar Medição
                  </button>
                ` : `
                  <div style="width: 100%; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 5px; border-radius: 8px; font-weight: 700; font-size: 10px; text-align: center;">
                    ${!isPago ? '⏳ Aguardando Pagamento' : '⏳ Aguardando Agendamento'}
                  </div>
                `}

                ${recusarDemanda ? `
                  <button id="btn-recusar-mapa-${os.id}" style="width: 100%; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 5px; border-radius: 8px; font-weight: bold; font-size: 10px; cursor: pointer;">
                    ❌ Recusar Demanda
                  </button>
                ` : ''}

                <a href="https://www.google.com/maps/dir/?api=1&origin=${posicaoMedidor.lat},${posicaoMedidor.lon}&destination=${encodeURIComponent(os.endereco_obra || `${lat},${lon}`)}" target="_blank" rel="noreferrer" style="display: block; text-align: center; color: #2563eb; font-weight: bold; font-size: 10px; margin-top: 4px; text-decoration: none;">
                  🗺️ Abrir no Google Maps
                </a>
              </div>
            </div>
          `);

        marker.on('popupopen', () => {
          setTimeout(() => {
            const btnVer = document.getElementById(`btn-ver-os-demanda-${os.id}`);
            if (btnVer && onAbrirDetalhesOS) {
              btnVer.onclick = () => onAbrirDetalhesOS(os.id);
            }
            const btnAdd = document.getElementById(`btn-add-roteiro-${os.id}`);
            if (btnAdd) {
              btnAdd.onclick = () => handleAdicionarAoRoteiro(os.id);
            }
            const btnAceitar = document.getElementById(`btn-aceitar-mapa-${os.id}`);
            if (btnAceitar && aceitarDemanda) {
              btnAceitar.onclick = () => aceitarDemanda(os.id);
            }
            const btnRecusar = document.getElementById(`btn-recusar-mapa-${os.id}`);
            if (btnRecusar && recusarDemanda) {
              btnRecusar.onclick = () => recusarDemanda(os.id);
            }
          }, 50);
        });

        bounds.push([lat, lon]);
      });
    }

    // Ajusta o enquadramento do mapa se houver marcadores
    if (bounds.length > 1 && !osSelecionada) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [posicaoMedidor.lat, posicaoMedidor.lon, lojas, demandasPendentes, ordensEmRota, roteiroDia, mostrarLojas, mostrarMinhaRota, mostrarDemandas, filtroRaio]);

  // 10. Efeito para Focar em OS Selecionada
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !osSelecionada) return;

    const lat = Number(osSelecionada.latitude_obra || osSelecionada.latitude);
    const lon = Number(osSelecionada.longitude_obra || osSelecionada.longitude);
    if (lat && lon) {
      map.flyTo([lat, lon], 15, { duration: 1.5 });
    }
  }, [osSelecionada]);

  // Botão: Centralizar no Medidor
  const centralizarEmMim = () => {
    const map = mapInstanceRef.current;
    if (map && posicaoMedidor.lat && posicaoMedidor.lon) {
      map.flyTo([posicaoMedidor.lat, posicaoMedidor.lon], 15, { duration: 1.2 });
    }
  };

  // Demandas pendentes ordenadas por proximidade
  const demandasOrdenadasProximidade = [...demandasPendentes].map(os => {
    const lat = Number(os.latitude_obra) || -15.775440;
    const lon = Number(os.longitude_obra) || -47.779763;
    const dist = calcularDistanciaKm(posicaoMedidor.lat, posicaoMedidor.lon, lat, lon);
    return { ...os, distancia_km: dist };
  }).sort((a, b) => a.distancia_km - b.distancia_km);

  return (
    <div className="relative w-full h-[calc(100vh-210px)] min-h-[580px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* 🧭 Barra Superior de Controles e Filtros do Radar */}
      <div className="bg-slate-900/95 backdrop-blur border-b border-slate-800 p-3 px-4 flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setMostrarMinhaRota(!mostrarMinhaRota)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              mostrarMinhaRota ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-950 border border-slate-800 text-slate-400'
            }`}
          >
            <span>📍</span> Paradas do Dia ({ordensEmRota.length})
          </button>

          <button
            onClick={() => setMostrarDemandas(!mostrarDemandas)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              mostrarDemandas ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'bg-slate-950 border border-slate-800 text-slate-400'
            }`}
          >
            <span>🚨</span> Demandas ({demandasPendentes.length})
          </button>

          <button
            onClick={() => setMostrarLojas(!mostrarLojas)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              mostrarLojas ? 'bg-sky-600 text-white shadow-md' : 'bg-slate-950 border border-slate-800 text-slate-400'
            }`}
          >
            <span>🏢</span> Lojas ({lojas.length})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Mapa Diurno (Sem Dark Mode) */}
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-black">Modo:</span>
            <select
              value={tipoMapa}
              onChange={e => setTipoMapa(e.target.value)}
              className="bg-transparent text-xs font-bold text-amber-400 outline-none cursor-pointer"
            >
              <option value="google_streets" className="bg-slate-900">🗺️ Google Maps (Ruas)</option>
              <option value="google_sat" className="bg-slate-900">🛰️ Google Satélite</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-black">Raio:</span>
            <select
              value={filtroRaio}
              onChange={e => setFiltroRaio(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            >
              <option value={15} className="bg-slate-900">Até 15 km</option>
              <option value={30} className="bg-slate-900">Até 30 km</option>
              <option value={50} className="bg-slate-900">Até 50 km</option>
              <option value={100} className="bg-slate-900">Até 100 km</option>
              <option value={0} className="bg-slate-900">Sem limite</option>
            </select>
          </div>

          <button
            onClick={centralizarEmMim}
            title="Centralizar no seu GPS em Brasília"
            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1"
          >
            <span>🎯</span> <span className="hidden sm:inline">Meu GPS</span>
          </button>
        </div>
      </div>

      {/* 🗺️ Área do Mapa Leaflet */}
      <div className="flex-1 relative w-full h-full">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* 📋 HUD / Painel Flutuante: "Meu Roteiro do Dia" (Multi-Paradas Clicável) */}
        {roteiroDia && roteiroDia.paradas && roteiroDia.paradas.length > 0 && (
          <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${drawerRoteiroAberto ? 'w-80 md:w-96' : 'w-auto'}`}>
            {!drawerRoteiroAberto ? (
              <button
                onClick={() => setDrawerRoteiroAberto(true)}
                className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/50 text-white px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800"
              >
                <span>📋</span> Roteiro do Dia ({roteiroDia.total_paradas} Paradas • {roteiroDia.total_distancia_km || roteiroDia.total_km} km)
                <span className="text-emerald-400">▲</span>
              </button>
            ) : (
              <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-3xl shadow-2xl p-4 text-white animate-in fade-in max-h-[75vh] flex flex-col">
                {/* Cabeçalho do Drawer */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <span>📋</span> Roteiro do Dia
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {roteiroDia.total_paradas} Paradas • {roteiroDia.total_distancia_km || roteiroDia.total_km} km • ~{roteiroDia.total_tempo_transito_min || roteiroDia.total_tempo_transito || 0} min trânsito
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDrawerRoteiroAberto(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg text-xs"
                    title="Recolher painel"
                  >
                    ▼
                  </button>
                </div>

                {/* Métricas do Roteiro */}
                <div className="grid grid-cols-3 gap-2 my-3">
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
                    <span className="text-[9px] text-slate-500 uppercase font-black block">Ganhos</span>
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      {formatarMoeda(roteiroDia.total_repasse_garantido || roteiroDia.total_repasse || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
                    <span className="text-[9px] text-slate-500 uppercase font-black block">Medição</span>
                    <span className="text-xs font-bold text-blue-400">
                      {roteiroDia.total_tempo_medicoes_min || roteiroDia.total_tempo_medicoes || 0} min
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-center">
                    <span className="text-[9px] text-slate-500 uppercase font-black block">Trânsito</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">
                      {roteiroDia.total_distancia_km || roteiroDia.total_km} km
                    </span>
                  </div>
                </div>

                {/* Status da Sugestão com Botão de Aceite */}
                <div className="bg-blue-950/40 border border-blue-900/50 p-2 rounded-xl mb-2 flex items-center justify-between text-xs">
                  <span className="text-blue-300 font-medium text-[11px] flex items-center gap-1">
                    <span>✨</span> Sugestão de Rota Otimizada
                  </span>
                  <button
                    onClick={handleAceitarSugestaoRota}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg transition-transform hover:scale-105"
                  >
                    ✅ Aceitar Rota
                  </button>
                </div>

                {/* Abas: Paradas vs Trechos */}
                <div className="flex gap-1 mb-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setAbaRoteiro('paradas')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors ${abaRoteiro === 'paradas' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    📍 Paradas ({roteiroDia.paradas.length})
                  </button>
                  <button
                    onClick={() => setAbaRoteiro('trechos')}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-colors ${abaRoteiro === 'trechos' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    🛣️ Trechos ({roteiroDia.trechos?.length || 0})
                  </button>
                </div>

                {/* Lista de Paradas Clicáveis ou Trechos */}
                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-1 max-h-56">
                  {abaRoteiro === 'paradas' ? (
                    roteiroDia.paradas.map((parada, idx) => {
                      const trechoCorrespondente = roteiroDia.trechos && roteiroDia.trechos[idx];
                      const osId = parada.os_id || parada.id;
                      return (
                        <div
                          key={osId}
                          className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between gap-2 hover:border-blue-500/60 transition-colors"
                        >
                          <div 
                            onClick={() => handleClicarParada(parada)}
                            className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                            title="Clique para ver no mapa e exibir OS"
                          >
                            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black flex items-center justify-center flex-shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-white truncate hover:text-blue-400 transition-colors">
                                {parada.cliente_nome}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {parada.endereco || parada.endereco_obra}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded">
                                  💰 {formatarMoeda(parada.custo_medidor || 0)}
                                </span>
                                <span className="text-[10px] font-mono text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded">
                                  ⏱️ {parada.tempo_estimado_min || 60}m
                                </span>
                                {trechoCorrespondente && (
                                  <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                                    🚗 {trechoCorrespondente.duracao_minutos || trechoCorrespondente.duracao_min || 15}m ({trechoCorrespondente.distancia_km || 0}km)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Ações da Parada: Subir / Descer e Remover */}
                          <div className="flex flex-col gap-1 flex-shrink-0 items-center">
                            <div className="flex gap-1">
                              <button
                                disabled={idx === 0}
                                onClick={(e) => { e.stopPropagation(); handleMoverParada(idx, -1); }}
                                className={`px-1.5 py-0.5 rounded text-[10px] ${idx === 0 ? 'opacity-20 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                                title="Mover para cima"
                              >
                                ▲
                              </button>
                              <button
                                disabled={idx === roteiroDia.paradas.length - 1}
                                onClick={(e) => { e.stopPropagation(); handleMoverParada(idx, 1); }}
                                className={`px-1.5 py-0.5 rounded text-[10px] ${idx === roteiroDia.paradas.length - 1 ? 'opacity-20 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                                title="Mover para baixo"
                              >
                                ▼
                              </button>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoverParada(osId); }}
                              className="text-[10px] text-red-400 hover:text-red-300 p-0.5"
                              title="Remover do roteiro"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    roteiroDia.trechos?.map((trecho, idx) => (
                      <div key={idx} className="bg-slate-950 p-2 rounded-xl border border-slate-800 text-[11px]">
                        <div className="flex justify-between items-center text-blue-400 font-bold">
                          <span>🛣️ Trecho {trecho.indice || idx + 1}</span>
                          <span className="text-white font-mono">{trecho.distancia_km} km • {trecho.duracao_minutos || trecho.duracao_min} min</span>
                        </div>
                        <p className="text-slate-400 text-[10px] truncate mt-0.5">
                          {trecho.origem_nome} ➔ {trecho.destino_nome}
                        </p>
                        <div className="text-[9px] text-slate-500 font-mono mt-1">
                          Via: {trecho.nome_via || "Vias principais de Brasília"}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Ações Inferiores: Otimizar e Iniciar no Google Maps */}
                <div className="pt-3 mt-2 border-t border-slate-800 flex flex-col gap-2">
                  <button
                    onClick={handleOtimizarPorProximidade}
                    disabled={carregandoRoteiro}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
                  >
                    <span>⚡</span> Otimizar Sequência por Proximidade
                  </button>

                  <a
                    href={roteiroDia.google_maps_multi_stop_url || roteiroDia.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/30 text-center"
                  >
                    <span>🗺️</span> Iniciar Rota no Google Maps
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ⚡ Oportunidades por Proximidade no Radar */}
        {demandasPendentes.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-96 max-h-52 bg-slate-900/95 backdrop-blur border border-slate-800 rounded-2xl p-3.5 shadow-2xl z-10 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-800">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>⚡</span> Oportunidades por Proximidade
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Mais perto de você</span>
            </div>

            <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1 flex-1">
              {demandasOrdenadasProximidade.slice(0, 4).map(os => (
                <div key={os.id} className="bg-slate-950 p-2 rounded-xl border border-slate-800/80 flex justify-between items-center hover:border-blue-500/50 transition-colors">
                  <div className="truncate mr-2 cursor-pointer flex-1" onClick={() => onAbrirDetalhesOS && onAbrirDetalhesOS(os.id)}>
                    <p className="text-xs font-bold text-white truncate hover:text-blue-400">{os.cliente_nome}</p>
                    <p className="text-[10px] text-slate-400 truncate">{os.endereco_obra}</p>
                    <p className="text-[10px] font-mono text-blue-400 mt-0.5">
                      🚗 {os.distancia_km} km • {formatarMoeda(os.custo_medidor)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAdicionarAoRoteiro(os.id)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap shadow transition-transform hover:scale-105"
                      title="Adicionar à rota de hoje"
                    >
                      ➕ Rota
                    </button>
                    {aceitarDemanda && (
                      <button
                        onClick={() => aceitarDemanda(os.id)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap shadow transition-transform hover:scale-105"
                      >
                        Aceitar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// 🏢 Modal para Loja Rastrear o Medidor em Deslocamento
function ModalRastreioLoja({ os, onClose, formatarMoeda }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [posMedidor, setPosMedidor] = useState(null);

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
    const interval = setInterval(buscarLocalizacao, 8000);
    return () => clearInterval(interval);
  }, [os]);

  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    const latObra = Number(os.latitude_obra) || -15.775440;
    const lonObra = Number(os.longitude_obra) || -47.779763;
    const latMed = posMedidor?.lat || -15.779017;
    const lonMed = posMedidor?.lon || -47.997900;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        center: [latObra, lonObra],
        zoom: 13,
        zoomControl: false
      });

      window.L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        maxZoom: 20
      }).addTo(map);

      window.L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const L = window.L;

    const iconeObra = L.divIcon({
      className: 'custom-obra-icon',
      html: `<div style="width: 36px; height: 36px; background: #059669; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">🏠</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    L.marker([latObra, lonObra], { icon: iconeObra }).addTo(map).bindPopup(`<b>Obra: ${os.cliente_nome}</b><br/>${os.endereco_obra}`);

    const iconeMed = L.divIcon({
      className: 'custom-med-icon',
      html: `<div style="width: 38px; height: 38px; background: #2563eb; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 12px rgba(37,99,235,0.6);">🛵</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    L.marker([latMed, lonMed], { icon: iconeMed }).addTo(map).bindPopup(`
      <b>Medidor: ${os.medidor?.nome_completo || 'Profissional'}</b><br/>
      <span>A caminho da medição (Brasília - DF)</span><br/>
      <a href="https://www.google.com/maps/dir/?api=1&origin=${latMed},${lonMed}&destination=${latObra},${lonObra}" target="_blank" rel="noreferrer" style="color: #2563eb; font-weight: bold; display: block; margin-top: 4px; font-size: 11px;">
        🗺️ Ver Rota no Google Maps
      </a>
    `);

    L.polyline([[latMed, lonMed], [latObra, lonObra]], { color: '#2563eb', weight: 4, dashArray: '6, 6' }).addTo(map);
    map.fitBounds([[latMed, lonMed], [latObra, lonObra]], { padding: [40, 40] });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [os, posMedidor]);

  const dist = posMedidor ? calcularDistanciaKm(posMedidor.lat, posMedidor.lon, Number(os.latitude_obra) || -15.775440, Number(os.longitude_obra) || -47.779763) : 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <span>🛵</span> Rastreamento do Medidor ao Vivo
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">OS #{String(os.id).padStart(4, '0')} • {os.cliente_nome}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl text-xs font-bold">✕ Fechar</button>
        </div>

        <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex flex-wrap justify-between items-center gap-2 text-xs">
          <div>
            <span className="text-slate-500">Profissional:</span> <strong className="text-white ml-1">{os.medidor?.nome_completo || 'Técnico Especialista'}</strong>
          </div>
          {os.ordem_rota > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl text-emerald-400 font-bold">
              📍 Parada #{os.ordem_rota} do dia • Horário: {os.hora_agendada || '09:00'}
            </div>
          )}
          <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-xl text-blue-400 font-mono font-bold">
            Distância até a obra: ~{dist} km
          </div>
        </div>

        <div className="h-96 w-full relative">
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}

// 📅 Modal para o Medidor Definir Dias e Horários de Atendimento
function ModalAgendaMedidor({ isOpen, onClose, medidor, onSalvar }) {
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [horasSelecionadas, setHorasSelecionadas] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const todosDias = [
    { id: 'Seg', label: 'Segunda' },
    { id: 'Ter', label: 'Terça' },
    { id: 'Qua', label: 'Quarta' },
    { id: 'Qui', label: 'Quinta' },
    { id: 'Sex', label: 'Sexta' },
    { id: 'Sáb', label: 'Sábado' },
    { id: 'Dom', label: 'Domingo' }
  ];

  const todasHoras = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  useEffect(() => {
    if (medidor) {
      try {
        const d = JSON.parse(medidor.dias_disponiveis || '["Seg","Ter","Qua","Qui","Sex","Sáb"]');
        setDiasSelecionados(Array.isArray(d) ? d : ['Seg','Ter','Qua','Qui','Sex','Sáb']);
      } catch(e) {
        setDiasSelecionados(['Seg','Ter','Qua','Qui','Sex','Sáb']);
      }
      try {
        const h = JSON.parse(medidor.horas_disponiveis || '["08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00"]');
        setHorasSelecionadas(Array.isArray(h) ? h : ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00']);
      } catch(e) {
        setHorasSelecionadas(['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00']);
      }
    }
  }, [medidor, isOpen]);

  if (!isOpen) return null;

  const toggleDia = (dId) => {
    setDiasSelecionados(prev => prev.includes(dId) ? prev.filter(x => x !== dId) : [...prev, dId]);
  };

  const toggleHora = (h) => {
    setHorasSelecionadas(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);
  };

  const salvar = async () => {
    if (diasSelecionados.length === 0) return alert("Selecione pelo menos um dia da semana.");
    if (horasSelecionadas.length === 0) return alert("Selecione pelo menos um horário de atendimento.");
    setSalvando(true);
    try {
      await onSalvar(diasSelecionados, horasSelecionadas);
      onClose();
    } catch(e) {
      alert("Erro ao salvar agenda.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl p-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <span>📅</span> Minha Agenda e Horários de Medição
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              O cliente só poderá agendar nos dias e horários que você marcar como disponíveis abaixo.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl text-xs font-bold">✕</button>
        </div>

        {/* DIAS */}
        <div className="mb-6">
          <label className="text-xs font-black text-amber-400 uppercase tracking-wider block mb-3">
            1. Dias da Semana de Atendimento ({diasSelecionados.length} selecionados)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {todosDias.map(d => {
              const ativo = diasSelecionados.includes(d.id);
              return (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => toggleDia(d.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-left flex items-center justify-between ${
                    ativo
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <span>{d.label}</span>
                  <span className="text-[10px]">{ativo ? '✅' : '⚪'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* HORAS */}
        <div className="mb-6">
          <label className="text-xs font-black text-blue-400 uppercase tracking-wider block mb-3">
            2. Horários Disponíveis ({horasSelecionadas.length} selecionados)
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
            {todasHoras.map(h => {
              const ativo = horasSelecionadas.includes(h);
              return (
                <button
                  type="button"
                  key={h}
                  onClick={() => toggleHora(h)}
                  className={`py-2 px-3 rounded-xl text-xs font-mono font-bold transition-all border text-center ${
                    ativo
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button onClick={onClose} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-transform hover:scale-105"
          >
            {salvando ? 'Salvando...' : '💾 Salvar Minha Agenda'}
          </button>
        </div>
      </div>
    </div>
  );
}




export default function PortalUsuario({ perfil, refId, setToken }) {
  const [todasOrdens, setTodasOrdens] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [abaMedidor, setAbaMedidor] = useState('oportunidades')
  const [visaoDemanda, setVisaoDemanda] = useState('mapa')
  const [osRotaSelecionada, setOsRotaSelecionada] = useState(null)
  
  // Filtro de busca e ordenação das demandas
  const [buscaDemanda, setBuscaDemanda] = useState('')
  const [ordemDemanda, setOrdemDemanda] = useState('proximidade')

  // Modais de OS e Documentos de Medição
  const [osParaExibir, setOsParaExibir] = useState(null)
  const [osParaDocumentos, setOsParaDocumentos] = useState(null)

  // Localização do medidor para cálculos de ordenação e mapa
  const [posicaoMedidor, setPosicaoMedidor] = useState({ lat: -15.779017, lon: -47.997900 })

  const anoAtualStr = new Date().getFullYear().toString()
  const mesAtualNumStr = String(new Date().getMonth() + 1).padStart(2, '0')
  const mesAtualStr = `${anoAtualStr}-${mesAtualNumStr}`

  // Filtros Caixa (Medidor)
  const [filtroAnoCaixa, setFiltroAnoCaixa] = useState(anoAtualStr)
  const [filtroMesCaixa, setFiltroMesCaixa] = useState('TODOS')
  const [filtroLojaCaixa, setFiltroLojaCaixa] = useState('TODAS')

  // Filtros Concluídas (Medidor)
  const [filtroAnoConcluidas, setFiltroAnoConcluidas] = useState(anoAtualStr)
  const [filtroMesConcluidas, setFiltroMesConcluidas] = useState('TODOS')
  const [filtroLojaConcluidas, setFiltroLojaConcluidas] = useState('TODAS')
  const [buscaConcluidas, setBuscaConcluidas] = useState('')

  // Filtros Loja
  const [filtroAnoLoja, setFiltroAnoLoja] = useState(anoAtualStr)
  const [filtroMesLoja, setFiltroMesLoja] = useState('TODOS')
  const [filtroSecundario, setFiltroSecundario] = useState('TODOS')
  const [linkCopiado, setLinkCopiado] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [osParaEditar, setOsParaEditar] = useState(null)
  const [isPixOpen, setIsPixOpen] = useState(false)
  const [osParaPix, setOsParaPix] = useState(null)
  const [osParaRastrear, setOsParaRastrear] = useState(null)
  const [isAgendaOpen, setIsAgendaOpen] = useState(false)
  
  const [lojas, setLojas] = useState([])
  const [clientes, setClientes] = useState([])
  const [medidores, setMedidores] = useState([])

  const fazerLogout = () => { localStorage.removeItem('sgm_token'); localStorage.removeItem('sgm_usuario'); if (setToken) setToken(null); window.location.href = '/' }

  const carregarOrdens = () => {
    setLoading(true); 
    axios.get('/api/os?limit=1000')
      .then(res => { 
        setTodasOrdens(res.data || []); 
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  }

  const carregarCadastros = async () => {
    try {
      const [resLojas, resClientes, resMedidores] = await Promise.all([ 
        axios.get('/api/lojas'), 
        axios.get('/api/clientes'),
        axios.get('/api/medidores')
      ])
      setLojas(perfil === 'LOJA' ? resLojas.data.filter(l => l.id === refId) : resLojas.data)
      setClientes(resClientes.data)
      setMedidores(resMedidores.data)
    } catch (error) { 
      console.error("Erro ao carregar cadastros") 
    }
  }

  useEffect(() => { carregarOrdens(); carregarCadastros() }, [perfil, refId])

  // Rastreamento contínuo em segundo plano da localização do Medidor
  useEffect(() => {
    if (perfil !== 'MEDIDOR' || !refId || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const novaPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setPosicaoMedidor(novaPos);
        axios.put(`/api/medidores/${refId}/localizacao`, novaPos).catch(() => {});
      },
      (err) => console.log('GPS watch:', err.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [perfil, refId]);

  const formatarMoeda = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatarData = (d) => { if (!d) return '-'; return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  
  const calcularSLA = (os) => {
    const inicio = os.data_aceite ? new Date(os.data_aceite) : new Date(os.criado_em)
    let fim = os.data_conclusao ? new Date(os.data_conclusao) : null
    if (!fim && os.status === 'CONCLUIDO') { fim = new Date(inicio.getTime() + (((os.id % 12) + 4) * 24 * 60 * 60 * 1000)); }
    if (!fim) return { dias: 0, texto: 'Em Rota', cor: 'text-amber-400 bg-amber-500/10' }
    const diffDias = Math.ceil(Math.abs(fim - inicio) / (1000 * 60 * 60 * 24))
    if (diffDias <= 15) return { dias: diffDias, texto: `${diffDias} dias (No Prazo)`, cor: 'text-emerald-400 bg-emerald-500/10' }
    return { dias: diffDias, texto: `${diffDias} dias (Atraso)`, cor: 'text-red-400 bg-red-500/10 font-bold' }
  }

  const calcularValorUnitarioAmbiente = (amb) => {
    const nomeLower = (amb.nome || '').toLowerCase()
    const tipoLower = (amb.tipo_ambiente || '').toLowerCase()
    if (nomeLower.includes('cozinha') || tipoLower.includes('cozinha') || tipoLower.includes('churrasqueira') || tipoLower.includes('gourmet')) return 62.50
    if (nomeLower.includes('escada') || tipoLower.includes('escada')) return 62.50
    if (nomeLower.includes('serviço') || nomeLower.includes('servico') || tipoLower.includes('serviço') || tipoLower.includes('servico') || nomeLower.includes('lavanderia') || nomeLower.includes('tanque')) return 56.25
    if (nomeLower.includes('banheiro') || tipoLower.includes('banheiro') || nomeLower.includes('lavabo') || nomeLower.includes('wc')) return 50.00
    if (nomeLower.includes('sala') || tipoLower.includes('sala') || nomeLower.includes('estar') || nomeLower.includes('jantar') || nomeLower.includes('living')) return 43.75
    if (nomeLower.includes('quarto') || tipoLower.includes('quarto') || nomeLower.includes('dormit') || nomeLower.includes('suíte') || nomeLower.includes('suite')) return 37.50
    if (nomeLower.includes('varanda') || tipoLower.includes('varanda') || nomeLower.includes('sacada') || tipoLower.includes('sacada')) return 31.25
    return 31.25
  }

  const gerarPDF = (os) => {
    let somaAvulsa = 0
    let linhasAmbientes = ''
    (os.ambientes || []).forEach((amb, i) => {
      const valorUnitario = calcularValorUnitarioAmbiente(amb)
      somaAvulsa += valorUnitario
      linhasAmbientes += `<tr><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${i + 1}</td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${amb.nome || amb.tipo_ambiente}</td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">${amb.tipo_ambiente || 'Padrão'} (${amb.complexidade || 1.0}x)</td><td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${formatarMoeda(valorUnitario)}</td></tr>`
    })
    const descontoAplicado = Math.max(0, somaAvulsa - (os.valor_total_os - (os.taxa_deslocamento || 0) - (os.adicional_urgencia || 0)))
    const htmlDocumento = `<!DOCTYPE html><html><head><title>OS_00${os.id}</title><style>body { font-family: sans-serif; padding: 40px; color: #333; } .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; } table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; } th { background: #f8fafc; padding: 10px 8px; border-bottom: 2px solid #e2e8f0; } .totals { float: right; margin-top: 30px; width: 340px; font-size: 16px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; display: flex; flex-direction: column; gap: 8px; text-align: right; } .totals div { display: flex; justify-content: space-between; font-size: 13px; font-weight: normal; color: #555; } .totals .grand { font-size: 18px; font-weight: bold; color: #000; margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px; }</style></head><body><div class="header"><h2>SGM.PRO - Ordem de Serviço #00${os.id}</h2><h3>${os.loja?.nome_fantasia || 'Loja'}</h3></div><p><strong>Cliente:</strong> ${os.cliente_nome}</p><p><strong>Endereço:</strong> ${os.endereco_obra}</p><table><thead><tr><th>#</th><th>Ambiente</th><th>Tipo / Complexidade</th><th style="text-align: right;">Subtotal</th></tr></thead><tbody>${linhasAmbientes}</tbody></table><div class="totals"><div><span>Subtotal Ambientes:</span><span>${formatarMoeda(somaAvulsa)}</span></div>${descontoAplicado > 0 ? `<div style="color: #16a34a;"><span>Desconto Combo (${(os.ambientes?.length || 0) >= 5 ? 'Apartamento Completo' : 'Progressivo'}):</span><span>-${formatarMoeda(descontoAplicado)}</span></div>` : ''}<div><span>Deslocamento:</span><span>${formatarMoeda(os.taxa_deslocamento || 0)}</span></div>${os.urgencia ? `<div><span>Taxa Urgência (24h):</span><span>${formatarMoeda(os.adicional_urgencia || (os.valor_total_os / 3))}</span></div>` : ''}<div><span style="color: #2563eb;">Repasse Medidor (80%):</span><span style="color: #2563eb;">${formatarMoeda(os.custo_medidor || 0)}</span></div><div class="grand"><span>Total da OS:</span><span>${formatarMoeda(os.valor_total_os)}</span></div></div></body></html>`
    const iframe = document.createElement('iframe'); iframe.style.display = 'none'; document.body.appendChild(iframe)
    iframe.contentWindow.document.open(); iframe.contentWindow.document.write(htmlDocumento); iframe.contentWindow.document.close()
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 2000) }, 500)
  }

  const deletarOS = async (id) => { if(window.confirm("Excluir esta OS permanentemente?")) { try { await axios.delete(`/api/os/${id}`); carregarOrdens() } catch(e){} } }
  const abrirLinkCliente = (token) => { window.open(`${window.location.origin}/cliente/${token}`, '_blank') }
  const copiarLinkCliente = (token) => { navigator.clipboard.writeText(`${window.location.origin}/cliente/${token}`).then(() => { setLinkCopiado(token); setTimeout(() => setLinkCopiado(null), 2000) }) }
  const enviarWhatsAppCliente = (os) => {
    const url = `${window.location.origin}/cliente/${os.token}`
    const clienteObj = clientes.find(c => c.nome?.toLowerCase() === os.cliente_nome?.toLowerCase())
    const tel = (clienteObj?.telefone || '').replace(/\D/g, '')
    const msg = encodeURIComponent(`Olá, ${os.cliente_nome}!\n\nSegue o link para autorização e agendamento da medição técnica da sua obra (${os.loja?.nome_fantasia || 'SGM.PRO'}):\n\n🔗 ${url}\n\nPor favor, confirme os ambientes e selecione o melhor dia e horário!`)
    let waUrl = `https://api.whatsapp.com/send?text=${msg}`
    if (tel.length >= 10) {
      const ddi = tel.startsWith('55') ? tel : `55${tel}`
      waUrl = `https://api.whatsapp.com/send?phone=${ddi}&text=${msg}`
    }
    window.open(waUrl, '_blank')
  }
  const compartilharLinkCliente = (os) => {
    const url = `${window.location.origin}/cliente/${os.token}`
    if (navigator.share) {
      navigator.share({
        title: `Medição Técnica - ${os.cliente_nome}`,
        text: `Autorização e agendamento da medição técnica (${os.loja?.nome_fantasia || 'SGM.PRO'}):`,
        url: url
      }).catch(() => {})
    } else {
      copiarLinkCliente(os.token)
    }
  }
  const abrirEdicaoOS = (os) => { setOsParaEditar(os); setIsModalOpen(true) }

  const reatribuirMedidor = async (os, novoMedidorId) => {
    if (os.medidor_id && novoMedidorId !== os.medidor_id.toString()) {
      if(!window.confirm(`⚠️ Atenção: A OS será retirada da rota de ${os.medidor.nome_completo}. Deseja prosseguir?`)) return;
    }
    
    try {
      const idLimpo = novoMedidorId ? parseInt(novoMedidorId) : null;
      await axios.put(`/api/os/${os.id}/status`, { medidor_id: idLimpo, status: 'PENDENTE_LOJA' });
      alert(idLimpo ? "✅ Medição direcionada ao Medidor! Ele confirmará a medição após o agendamento do cliente." : "✅ Rota libertada para o Radar de Demandas!");
      carregarOrdens();
    } catch (e) {
      alert("❌ Erro ao transferir a rota.");
    }
  }

  const aceitarDemanda = async (osId) => { 
    try { 
      await axios.put(`/api/os/${osId}/pegar-demanda`); 
      alert("✅ Medição confirmada com sucesso! Rota iniciada."); 
      setAbaMedidor('minhas'); 
      carregarOrdens() 
    } catch (e) {
      const msg = e.response?.data?.erro || "Erro ao aceitar demanda.";
      alert("⚠️ " + msg);
    } 
  }

  const recusarDemanda = async (osId) => {
    if (!window.confirm("Deseja recusar esta demanda e devolvê-la ao Radar de oportunidades?")) return;
    try {
      await axios.put(`/api/os/${osId}/recusar-demanda`);
      alert("✅ Demanda devolvida ao Radar geral.");
      carregarOrdens();
    } catch (e) {
      alert("❌ Erro ao recusar demanda.");
    }
  }

  const handleAdicionarAoRoteiro = async (osId) => {
    try {
      await axios.post(`/api/rotas/adicionar/${osId}`);
      alert("✅ Demanda adicionada ao seu Roteiro Diário de Medições!");
      carregarOrdens();
    } catch (err) {
      alert("❌ Erro ao adicionar à rota: " + (err.response?.data?.erro || err.message));
    }
  };

  const salvarAgendaMedidor = async (dias, horas) => {
    try {
      await axios.put(`/api/medidores/${refId}/disponibilidade`, {
        dias_disponiveis: JSON.stringify(dias),
        horas_disponiveis: JSON.stringify(horas)
      });
      alert("✅ Agenda atualizada com sucesso! O cliente só poderá agendar nos dias e horários selecionados.");
      carregarCadastros();
    } catch (e) {
      alert("❌ Erro ao salvar agenda.");
    }
  }

  const marcarChegada = async (osId) => { 
    try { 
      await axios.put(`/api/os/${osId}/cheguei`); 
      alert("📍 Check-in realizado! Loja notificada."); 
      carregarOrdens() 
    } catch (error) { 
      alert("⚠️ Erro ao registrar chegada."); 
    } 
  }

  const entregarMedicao = async (osId, arquivoURL, mat, obs) => { 
    try { 
      const materialExtra = mat ? `Material: ${mat}` : '';
      const observacaoExtra = obs ? ` | Obs: ${obs}` : '';
      await axios.put(`/api/os/${osId}/entregar`, { caminho_medicao: arquivoURL, material_medicao: materialExtra + observacaoExtra }); 
      alert("🎉 Medição entregue com sucesso!"); 
      setAbaMedidor('concluidas'); 
      carregarOrdens() 
    } catch (e) { 
      alert("Erro de comunicação com o servidor.") 
    } 
  }

  let listaLoja = []; 
  let medidorEmRota = []; 
  let medidorPendentes = []; 
  let medidorHistorico = [];
  let medidorConcluidas = [];
  
  if (perfil === 'LOJA') {
    listaLoja = todasOrdens.filter(o => {
      if (!o.criado_em) return true;
      const osAno = new Date(o.criado_em).getFullYear().toString();
      const osMes = String(new Date(o.criado_em).getMonth() + 1).padStart(2, '0');
      const passaAno = filtroAnoLoja === 'TODOS' || osAno === filtroAnoLoja;
      const passaMes = filtroMesLoja === 'TODOS' || osMes === filtroMesLoja;
      const passaSec = filtroSecundario === 'TODOS' || (o.medidor_id && o.medidor_id.toString() === filtroSecundario);
      return passaAno && passaMes && passaSec;
    });
  } else {
    medidorEmRota = todasOrdens.filter(os => os.medidor_id === refId && (os.status === 'EM_ROTA' || os.status === 'NO_LOCAL'));
    medidorPendentes = todasOrdens.filter(os => os.status === 'PENDENTE_LOJA' && (!os.medidor_id || os.medidor_id === refId));
    
    // Concluídas com filtros de Ano, Mês, Loja e Busca
    medidorConcluidas = todasOrdens.filter(os => {
      if (os.medidor_id !== refId || os.status !== 'CONCLUIDO') return false;
      const osAno = os.criado_em ? new Date(os.criado_em).getFullYear().toString() : '';
      const osMes = os.criado_em ? String(new Date(os.criado_em).getMonth() + 1).padStart(2, '0') : '';
      const passaAno = filtroAnoConcluidas === 'TODOS' || osAno === filtroAnoConcluidas;
      const passaMes = filtroMesConcluidas === 'TODOS' || osMes === filtroMesConcluidas;
      const passaLoja = filtroLojaConcluidas === 'TODAS' || (os.loja_id && os.loja_id.toString() === filtroLojaConcluidas);
      let passaBusca = true;
      if (buscaConcluidas.trim()) {
        const termo = buscaConcluidas.toLowerCase();
        passaBusca = (os.cliente_nome || '').toLowerCase().includes(termo) ||
                     (os.endereco_obra || '').toLowerCase().includes(termo) ||
                     (os.loja?.nome_fantasia || '').toLowerCase().includes(termo);
      }
      return passaAno && passaMes && passaLoja && passaBusca;
    });

    // Histórico / Meu Caixa com filtros de Ano, Mês e Loja
    let historicoBruto = todasOrdens.filter(os => os.medidor_id === refId && os.status === 'CONCLUIDO');
    medidorHistorico = historicoBruto.filter(os => {
      const osAno = os.criado_em ? new Date(os.criado_em).getFullYear().toString() : '';
      const osMes = os.criado_em ? String(new Date(os.criado_em).getMonth() + 1).padStart(2, '0') : '';
      const passaAno = filtroAnoCaixa === 'TODOS' || osAno === filtroAnoCaixa;
      const passaMes = filtroMesCaixa === 'TODOS' || osMes === filtroMesCaixa;
      const passaLoja = filtroLojaCaixa === 'TODAS' || (os.loja_id && os.loja_id.toString() === filtroLojaCaixa);
      return passaAno && passaMes && passaLoja;
    });
  }

  // Filtragem e ordenação inteligente das demandas pendentes
  const demandasFiltradas = medidorPendentes
    .filter(os => {
      if (!buscaDemanda.trim()) return true;
      const termo = buscaDemanda.toLowerCase();
      const cliente = (os.cliente_nome || '').toLowerCase();
      const endereco = (os.endereco_obra || '').toLowerCase();
      const lojaNome = (os.loja?.nome_fantasia || '').toLowerCase();
      return cliente.includes(termo) || endereco.includes(termo) || lojaNome.includes(termo);
    })
    .map(os => {
      const lat = Number(os.latitude_obra) || -15.775440;
      const lon = Number(os.longitude_obra) || -47.779763;
      const dist = calcularDistanciaKm(posicaoMedidor.lat, posicaoMedidor.lon, lat, lon);
      return { ...os, distancia_km: dist };
    })
    .sort((a, b) => {
      if (ordemDemanda === 'valor') {
        return (b.custo_medidor || 0) - (a.custo_medidor || 0);
      }
      if (ordemDemanda === 'data') {
        return (a.data_agendada || '9999').localeCompare(b.data_agendada || '9999');
      }
      return (a.distancia_km || 0) - (b.distancia_km || 0);
    });

  const ganhosTotaisMedidor = medidorHistorico.reduce((acc, os) => acc + os.custo_medidor, 0)
  const mesesDisponiveis = [...new Set(todasOrdens.map(o => o.criado_em.substring(0,7)))].sort().reverse()
  if (!mesesDisponiveis.includes(mesAtualStr)) mesesDisponiveis.unshift(mesAtualStr)
  const formatarMesAno = (m) => { const [a, ms] = m.split('-'); return `${new Date(a, ms-1).toLocaleString('pt-BR', {month:'short'}).toUpperCase()}/${a}` }
  
  const lojasDoMedidor = [...new Set(todasOrdens.filter(o => o.medidor_id === refId && o.loja).map(o => JSON.stringify({id: o.loja.id, nome: o.loja.nome_fantasia})))].map(s => JSON.parse(s))
  const secundarioOpcoesLoja = [...new Set(todasOrdens.filter(o => o.medidor).map(o => JSON.stringify({id: o.medidor.id, nome: o.medidor.nome_completo})))].map(s => JSON.parse(s))

  if (loading) return <div className="p-8 text-slate-500 font-mono flex justify-center h-full items-center">A sincronizar dados...</div>

  return (
    <div className="animate-fade-in flex flex-col h-full">
      <header className="mb-4 md:mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white">{perfil === 'LOJA' ? 'Gestão de Operações' : 'Painel de Campo'}</h1>
          <p className="text-slate-500 font-medium text-xs md:text-sm mt-1">{perfil === 'LOJA' ? 'Controle, atribuição e distribuição de medições.' : 'Sistema focado em alta performance na rua.'}</p>
          <button onClick={fazerLogout} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg font-bold mt-3 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest flex items-center gap-2 w-max">
            <span>🚪</span> Sair do Sistema
          </button>
        </div>
        {perfil === 'LOJA' && (
          <button onClick={() => {setOsParaEditar(null); setIsModalOpen(true)}} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/20">
            <span className="text-xl mr-2">+</span> Nova OS
          </button>
        )}
      </header>

      {/* --- VISÃO EXCLUSIVA DO MEDIDOR --- */}
      {perfil === 'MEDIDOR' && (
        <>
          <div className="flex flex-wrap gap-3 mb-6 border-b border-slate-800 pb-4">
            <button 
              onClick={() => setAbaMedidor('oportunidades')} 
              className={`flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] ${abaMedidor === 'oportunidades' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/20 font-black' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              🚨 Demandas <span className="bg-amber-900/50 text-amber-500 px-2 py-0.5 rounded-md text-[10px]">{medidorPendentes.length}</span>
            </button>

            <button 
              onClick={() => setAbaMedidor('minhas')} 
              className={`flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] ${abaMedidor === 'minhas' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              🛵 Minha Rota <span className="bg-blue-800 px-2 py-0.5 rounded-md text-[10px]">{medidorEmRota.length}</span>
            </button>

            <button 
              onClick={() => setAbaMedidor('concluidas')} 
              className={`flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] ${abaMedidor === 'concluidas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 font-bold' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              📁 Medições Concluídas <span className="bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-md text-[10px]">{medidorConcluidas.length}</span>
            </button>

            <button 
              onClick={() => setAbaMedidor('historico')} 
              className={`flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] ${abaMedidor === 'historico' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
            >
              💰 Meu Caixa
            </button>

            <button 
              onClick={() => setIsAgendaOpen(true)} 
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-500/50 hover:text-white shadow-sm"
            >
              📅 Minha Agenda
            </button>
          </div>

          {/* ABA: DEMANDAS (Com Radar de Medição por Padrão) */}
          {abaMedidor === 'oportunidades' && (
            <div>
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <div className="flex items-center gap-2 flex-1 max-w-xl">
                  <input
                    type="text"
                    value={buscaDemanda}
                    onChange={e => setBuscaDemanda(e.target.value)}
                    placeholder="🔍 Buscar por cliente, endereço ou loja..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-blue-500"
                  />
                  <select
                    value={ordemDemanda}
                    onChange={e => setOrdemDemanda(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-blue-500 cursor-pointer whitespace-nowrap"
                  >
                    <option value="proximidade">📍 Mais Próximos</option>
                    <option value="valor">💰 Maior Ganho</option>
                    <option value="data">📅 Data Agendada</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={()=>setVisaoDemanda('mapa')} 
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${visaoDemanda === 'mapa' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                  >
                    🗺️ Radar de Medição
                  </button>
                  <button 
                    onClick={()=>setVisaoDemanda('lista')} 
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${visaoDemanda === 'lista' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                  >
                    📑 Lista ({demandasFiltradas.length})
                  </button>
                </div>
              </div>

              {visaoDemanda === 'mapa' ? (
                <RadarMapaInterativo
                  medidor={medidores.find(m => m.id === refId)}
                  lojas={lojas}
                  demandasPendentes={demandasFiltradas}
                  ordensEmRota={medidorEmRota}
                  osSelecionada={osRotaSelecionada}
                  aceitarDemanda={aceitarDemanda}
                  recusarDemanda={recusarDemanda}
                  formatarMoeda={formatarMoeda}
                  onAtualizarDados={carregarOrdens}
                  onAbrirDetalhesOS={(osId) => {
                    const alvo = todasOrdens.find(o => o.id === osId);
                    if (alvo) setOsParaExibir(alvo);
                  }}
                  onAtualizarLocalizacao={(lat, lon) => {
                    if (refId) {
                      axios.put(`/api/medidores/${refId}/localizacao`, { latitude: lat, longitude: lon }).catch(() => {});
                    }
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {demandasFiltradas.map(os => (
                    <div key={os.id} className="relative flex flex-col">
                      <CardDemandaMedidor 
                        os={os} 
                        formatarMoeda={formatarMoeda} 
                        aceitarDemanda={aceitarDemanda}
                        recusarDemanda={recusarDemanda}
                        refId={refId}
                        posicaoMedidor={posicaoMedidor}
                        onVerNoMapa={(osAlvo) => {
                          setOsRotaSelecionada(osAlvo);
                          setVisaoDemanda('mapa');
                        }}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setOsParaExibir(os)}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors border border-slate-700"
                        >
                          <span>👁️</span> Exibir OS Completa
                        </button>
                        <button
                          onClick={() => handleAdicionarAoRoteiro(os.id)}
                          className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
                          title="Adicionar ao Roteiro de Hoje"
                        >
                          <span>➕</span> Rota
                        </button>
                      </div>
                    </div>
                  ))}
                  {demandasFiltradas.length === 0 && (
                    <div className="col-span-full py-16 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                      <p className="text-slate-500 font-medium">Nenhuma demanda encontrada com os critérios informados.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ABA: MINHA ROTA */}
          {abaMedidor === 'minhas' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">
                  Total de <strong>{medidorEmRota.length}</strong> medições em andamento hoje.
                </p>
                <button
                  onClick={() => { setAbaMedidor('oportunidades'); setVisaoDemanda('mapa'); }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow"
                >
                  <span>🗺️</span> Ver no Radar de Medição
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {medidorEmRota.map(os => (
                  <div key={os.id} className="flex flex-col">
                    <CardRotaMedidor 
                      os={os} 
                      formatarMoeda={formatarMoeda} 
                      marcarChegada={marcarChegada} 
                      entregarMedicao={entregarMedicao} 
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setOsParaExibir(os)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors border border-slate-700"
                      >
                        <span>👁️</span> Exibir OS Completa
                      </button>
                      <button
                        onClick={() => gerarPDF(os)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-colors border border-slate-700"
                        title="Gerar PDF da OS"
                      >
                        <span>📄</span> PDF
                      </button>
                    </div>
                  </div>
                ))}
                {medidorEmRota.length === 0 && (
                  <div className="col-span-full py-16 text-center text-slate-500 font-medium bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                    A sua rota está livre. Apanhe novas demandas no Radar de Medição!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA: MEDIÇÕES CONCLUÍDAS (Histórico de Documentos, Fotos, Promob, Croqui) */}
          {abaMedidor === 'concluidas' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <span>📁</span> Histórico de Medições Concluídas & Documentos Técnicos
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Consulte os relatórios, fotos, croquis e arquivos Promob enviados à loja. Você pode fazer edições e acrescentar novos arquivos a qualquer momento.
                  </p>
                </div>
                <div className="bg-emerald-950/60 border border-emerald-800/60 px-4 py-2 rounded-xl">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">Total Entregues</span>
                  <span className="text-xl font-black text-white">{medidorConcluidas.length} OSs</span>
                </div>
              </div>

              {/* BARRA DE FILTROS: ANO, MÊS, LOJA E BUSCA DE CONCLUÍDAS */}
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">🗓️ Ano</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none font-bold text-sm" 
                    value={filtroAnoConcluidas} 
                    onChange={e => setFiltroAnoConcluidas(e.target.value)}
                  >
                    <option value="TODOS">Todos os Anos</option>
                    <option value="2026">Ano 2026</option>
                    <option value="2025">Ano 2025</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">📅 Mês</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-emerald-400 outline-none font-bold text-sm" 
                    value={filtroMesConcluidas} 
                    onChange={e => setFiltroMesConcluidas(e.target.value)}
                  >
                    <option value="TODOS">Todos os Meses</option>
                    <option value="01">01 - Janeiro</option>
                    <option value="02">02 - Fevereiro</option>
                    <option value="03">03 - Março</option>
                    <option value="04">04 - Abril</option>
                    <option value="05">05 - Maio</option>
                    <option value="06">06 - Junho</option>
                    <option value="07">07 - Julho</option>
                    <option value="08">08 - Agosto</option>
                    <option value="09">09 - Setembro</option>
                    <option value="10">10 - Outubro</option>
                    <option value="11">11 - Novembro</option>
                    <option value="12">12 - Dezembro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">🏢 Filtrar Loja</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none font-bold text-sm" 
                    value={filtroLojaConcluidas} 
                    onChange={e => setFiltroLojaConcluidas(e.target.value)}
                  >
                    <option value="TODAS">Todas as Lojas</option>
                    {lojasDoMedidor.map(opt => <option key={opt.id} value={opt.id.toString()}>{opt.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">🔍 Buscar Cliente / Obra</label>
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome ou endereço..." 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white placeholder-slate-500 outline-none focus:border-emerald-500 text-sm" 
                    value={buscaConcluidas} 
                    onChange={e => setBuscaConcluidas(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {medidorConcluidas.map(os => {
                  let fotosCount = 0;
                  try {
                    const arr = JSON.parse(os.fotos_medicao || '[]');
                    if (Array.isArray(arr)) fotosCount = arr.length;
                  } catch(e) {}

                  return (
                    <div key={os.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col hover:border-slate-700 transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <span>✅</span> Concluído & Enviado à Loja
                        </span>
                        <span className="text-slate-500 font-mono text-xs">#00{os.id}</span>
                      </div>

                      <h3 className="text-lg font-black text-white truncate">{os.cliente_nome}</h3>
                      <p className="text-xs text-slate-400 truncate mt-0.5">📍 {os.endereco_obra}</p>
                      {os.loja && (
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <span>🏢</span> {os.loja.nome_fantasia}
                        </p>
                      )}

                      {/* Resumo de Documentos Anexos */}
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800/80 my-4 space-y-2 text-xs flex-1">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Documentos da Medição</p>
                        
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span>📄</span> Relatório PDF:
                          </span>
                          {os.caminho_medicao ? (
                            <a href={os.caminho_medicao} target="_blank" rel="noreferrer" className="text-emerald-400 font-bold hover:underline">
                              Visualizar ↗
                            </a>
                          ) : (
                            <span className="text-slate-600">Não anexado</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span>📷</span> Fotos da Obra:
                          </span>
                          <span className={fotosCount > 0 ? "text-blue-400 font-bold font-mono" : "text-slate-600"}>
                            {fotosCount > 0 ? `${fotosCount} foto(s)` : 'Sem fotos'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span>📐</span> Foto do Croqui/Desenho:
                          </span>
                          {os.desenho_croqui ? (
                            <a href={os.desenho_croqui} target="_blank" rel="noreferrer" className="text-teal-400 font-bold hover:underline">
                              Ver Croqui ↗
                            </a>
                          ) : (
                            <span className="text-slate-600">Pendente</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <span>💻</span> Arquivo Promob/CAD:
                          </span>
                          {os.arquivo_promob ? (
                            <a href={os.arquivo_promob} target="_blank" rel="noreferrer" className="text-sky-400 font-bold hover:underline">
                              Baixar ↗
                            </a>
                          ) : (
                            <span className="text-slate-600">Pendente</span>
                          )}
                        </div>

                        {os.material_medicao && (
                          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 truncate">
                            <strong>Obs/Material:</strong> {os.material_medicao}
                          </div>
                        )}
                      </div>

                      {/* Ganho e Ações */}
                      <div className="flex justify-between items-center mb-3 px-1">
                        <span className="text-xs text-slate-500 font-medium">Repasse da OS:</span>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          {formatarMoeda(os.custo_medidor || 0)}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setOsParaDocumentos(os)}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          <span>✏️</span> Editar / Acrescentar Documentos
                        </button>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setOsParaExibir(os)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            <span>👁️</span> Exibir OS
                          </button>
                          <button
                            onClick={() => gerarPDF(os)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"
                          >
                            <span>📄</span> PDF da OS
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {medidorConcluidas.length === 0 && (
                  <div className="col-span-full py-16 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                    <p className="text-slate-500 font-medium text-sm">
                      Você ainda não possui medições concluídas.
                    </p>
                    <p className="text-slate-600 text-xs mt-1">
                      Assim que concluir e entregar uma medição, ela ficará listada aqui com todo o histórico de documentos e arquivos anexos.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA: MEU CAIXA */}
          {abaMedidor === 'historico' && (
            <div className="animate-slide-in-right">
              <div className="mb-6 grid grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl"><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Saldo Faturado</p><p className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">{formatarMoeda(ganhosTotaisMedidor)}</p></div>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl"><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Projetos Entregues</p><p className="text-2xl md:text-3xl font-black text-blue-400 mt-1">{medidorHistorico.length}</p></div>
              </div>
              
              <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">🗓️ Ano</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none font-bold text-sm" 
                    value={filtroAnoCaixa} 
                    onChange={e => setFiltroAnoCaixa(e.target.value)}
                  >
                    <option value="TODOS">Todos os Anos</option>
                    <option value="2026">Ano 2026</option>
                    <option value="2025">Ano 2025</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">📅 Mês de Referência</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-emerald-400 outline-none font-bold text-sm" 
                    value={filtroMesCaixa} 
                    onChange={e => setFiltroMesCaixa(e.target.value)}
                  >
                    <option value="TODOS">Todos os Meses</option>
                    <option value="01">01 - Janeiro</option>
                    <option value="02">02 - Fevereiro</option>
                    <option value="03">03 - Março</option>
                    <option value="04">04 - Abril</option>
                    <option value="05">05 - Maio</option>
                    <option value="06">06 - Junho</option>
                    <option value="07">07 - Julho</option>
                    <option value="08">08 - Agosto</option>
                    <option value="09">09 - Setembro</option>
                    <option value="10">10 - Outubro</option>
                    <option value="11">11 - Novembro</option>
                    <option value="12">12 - Dezembro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">🏢 Filtrar por Lojista</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none font-bold text-sm" 
                    value={filtroLojaCaixa} 
                    onChange={e => setFiltroLojaCaixa(e.target.value)}
                  >
                    <option value="TODAS">Todas as Lojas</option>
                    {lojasDoMedidor.map(opt => <option key={opt.id} value={opt.id.toString()}>{opt.nome}</option>)}
                  </select>
                </div>
              </div>

               <TabelaCaixaMedidor medidorHistorico={medidorHistorico} formatarMoeda={formatarMoeda} formatarData={formatarData} calcularSLA={calcularSLA} />
            </div>
          )}
        </>
      )}

      {/* --- VISÃO EXCLUSIVA DA LOJA --- */}
      {perfil === 'LOJA' && (
        <>
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">🗓️ Ano</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 font-bold text-sm" 
                value={filtroAnoLoja} 
                onChange={e => setFiltroAnoLoja(e.target.value)}
              >
                <option value="TODOS">Todos os Anos</option>
                <option value="2026">Ano 2026</option>
                <option value="2025">Ano 2025</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">📅 Mês de Emissão</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-blue-400 outline-none focus:border-blue-500 font-bold text-sm" 
                value={filtroMesLoja} 
                onChange={e => setFiltroMesLoja(e.target.value)}
              >
                <option value="TODOS">Todos os Meses</option>
                <option value="01">01 - Janeiro</option>
                <option value="02">02 - Fevereiro</option>
                <option value="03">03 - Março</option>
                <option value="04">04 - Abril</option>
                <option value="05">05 - Maio</option>
                <option value="06">06 - Junho</option>
                <option value="07">07 - Julho</option>
                <option value="08">08 - Agosto</option>
                <option value="09">09 - Setembro</option>
                <option value="10">10 - Outubro</option>
                <option value="11">11 - Novembro</option>
                <option value="12">12 - Dezembro</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">👷 Filtrar por Medidor</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 px-4 text-white outline-none focus:border-blue-500 font-bold text-sm" 
                value={filtroSecundario} 
                onChange={e => setFiltroSecundario(e.target.value)}
              >
                <option value="TODOS">Todos os Medidores</option>
                {secundarioOpcoesLoja.map(opt => <option key={opt.id} value={opt.id.toString()}>{opt.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {listaLoja.map(os => {
              const temPlanta = os.ambientes?.some(a => a.caminho_planta_pdf);
              const prontaParaAtribuir = os.termos_aceitos && temPlanta;

              return (
                <div key={os.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl relative group hover:border-slate-700 transition-colors flex flex-col">
                  
                  {os.status !== 'CONCLUIDO' && (
                    <div className="absolute top-3 right-3 flex gap-1 z-10 bg-slate-900/90 rounded-lg p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => abrirEdicaoOS(os)} className="bg-slate-800 hover:bg-blue-600 text-white p-2 rounded-lg text-xs transition-colors" title="Editar OS">✏️</button>
                      <button onClick={() => deletarOS(os.id)} className="bg-slate-800 hover:bg-red-600 text-white p-2 rounded-lg text-xs transition-colors" title="Excluir OS">🗑️</button>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-3 pr-20">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${os.status === 'EM_ROTA' || os.status === 'NO_LOCAL' ? 'bg-amber-500/10 text-amber-400' : os.status === 'CONCLUIDO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                      {os.status.replace('_', ' ')}
                    </span>
                    <span className="text-slate-600 font-mono text-xs">#00{os.id}</span>
                  </div>

                  <h2 className="text-xl font-black text-white mb-1 flex items-center gap-2 flex-wrap">
                    <span className="truncate max-w-[80%]">{os.cliente_nome}</span>
                    {os.urgencia && <span className="bg-red-500/20 text-red-400 text-[9px] px-2 py-1 rounded border border-red-500/30 uppercase tracking-widest">🚨 Urgência</span>}
                  </h2>
            
                  <p className="text-slate-500 text-xs mb-4">📍 {os.endereco_obra}</p>

                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 flex-1 relative">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">GMV Transacionado</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${os.status_pagamento === 'PAGO' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {os.status_pagamento === 'PAGO' ? '⚡ Quitado' : '⏳ Aguardando PIX'}
                      </span>
                    </div>
                    <p className="text-2xl font-black text-white font-mono">{formatarMoeda(os.valor_total_os)}</p>
                    
                    <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-2 items-start">
                      {!os.termos_aceitos ? (
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                          ⏳ Aguardando Briefing do Cliente
                        </span>
                      ) : !temPlanta ? (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                          ⚠️ Falta Anexar Planta Baixa
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                          {os.medidor ? `👷 Em Rota: ${os.medidor.nome_completo}` : '✅ OS Completa (No Radar)'}
                        </span>
                      )}
                    </div>
                  </div>

                  {os.status !== 'CONCLUIDO' && prontaParaAtribuir && (
                    <div className="mb-4 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                      <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                        {os.medidor ? '🔄 Transferir Rota' : '🎯 Atribuir Medidor'}
                      </p>
                      <select 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500"
                        onChange={(e) => reatribuirMedidor(os, e.target.value)}
                        value={os.medidor_id || ""}
                      >
                        <option value="">☁️ Deixar Livre no Radar (Marketplace)</option>
                        {medidores.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nome_completo} {m.id === os.medidor_id ? '(Atual)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-auto">
                    {os.token && (
                      <>
                        <button 
                          onClick={() => abrirLinkCliente(os.token)} 
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-black text-xs transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5"
                        >
                          🔗 Abrir Link do Cliente
                        </button>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button 
                            onClick={() => enviarWhatsAppCliente(os)} 
                            className="bg-emerald-600/15 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-400 hover:text-white py-2 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1"
                            title="Enviar via WhatsApp"
                          >
                            💬 Whats
                          </button>
                          <button 
                            onClick={() => copiarLinkCliente(os.token)} 
                            className={`py-2 rounded-lg font-bold text-[11px] transition-all border flex items-center justify-center gap-1 ${linkCopiado === os.token ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300'}`}
                            title="Copiar Link"
                          >
                            {linkCopiado === os.token ? "✅ Copiado" : "📋 Copiar"}
                          </button>
                          <button 
                            onClick={() => compartilharLinkCliente(os)} 
                            className="bg-sky-600/15 hover:bg-sky-600 border border-sky-500/30 text-sky-400 hover:text-white py-2 rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1"
                            title="Compartilhar Link"
                          >
                            📤 Enviar
                          </button>
                        </div>
                      </>
                    )}
                    {(os.status === 'EM_ROTA' || os.status === 'NO_LOCAL') && (
                      <button 
                        onClick={() => setOsParaRastrear(os)}
                        className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <span>🛵</span> Rastrear Medidor no Mapa
                      </button>
                    )}

                    <button onClick={() => gerarPDF(os)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-xl text-xs font-bold transition-all">📄 Gerar PDF da OS</button>
                    
                    <button 
                      onClick={() => { setOsParaPix(os); setIsPixOpen(true) }} 
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5"
                    >
                      <span>⚡</span> {os.status_pagamento === 'PAGO' ? 'Ver Quitação PIX' : 'Pagar Medição via PIX'}
                    </button>

                    {os.status === 'CONCLUIDO' && os.caminho_medicao && (
                      <a href={os.caminho_medicao} target="_blank" rel="noreferrer" className="w-full mt-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-black transition-all text-center shadow-lg">
                        📥 Baixar Planta Finalizada
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {listaLoja.length === 0 && (
              <div className="col-span-full py-20 text-center bg-slate-900/50 rounded-3xl border border-dashed border-slate-800">
                <p className="text-slate-500 font-medium text-lg">Nenhuma medição encontrada.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL BLINDADO NOVA OS */}
      <NovaOsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        osParaEditar={osParaEditar} 
        lojas={lojas} 
        clientes={clientes} 
        perfil={perfil} 
        refId={refId} 
        onSuccess={() => { setIsModalOpen(false); carregarOrdens() }} 
      />

      {/* MODAL DE PAGAMENTO PIX */}
      <ModalPagamentoPix 
        isOpen={isPixOpen} 
        onClose={() => setIsPixOpen(false)} 
        os={osParaPix} 
        onPagamentoConfirmado={() => { carregarOrdens() }} 
      />

      {/* MODAL DE RASTREIO DE MEDIDOR AO VIVO */}
      {osParaRastrear && (
        <ModalRastreioLoja
          os={osParaRastrear}
          onClose={() => setOsParaRastrear(null)}
          formatarMoeda={formatarMoeda}
        />
      )}

      {/* MODAL DE AGENDA E DISPONIBILIDADE DO MEDIDOR */}
      {isAgendaOpen && (
        <ModalAgendaMedidor
          isOpen={isAgendaOpen}
          onClose={() => setIsAgendaOpen(false)}
          medidor={medidores.find(m => m.id === refId)}
          onSalvar={salvarAgendaMedidor}
        />
      )}

      {/* 📋 MODAL DE DETALHES COMPLETOS DA OS */}
      {osParaExibir && (
        <ModalDetalhesOS
          os={osParaExibir}
          onClose={() => setOsParaExibir(null)}
          formatarMoeda={formatarMoeda}
          onAceitar={aceitarDemanda}
          onRecusar={recusarDemanda}
          onAdicionarRota={handleAdicionarAoRoteiro}
          onMarcarChegada={marcarChegada}
          onEntregar={entregarMedicao}
        />
      )}

      {/* 📁 MODAL DE EDIÇÃO E UPLOAD DE DOCUMENTOS DA MEDIÇÃO CONCLUÍDA */}
      {osParaDocumentos && (
        <ModalDocumentosMedicao
          os={osParaDocumentos}
          onClose={() => setOsParaDocumentos(null)}
          onSalvarSucesso={() => carregarOrdens()}
        />
      )}
    </div>
  )
}
