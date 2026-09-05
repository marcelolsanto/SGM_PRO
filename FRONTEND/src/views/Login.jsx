import { useState } from 'react'
import axios from 'axios'

export default function Login({ setToken, setUsuario }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Controle para alternar entre "Login" e "Esqueci a Senha"
  const [modoRecuperacao, setModoRecuperacao] = useState(false)
  const [msgRecuperacao, setMsgRecuperacao] = useState('')

  const fazerLogin = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await axios.post('http://localhost:8080/api/login', { email, senha })
      localStorage.setItem('sgm_token', res.data.token)
      localStorage.setItem('sgm_usuario', res.data.nome)
      setToken(res.data.token)
      setUsuario(res.data.nome)
    } catch (err) {
      setErro('E-mail ou senha incorretos.')
      setLoading(false)
    }
  }

  const solicitarRecuperacao = async (e) => {
    e.preventDefault()
    setErro('')
    setMsgRecuperacao('')
    setLoading(true)
    try {
      await axios.post('http://localhost:8080/api/esqueci-senha', { email })
      setMsgRecuperacao('Instruções enviadas! Verifique seu e-mail (ou o terminal do servidor local).')
    } catch (err) {
      setErro('E-mail não encontrado no sistema.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl animate-fade-in">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-blue-500 tracking-tighter italic mb-2">SGM.PRO</h1>
          <p className="text-slate-500 font-medium">
            {modoRecuperacao ? 'Recuperação de Acesso' : 'Painel de Gestão e Operações'}
          </p>
        </div>

        {erro && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold p-4 rounded-xl mb-6 text-center">{erro}</div>}
        {msgRecuperacao && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold p-4 rounded-xl mb-6 text-center">{msgRecuperacao}</div>}

        {!modoRecuperacao ? (
          <form onSubmit={fazerLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 ml-1">E-mail de Acesso</label>
              <input required type="email" placeholder="seu@email.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white outline-none focus:border-blue-500 transition-colors" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 ml-1">Senha Segura</label>
              <input required type="password" placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white outline-none focus:border-blue-500 transition-colors" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 mt-4">
              {loading ? 'Autenticando...' : 'Entrar no Sistema'}
            </button>

            <button type="button" onClick={() => {setModoRecuperacao(true); setErro(''); setMsgRecuperacao('')}} className="w-full text-sm text-slate-500 hover:text-blue-400 font-medium transition-colors mt-4">
              Esqueci minha senha / Primeiro Acesso
            </button>
          </form>
        ) : (
          <form onSubmit={solicitarRecuperacao} className="space-y-5">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 ml-1">Digite seu E-mail cadastrado</label>
              <input required type="email" placeholder="seu@email.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white outline-none focus:border-blue-500 transition-colors" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            
            <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 mt-4">
              {loading ? 'Enviando...' : 'Receber Link de Troca'}
            </button>

            <button type="button" onClick={() => {setModoRecuperacao(false); setErro(''); setMsgRecuperacao('')}} className="w-full text-sm text-slate-500 hover:text-slate-300 font-medium transition-colors mt-4">
              Voltar para o Login
            </button>
          </form>
        )}
      </div>
    </div>
  )
}