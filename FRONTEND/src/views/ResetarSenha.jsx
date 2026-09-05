import { useState } from 'react'
import axios from 'axios'

export default function ResetarSenha({ token }) {
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [loading, setLoading] = useState(false)

  const redefinirSenha = async (e) => {
    e.preventDefault()
    setErro('')
    
    if (novaSenha.length < 6) {
      return setErro("A nova senha deve ter no mínimo 6 caracteres.")
    }
    if (novaSenha !== confirmarSenha) {
      return setErro("As senhas não coincidem. Tente novamente.")
    }

    setLoading(true)
    try {
      await axios.post('/api/resetar-senha', { token, nova_senha: novaSenha })
      setSucesso(true)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao redefinir a senha. O link pode estar expirado.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-2xl animate-fade-in">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-blue-500/30">
            🔒
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Criar Nova Senha</h1>
          <p className="text-slate-500 text-sm">Digite abaixo a sua nova senha de acesso ao sistema SGM.</p>
        </div>

        {erro && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold p-4 rounded-xl mb-6 text-center">{erro}</div>}

        {sucesso ? (
          <div className="text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold p-4 rounded-xl mb-6">
              ✅ Senha atualizada com sucesso!
            </div>
            <button onClick={() => window.location.href = '/'} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg">
              Ir para o Login
            </button>
          </div>
        ) : (
          <form onSubmit={redefinirSenha} className="space-y-5">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 ml-1">Nova Senha</label>
              <input required type="password" placeholder="Mínimo 6 caracteres" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white outline-none focus:border-blue-500" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 ml-1">Confirmar Nova Senha</label>
              <input required type="password" placeholder="Repita a senha" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white outline-none focus:border-blue-500" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
            </div>
            
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 mt-4">
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}