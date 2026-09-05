import { useState, useEffect } from 'react'
import axios from 'axios'

export default function EquipeLoja() {
  const [usuarios, setUsuarios] = useState([])
  const [form, setForm] = useState({ nome: '', email: '' })
  const [editingId, setEditingId] = useState(null)

  const carregar = () => axios.get('/api/usuarios').then(res => setUsuarios(res.data))
  useEffect(() => { carregar() }, [])

  const salvar = async (e) => {
    e.preventDefault()
    try {
      if (editingId) await axios.put(`/api/usuarios/${editingId}`, form)
      else { await axios.post('/api/usuarios', form); alert("Usuário criado! A senha é: mudar@123") }
      setForm({ nome: '', email: '' }); setEditingId(null); carregar()
    } catch(e) { alert("Erro ao salvar usuário.") }
  }

  const deletar = async (id) => { if(window.confirm("Remover o acesso deste usuário?")) { await axios.delete(`/api/usuarios/${id}`); carregar() } }

  return (
    <div className="animate-fade-in flex flex-col h-full">
      <header className="mb-6"><h1 className="text-3xl font-black text-white">Minha Equipe</h1><p className="text-slate-500 font-medium mt-1">Gerencie os acessos ao painel da sua loja.</p></header>
      
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl mb-8">
        <h2 className="text-xl font-bold text-white mb-4">{editingId ? 'Editar Usuário' : 'Novo Acesso'}</h2>
        <form onSubmit={salvar} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:flex-1"><label className="block text-[10px] text-slate-500 font-black uppercase mb-1">Nome</label><input required placeholder="Ex: Ana Souza" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={form.nome} onChange={e=>setForm({...form, nome:e.target.value})} /></div>
          <div className="w-full md:flex-1"><label className="block text-[10px] text-slate-500 font-black uppercase mb-1">E-mail</label><input required type="email" placeholder="ana@sualoja.com.br" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></div>
          <div className="flex gap-2 w-full md:w-auto">
            {editingId && <button type="button" onClick={()=>{setEditingId(null); setForm({nome:'', email:''})}} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold">Cancelar</button>}
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold">{editingId ? 'Atualizar' : 'Liberar Acesso'}</button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {usuarios.map(u => (
          <div key={u.id} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">{u.nome.substring(0, 1).toUpperCase()}</div>
              <div><p className="font-bold text-white">{u.nome}</p><p className="text-xs text-slate-400">{u.email}</p></div>
            </div>
            <div className="flex gap-1">
              <button onClick={()=> {setForm({nome: u.nome, email: u.email}); setEditingId(u.id)}} className="text-slate-400 hover:text-blue-400 p-2 bg-slate-800 rounded-xl">✏️</button>
              <button onClick={()=> deletar(u.id)} className="text-slate-400 hover:text-red-400 p-2 bg-slate-800 rounded-xl">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}