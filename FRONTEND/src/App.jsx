import { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './views/Dashboard'
import Operacoes from './views/Operacoes'
import TorreControle from './views/TorreControle'
import Admin from './views/Admin'
import MagicLink from './views/MagicLink'
import Login from './views/Login'
import PortalUsuario from './views/PortalUsuario'
import ResetarSenha from './views/ResetarSenha'
import LandingPage from './views/LandingPage'

function App() {
  const [token, setToken] = useState(localStorage.getItem('sgm_token') || null)
  const [usuario, setUsuario] = useState(localStorage.getItem('sgm_usuario') || '')
  const [menuAberto, setMenuAberto] = useState(false)
  const [telaPublica, setTelaPublica] = useState(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/login') return 'login'
    return 'landing'
  })

  const parseJwt = (t) => { try { return JSON.parse(atob(t.split('.')[1])) } catch (e) { return null } }
  const tokenData = token ? parseJwt(token) : null
  const perfil = tokenData?.perfil || ''
  const refId = tokenData?.ref_id || 0

  const [abaAtiva, setAbaAtiva] = useState(perfil === 'MEDIDOR' ? 'operacoes' : 'dashboard')

  useEffect(() => {
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    else delete axios.defaults.headers.common['Authorization']
  }, [token])

  const fazerLogout = () => {
    localStorage.removeItem('sgm_token'); localStorage.removeItem('sgm_usuario')
    setToken(null); setUsuario('')
    setTelaPublica('landing')
  }

  useEffect(() => {
    if (perfil === 'MEDIDOR') setAbaAtiva('operacoes')
  }, [perfil])

  // Roteamento do Link Mágico do Cliente
  if (window.location.pathname.startsWith('/cliente/')) return <MagicLink token={window.location.pathname.split('/').pop()} />
  
  // Roteamento de Redefinição de Senha
  if (window.location.pathname.startsWith('/resetar-senha/')) return <ResetarSenha token={window.location.pathname.split('/').pop()} />
  
  // Roteamento Público (Sem Login): Alterna entre Landing Page e Login
  if (!token) {
    if (telaPublica === 'login') {
      return <Login setToken={setToken} setUsuario={setUsuario} onVoltarLanding={() => setTelaPublica('landing')} />
    }
    return <LandingPage onIrParaLogin={() => setTelaPublica('login')} />
  }

  const menuAdmin = [
    { id: 'dashboard', icon: '📊', label: 'Visão Geral (BI)' },
    { id: 'campo', icon: '🗺️', label: 'Torre de Controle (Campo)' },
    { id: 'operacoes', icon: '🛠️', label: 'Gestão de Operações' },
    { id: 'admin', icon: '⚙️', label: 'Cadastros Base' },
    { id: 'institucional', icon: '🌐', label: 'Site Institucional' }
  ]
  
  const menuLoja = [
    { id: 'dashboard', icon: '📊', label: 'Meus Resultados' },
    { id: 'campo', icon: '🗺️', label: 'Torre de Controle (Campo)' },
    { id: 'operacoes', icon: '📋', label: 'Minhas Medições' },
    { id: 'admin', icon: '⚙️', label: 'Meus Cadastros' },
    { id: 'institucional', icon: '🌐', label: 'Site Institucional' }
  ]
  
  const menuAtual = perfil === 'ADMIN' ? menuAdmin : (perfil === 'LOJA' ? menuLoja : [])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-300 font-sans overflow-hidden">
      
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 fixed w-full top-0 z-50">
        <h1 className="text-xl font-black text-white italic tracking-tighter">SGM<span className="text-blue-600">.PRO</span></h1>
        {perfil !== 'MEDIDOR' && <button onClick={() => setMenuAberto(!menuAberto)} className="text-2xl text-slate-400">☰</button>}
        {perfil === 'MEDIDOR' && (
          <div className="flex items-center gap-2">
            <button onClick={() => setAbaAtiva(abaAtiva === 'campo' ? 'operacoes' : 'campo')} className="text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg font-bold flex items-center gap-1">
              {abaAtiva === 'campo' ? '🛵 Minha Rota' : '🗺️ Torre de Controle'}
            </button>
            <button onClick={() => setAbaAtiva(abaAtiva === 'institucional' ? 'operacoes' : 'institucional')} className="text-xs bg-blue-600/20 text-blue-400 px-3 py-1 rounded-lg font-bold">
              {abaAtiva === 'institucional' ? 'Minhas OSs' : '🌐 Planos'}
            </button>
            <button onClick={fazerLogout} className="text-xs bg-red-500/10 text-red-400 px-3 py-1 rounded-lg font-bold">Sair</button>
          </div>
        )}
      </div>

      {perfil !== 'MEDIDOR' && (
        <aside className={`fixed md:relative top-[69px] md:top-0 left-0 h-[calc(100vh-69px)] md:h-screen w-64 bg-slate-900 border-r border-slate-800 p-6 z-40 transition-transform duration-300 flex flex-col ${menuAberto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="hidden md:block mb-10">
            <h1 className="text-3xl font-black text-white italic tracking-tighter">SGM<span className="text-blue-600">.PRO</span></h1>
            <p className="text-[9px] font-black text-slate-500 tracking-[0.2em] mt-1 uppercase">{perfil === 'ADMIN' ? 'Administração' : 'Painel do Lojista'}</p>
          </div>

          <nav className="flex-1 space-y-2">
            {menuAtual.map(item => (
              <button key={item.id} onClick={() => { setAbaAtiva(item.id); setMenuAberto(false) }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${abaAtiva === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                <span className="text-xl">{item.icon}</span> <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto bg-slate-950 p-4 rounded-[1.5rem] border border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white shrink-0">
                {usuario ? usuario.substring(0, 2).toUpperCase() : 'US'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-black text-white truncate">{usuario}</p>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{perfil}</p>
              </div>
            </div>
            <button onClick={fazerLogout} className="w-full mt-4 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white py-2.5 rounded-xl text-xs font-bold transition-colors">Sair do Sistema</button>
          </div>
        </aside>
      )}

      <main className="flex-1 p-4 md:p-10 overflow-y-auto mt-[69px] md:mt-0 h-[calc(100vh-69px)] md:h-screen custom-scrollbar relative">
        <div className="max-w-7xl mx-auto pb-20 md:pb-0 h-full">
          {abaAtiva === 'institucional' && <LandingPage onIrParaLogin={() => setAbaAtiva('dashboard')} />}

          {perfil === 'ADMIN' && abaAtiva === 'dashboard' && <Dashboard perfil={perfil} />}
          {abaAtiva === 'campo' && <TorreControle perfil={perfil} setToken={setToken} />}
          {perfil === 'ADMIN' && abaAtiva === 'operacoes' && <Operacoes />}
          {perfil === 'ADMIN' && abaAtiva === 'admin' && <Admin perfil={perfil} refId={refId} />}

          {perfil === 'LOJA' && abaAtiva === 'dashboard' && <Dashboard perfil={perfil} />}
          {perfil === 'LOJA' && abaAtiva === 'operacoes' && <PortalUsuario perfil={perfil} refId={refId} setToken={setToken} />}
          {perfil === 'LOJA' && abaAtiva === 'admin' && <Admin perfil={perfil} refId={refId} />}

          {perfil === 'MEDIDOR' && abaAtiva !== 'institucional' && abaAtiva !== 'campo' && <PortalUsuario perfil={perfil} refId={refId} setToken={setToken} />}
        </div>
      </main>
    </div>
  )
}

export default App
