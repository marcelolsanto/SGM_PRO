import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Admin({ perfil = 'ADMIN', refId = 0 }) {
  // 🔥 MÁGICA DO MARKETPLACE: Admin vê tudo. Loja vê apenas os seus Clientes e Vendedores 🔥
  const abasDisponiveis = perfil === 'ADMIN' 
    ? ['lojas', 'medidores globais', 'clientes', 'usuarios'] 
    : ['clientes', 'minha equipe']

  const [abaAtiva, setAbaAtiva] = useState(perfil === 'ADMIN' ? 'lojas' : 'clientes')
  const [editingId, setEditingId] = useState(null)
 
  const [lojas, setLojas] = useState([])
  const [medidores, setMedidores] = useState([])
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])

  const [formLoja, setFormLoja] = useState({ nome_fantasia: '', cnpj: '', email: '', telefone: '', endereco: '' })
  const [formMedidor, setFormMedidor] = useState({ nome_completo: '', cpf: '', telefone: '', taxa_por_m2: 1.55 }) // 🔥 ATUALIZADO PARA 1.55
  const [formCliente, setFormCliente] = useState({ nome: '', cpf_cnpj: '', telefone: '', email: '' })
  const [formUsuario, setFormUsuario] = useState({ nome: '', email: '', perfil: 'LOJA', ref_id: '' })

  const carregarDados = async () => {
    try {
      if (perfil === 'ADMIN') {
        const resLojas = await axios.get('http://localhost:8080/api/lojas')
        const resMedidores = await axios.get('http://localhost:8080/api/medidores')
        setLojas(resLojas.data)
        setMedidores(resMedidores.data)
      }
      const resClientes = await axios.get('http://localhost:8080/api/clientes')
      const resUsuarios = await axios.get('http://localhost:8080/api/usuarios')
      
      setClientes(resClientes.data)
      setUsuarios(resUsuarios.data)
    } catch (e) { console.error("Erro ao carregar dados", e) }
  }

  useEffect(() => { carregarDados() }, [perfil])

  const trocarAba = (aba) => {
    setAbaAtiva(aba);
    setEditingId(null)
    setFormLoja({ nome_fantasia: '', cnpj: '', email: '', telefone: '', endereco: '' })
    setFormMedidor({ nome_completo: '', cpf: '', telefone: '', taxa_por_m2: 1.55 }) // 🔥 ATUALIZADO PARA 1.55
    setFormCliente({ nome: '', cpf_cnpj: '', telefone: '', email: '' })
    setFormUsuario({ nome: '', email: '', perfil: 'LOJA', ref_id: '' })
  }

  // Salvamentos API...
  const salvarLoja = async (e) => { e.preventDefault(); try { if (editingId) await axios.put(`http://localhost:8080/api/lojas/${editingId}`, formLoja); else await axios.post('http://localhost:8080/api/lojas', formLoja); trocarAba('lojas'); carregarDados() } catch (e) { alert("Erro") } }
  const salvarMedidor = async (e) => { e.preventDefault(); try { const p = { ...formMedidor, taxa_por_m2: parseFloat(formMedidor.taxa_por_m2) }; if (editingId) await axios.put(`http://localhost:8080/api/medidores/${editingId}`, p); else await axios.post('http://localhost:8080/api/medidores', p); trocarAba('medidores globais'); carregarDados() } catch (e) { alert("Erro") } }
  const salvarCliente = async (e) => { e.preventDefault(); try { if (editingId) await axios.put(`http://localhost:8080/api/clientes/${editingId}`, formCliente); else await axios.post('http://localhost:8080/api/clientes', formCliente); trocarAba('clientes'); carregarDados() } catch (e) { alert("Erro") } }

  const salvarUsuario = async (e) => {
    e.preventDefault()
    try {
      let payload = { ...formUsuario }
      if (perfil === 'LOJA') { payload.perfil = 'LOJA'; payload.ref_id = refId } 
      else { payload.ref_id = parseInt(formUsuario.ref_id) || 0 }

      if (editingId) await axios.put(`http://localhost:8080/api/usuarios/${editingId}`, payload)
      else { await axios.post('http://localhost:8080/api/usuarios', payload); alert("✅ Utilizador criado com sucesso! Senha padrão: mudar@123") }
      trocarAba(perfil === 'ADMIN' ? 'usuarios' : 'minha equipe'); carregarDados()
    } catch (error) { 
      const msg = error.response?.data?.erro || "Erro ao salvar utilizador";
      alert("❌ " + msg);
    }
  }

  const excluirLoja = async (id) => { if(window.confirm("Excluir?")) { await axios.delete(`http://localhost:8080/api/lojas/${id}`); carregarDados() } }
  const excluirMedidor = async (id) => { if(window.confirm("Excluir?")) { await axios.delete(`http://localhost:8080/api/medidores/${id}`); carregarDados() } }
  const excluirCliente = async (id) => { if(window.confirm("Excluir?")) { await axios.delete(`http://localhost:8080/api/clientes/${id}`); carregarDados() } }
  const excluirUsuario = async (id) => { if(window.confirm("Remover o acesso?")) { await axios.delete(`http://localhost:8080/api/usuarios/${id}`); carregarDados() } }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-white">{perfil === 'ADMIN' ? 'Cadastros Base da Plataforma' : 'Meus Cadastros da Loja'}</h1>
        <p className="text-slate-500 font-medium mt-1">{perfil === 'ADMIN' ? 'Gestão da Rede (Lojas e Medidores Globais)' : 'Gerencie os seus clientes finais e os vendedores da sua loja.'}</p>
      </header>

      <div className="flex gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-8 overflow-x-auto custom-scrollbar">
        {abasDisponiveis.map(aba => (
          <button key={aba} onClick={() => trocarAba(aba)} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all capitalize whitespace-nowrap ${abaAtiva === aba ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
            {aba === 'usuarios' ? '🔒 Todos os Acessos' : aba === 'minha equipe' ? '👥 Vendedores (Acesso)' : aba === 'clientes' ? '🤝 Clientes Finais' : aba}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl sticky top-10">
            <h2 className="text-xl font-black text-white mb-6 capitalize border-b border-slate-800 pb-4">{editingId ? `Editar Registro` : `Novo Registro`}</h2>

            {abaAtiva === 'lojas' && perfil === 'ADMIN' && (
              <form onSubmit={salvarLoja} className="space-y-4">
                <input required placeholder="Nome Fantasia" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formLoja.nome_fantasia} onChange={e => setFormLoja({...formLoja, nome_fantasia: e.target.value})} />
                <input required placeholder="CNPJ" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formLoja.cnpj} onChange={e => setFormLoja({...formLoja, cnpj: e.target.value})} />
                <input required type="email" placeholder="E-mail Administrativo" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formLoja.email} onChange={e => setFormLoja({...formLoja, email: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">{editingId ? 'Atualizar' : 'Cadastrar'}</button>
              </form>
            )}

            {abaAtiva === 'medidores globais' && perfil === 'ADMIN' && (
              <form onSubmit={salvarMedidor} className="space-y-4">
                <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 mb-2">Este medidor ficará disponível na "Nuvem" para que qualquer loja possa atribuir-lhe uma OS.</p>
                <input required placeholder="Nome Completo" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formMedidor.nome_completo} onChange={e => setFormMedidor({...formMedidor, nome_completo: e.target.value})} />
                <input required placeholder="CPF" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formMedidor.cpf} onChange={e => setFormMedidor({...formMedidor, cpf: e.target.value})} />
                <div><label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 ml-1">Repasse (R$ por m²)</label><input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500 font-mono" value={formMedidor.taxa_por_m2} onChange={e => setFormMedidor({...formMedidor, taxa_por_m2: e.target.value})} /></div>
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">{editingId ? 'Atualizar Medidor' : 'Aprovar Medidor'}</button>
              </form>
            )}

            {abaAtiva === 'clientes' && (
              <form onSubmit={salvarCliente} className="space-y-4">
                <input required placeholder="Nome do Cliente Final" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formCliente.nome} onChange={e => setFormCliente({...formCliente, nome: e.target.value})} />
                <input required placeholder="CPF / CNPJ" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formCliente.cpf_cnpj} onChange={e => setFormCliente({...formCliente, cpf_cnpj: e.target.value})} />
                <input placeholder="Telefone" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formCliente.telefone} onChange={e => setFormCliente({...formCliente, telefone: e.target.value})} />
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">{editingId ? 'Atualizar Cliente' : 'Cadastrar Cliente'}</button>
              </form>
            )}

            {(abaAtiva === 'usuarios' || abaAtiva === 'minha equipe') && (
              <form onSubmit={salvarUsuario} className="space-y-4">
                {!editingId && <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-xl mb-4 text-xs text-amber-500 font-medium">A senha padrão de todo novo utilizador será: <strong className="text-white bg-slate-800 px-2 py-1 rounded">mudar@123</strong></div>}
                
                <input required placeholder="Nome do Funcionário/Utilizador" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formUsuario.nome} onChange={e => setFormUsuario({...formUsuario, nome: e.target.value})} />
                <input required type="email" placeholder="E-mail de Login" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" value={formUsuario.email} onChange={e => setFormUsuario({...formUsuario, email: e.target.value})} />
                
                {perfil === 'ADMIN' && (
                  <>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 ml-1">Nível de Acesso</label>
                      <select required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500 appearance-none" value={formUsuario.perfil} onChange={e => setFormUsuario({...formUsuario, perfil: e.target.value, ref_id: ''})}>
                        <option value="ADMIN">👑 Administrador Global</option>
                        <option value="LOJA">🏬 Lojista / Vendedor</option>
                        <option value="MEDIDOR">🛵 Medidor em Campo</option>
                      </select>
                    </div>

                    {formUsuario.perfil === 'LOJA' && (
                      <select required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500 appearance-none" value={formUsuario.ref_id} onChange={e => setFormUsuario({...formUsuario, ref_id: e.target.value})}>
                        <option value="" disabled>Selecione a Loja...</option>
                        {lojas.map(l => <option key={l.id} value={l.id}>{l.nome_fantasia}</option>)}
                      </select>
                    )}

                    {formUsuario.perfil === 'MEDIDOR' && (
                      <select required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-blue-500 appearance-none" value={formUsuario.ref_id} onChange={e => setFormUsuario({...formUsuario, ref_id: e.target.value})}>
                        <option value="" disabled>Selecione o Medidor Global...</option>
                        {medidores.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                      </select>
                    )}
                  </>
                )}

                <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20">{editingId ? 'Atualizar Acesso' : 'Criar Acesso'}</button>
              </form>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {abaAtiva === 'lojas' && lojas.map(loja => (
            <div key={loja.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex justify-between items-center"><div className="text-white font-bold">{loja.nome_fantasia}</div><div className="flex gap-1"><button onClick={() => {setFormLoja(loja); setEditingId(loja.id)}} className="p-2 bg-slate-800 rounded-lg hover:text-blue-500">✏️</button><button onClick={() => excluirLoja(loja.id)} className="p-2 bg-slate-800 rounded-lg hover:text-red-500">🗑️</button></div></div>
          ))}

          {abaAtiva === 'medidores globais' && medidores.map(med => (
            <div key={med.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-black border border-blue-500/30">{med.nome_completo.substring(0, 2).toUpperCase()}</div>
                <div><p className="font-bold text-white flex items-center gap-2">{med.nome_completo}</p><p className="text-sm text-slate-500">WhatsApp: {med.telefone}</p></div>
              </div>
              <div className="flex gap-1"><button onClick={() => {setFormMedidor(med); setEditingId(med.id)}} className="p-2 bg-slate-800 rounded-lg hover:text-blue-500">✏️</button><button onClick={() => excluirMedidor(med.id)} className="p-2 bg-slate-800 rounded-lg hover:text-red-500">🗑️</button></div>
            </div>
          ))}

          {abaAtiva === 'clientes' && clientes.map(cli => (
            <div key={cli.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex justify-between items-center"><div className="text-white font-bold">{cli.nome}</div><div className="flex gap-1"><button onClick={() => {setFormCliente(cli); setEditingId(cli.id)}} className="p-2 bg-slate-800 rounded-lg hover:text-blue-500">✏️</button><button onClick={() => excluirCliente(cli.id)} className="p-2 bg-slate-800 rounded-lg hover:text-red-500">🗑️</button></div></div>
          ))}

          {(abaAtiva === 'usuarios' || abaAtiva === 'minha equipe') && usuarios.map(usu => (
            <div key={usu.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black border ${usu.perfil === 'ADMIN' ? 'bg-red-500/20 text-red-400' : usu.perfil === 'LOJA' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{usu.perfil.substring(0, 1)}</div>
                <div><p className="font-bold text-white text-lg">{usu.nome} <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded ml-2 uppercase font-black">{usu.perfil}</span></p><p className="text-sm text-slate-500">📧 {usu.email}</p></div>
              </div>
              <div className="flex gap-1"><button onClick={() => {setFormUsuario({nome: usu.nome, email: usu.email, perfil: usu.perfil, ref_id: usu.ref_id || ''}); setEditingId(usu.id)}} className="p-2 bg-slate-800 rounded-lg hover:text-blue-500">✏️</button><button onClick={() => excluirUsuario(usu.id)} className="p-2 bg-slate-800 rounded-lg hover:text-red-500">🗑️</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}