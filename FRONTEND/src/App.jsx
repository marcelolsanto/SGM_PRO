import { useState, useEffect } from 'react'
import axios from 'axios'
import Dashboard from './views/Dashboard'
import Operacoes from './views/Operacoes'
import Admin from './views/Admin'
import PainelFinanceiro from './views/PainelFinanceiro'
import MagicLink from './views/MagicLink'
import Login from './views/Login'
import PortalUsuario from './views/PortalUsuario'
import ResetarSenha from './views/ResetarSenha'
import TermosModal from './components/TermosModal'

const parseJwt = (t) => {
  if (!t || typeof t !== 'string') return null
  try {
    const base64Url = t.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    try {
      return JSON.parse(atob(t.split('.')[1]))
    } catch {
      return null
    }
  }
}

const isTokenValido = (t) => {
  if (!t) return false
  const decoded = parseJwt(t)
  if (!decoded || !decoded.perfil) return false
  if (decoded.exp && decoded.exp * 1000 < Date.now()) return false
  return true
}

const obterTokenInicial = () => {
  if (typeof window === 'undefined') return null
  const t = localStorage.getItem('sgm_token')
  if (isTokenValido(t)) return t
  localStorage.removeItem('sgm_token')
  localStorage.removeItem('sgm_usuario')
  return null
}

// Configuração imediata do token para evitar 401 nas primeiras chamadas dos componentes filhos
const tokenSalvo = obterTokenInicial()
if (tokenSalvo) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${tokenSalvo}`
}

axios.interceptors.request.use((config) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('sgm_token') : null
  if (t && isTokenValido(t)) {
    config.headers = config.headers || {}
    config.headers['Authorization'] = `Bearer ${t}`
  }
  return config
})

function App() {
  const [token, setToken] = useState(obterTokenInicial)
  const [usuario, setUsuario] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('sgm_usuario') || '' : ''))
  const [menuAberto, setMenuAberto] = useState(false)
  const [termosAberto, setTermosAberto] = useState(false)

  const tokenData = token ? parseJwt(token) : null
  const perfil = tokenData?.perfil || ''
  const refId = tokenData?.ref_id || 0

  const [abaAtiva, setAbaAtiva] = useState(perfil === 'MEDIDOR' ? 'operacoes' : 'dashboard')

  const fazerLogout = () => {
    localStorage.removeItem('sgm_token')
    localStorage.removeItem('sgm_usuario')
    delete axios.defaults.headers.common['Authorization']
    setToken(null)
    setUsuario('')
  }

  useEffect(() => {
    if (token) {
      if (!isTokenValido(token)) {
        fazerLogout()
      } else {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }, [token])

  // Interceptor global do Axios para deslogar em caso de 401 (token expirado ou inválido)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          fazerLogout()
        }
        return Promise.reject(error)
      }
    )
    return () => axios.interceptors.response.eject(interceptor)
  }, [])

  useEffect(() => {
    if (perfil === 'MEDIDOR') setAbaAtiva('operacoes')
  }, [perfil])

  // Captura o token na barra de endereços do navegador de forma segura
  const clienteMatch = window.location.pathname.match(/^\/cliente\/([^/?#]+)/)
  if (clienteMatch) return <MagicLink token={clienteMatch[1]} />
  
  const resetMatch = window.location.pathname.match(/^\/resetar-senha\/([^/?#]+)/)
  if (resetMatch) return <ResetarSenha token={resetMatch[1]} />
  if (!token || !perfil) return <Login setToken={setToken} setUsuario={setUsuario} />

  const menuAdmin = [
    { id: 'dashboard', icon: '📊', label: 'Visão Geral (BI)' },
    { id: 'operacoes', icon: '🛠️', label: 'Gestão de Operações' },
    { id: 'financeiro', icon: '🏦', label: 'Financeiro & Contábil' },
    { id: 'admin', icon: '⚙️', label: 'Cadastros Base' }
  ]
  
  const menuLoja = [
    { id: 'dashboard', icon: '📊', label: 'Meus Resultados' },
    { id: 'operacoes', icon: '📋', label: 'Minhas Medições' },
    { id: 'admin', icon: '⚙️', label: 'Meus Cadastros' }
  ]
  
  const menuAtual = perfil === 'ADMIN' ? menuAdmin : (perfil === 'LOJA' ? menuLoja : [])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-300 font-sans overflow-hidden">
      
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 fixed w-full top-0 z-50">
        <h1 className="text-xl font-black text-white italic tracking-tighter">SGM<span className="text-blue-600">.PRO</span></h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setTermosAberto(true)} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg font-bold border border-slate-700">⚖️ Termos</button>
          {perfil !== 'MEDIDOR' && <button onClick={() => setMenuAberto(!menuAberto)} className="text-2xl text-slate-400">☰</button>}
          {perfil === 'MEDIDOR' && <button onClick={fazerLogout} className="text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg font-bold">Sair</button>}
        </div>
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

            <button 
              onClick={() => { setTermosAberto(true); setMenuAberto(false); }}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all text-left"
            >
              <span className="text-xl">⚖️</span> <span className="text-sm font-medium">Termos & Garantias</span>
            </button>
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
          {perfil === 'ADMIN' && abaAtiva === 'dashboard' && <Dashboard perfil={perfil} />}
          {perfil === 'ADMIN' && abaAtiva === 'operacoes' && <Operacoes />}
          {perfil === 'ADMIN' && abaAtiva === 'financeiro' && <PainelFinanceiro perfil={perfil} onVoltar={() => setAbaAtiva('dashboard')} />}
          {perfil === 'ADMIN' && abaAtiva === 'admin' && <Admin perfil={perfil} refId={refId} />}

          {perfil === 'LOJA' && abaAtiva === 'dashboard' && <Dashboard perfil={perfil} />}
          {perfil === 'LOJA' && abaAtiva === 'operacoes' && <PortalUsuario perfil={perfil} refId={refId} setToken={setToken} />}
          {perfil === 'LOJA' && abaAtiva === 'financeiro' && <PainelFinanceiro perfil={perfil} onVoltar={() => setAbaAtiva('operacoes')} />}
          {perfil === 'LOJA' && abaAtiva === 'admin' && <Admin perfil={perfil} refId={refId} />}

          {perfil === 'MEDIDOR' && <PortalUsuario perfil={perfil} refId={refId} setToken={setToken} />}
        </div>
      </main>

      <TermosModal isOpen={termosAberto} onClose={() => setTermosAberto(false)} />
    </div>
  )
}

export default App