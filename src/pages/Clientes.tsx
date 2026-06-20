import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Cliente {
    id: string;
    nome: string;
    contato: string;
    operador: string;
    cnpjCpf: string;
    cidade: string;
    observacao: string;
    percentualAdiantamentoPadrao?: number;
    formaPagamento?: string;
    valorDiaria?: number;
    dataRegistro?: any;
}

export default function Clientes() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        nome: '',
        contato: '',
        operador: '',
        cnpjCpf: '',
        cidade: '',
        observacao: '',
        percentualAdiantamentoPadrao: 0,
        formaPagamento: '',
        valorDiaria: 0
    });
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'clientes'), orderBy('nome', 'asc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
            setClientes(list);
            setLoading(false);
        }, (error) => {
            console.error('Erro ao buscar clientes', error);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const openCreateModal = () => {
        setEditingId(null);
        setFormData({ nome: '', contato: '', operador: '', cnpjCpf: '', cidade: '', observacao: '', percentualAdiantamentoPadrao: 0, formaPagamento: '', valorDiaria: 0 });
        setIsFormOpen(true);
    };

    const handleEdit = (c: Cliente) => {
        setEditingId(c.id);
        setFormData({
            nome: c.nome || '',
            contato: c.contato || '',
            operador: c.operador || '',
            cnpjCpf: c.cnpjCpf || '',
            cidade: c.cidade || '',
            observacao: c.observacao || '',
            percentualAdiantamentoPadrao: c.percentualAdiantamentoPadrao || 0,
            formaPagamento: c.formaPagamento || '',
            valorDiaria: c.valorDiaria || 0
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm('Tem certeza que deseja excluir o cliente?')) {
            await deleteDoc(doc(db, 'clientes', id));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, 'clientes', editingId), {
                    ...formData,
                    dataAtualizacao: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'clientes'), {
                    ...formData,
                    dataRegistro: serverTimestamp()
                });
            }
            setIsFormOpen(false);
            setEditingId(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar cliente');
        } finally {
            setSubmitting(false);
        }
    };

    const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()) || 
                                          c.operador?.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6 text-text-primary">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Gestão de Clientes</h1>
                    <p className="text-text-muted text-sm">Cadastros, operadores e dados de contato.</p>
                </div>
                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">search</span>
                        <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:border-primary outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="bg-primary hover:bg-primary/90 text-background-dark font-black h-[42px] px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 uppercase text-xs shrink-0"
                    >
                        <span className="material-symbols-outlined text-xl">add</span>
                        Novo Cliente
                    </button>
                </div>
            </div>

            <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Empresa / Nome</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Operador</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Contato</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Cidade</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr><td colSpan={5} className="p-20 text-center text-text-muted uppercase font-black text-xs tracking-widest">Carregando...</td></tr>
                            ) : filtrados.length === 0 ? (
                                <tr><td colSpan={5} className="p-20 text-center text-text-muted uppercase font-black text-xs tracking-widest">Nenhum cliente cadatrado/encontrado.</td></tr>
                            ) : (
                                filtrados.map(c => (
                                    <tr key={c.id} onClick={() => handleEdit(c)} className="hover:bg-primary/5 transition-colors cursor-pointer group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-text-primary uppercase">{c.nome}</span>
                                                <span className="text-[10px] text-text-muted">{c.cnpjCpf || 'S/ Documento'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary text-sm opacity-70">badge</span>
                                                <span className="text-sm font-medium">{c.operador || '---'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-green-500 text-sm opacity-70">phone</span>
                                                <span className="text-sm font-medium">{c.contato || '---'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">{c.cidade || '---'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={(e) => handleDelete(c.id, e)} className="size-8 rounded-lg bg-background border border-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/30 transition-all">
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => setIsFormOpen(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-2xl rounded-[32px] shadow-2xl relative z-10 p-8 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-text-primary uppercase tracking-tighter">
                                {editingId ? 'Editar Cliente' : 'Novo Cliente'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Razão Social / Nome</span>
                                <input className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-bold" placeholder="Nome da empresa..." value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} required />
                            </label>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Operador (Responsável)</span>
                                    <input className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Ex: João Silva" value={formData.operador} onChange={(e) => setFormData({...formData, operador: e.target.value})} />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Contato (Telefone/Email)</span>
                                    <input className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="(00) 00000-0000" value={formData.contato} onChange={(e) => setFormData({...formData, contato: e.target.value})} />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">CNPJ / CPF</span>
                                    <input className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="00.000.000/0000-00" value={formData.cnpjCpf} onChange={(e) => setFormData({...formData, cnpjCpf: e.target.value})} />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Cidade / Estado</span>
                                    <input className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Ex: São Paulo, SP" value={formData.cidade} onChange={(e) => setFormData({...formData, cidade: e.target.value})} />
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">% Adiantamento Padrão</span>
                                    <input type="number" step="0.01" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Ex: 30" value={formData.percentualAdiantamentoPadrao || ''} onChange={(e) => setFormData({...formData, percentualAdiantamentoPadrao: parseFloat(e.target.value) || 0})} />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Forma de Pagamento Padrão</span>
                                    <input type="text" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Ex: Pix, Pamcard..." value={formData.formaPagamento} onChange={(e) => setFormData({...formData, formaPagamento: e.target.value})} />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Valor da Diária (R$)</span>
                                    <input type="number" step="0.01" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Ex: 500.00" value={formData.valorDiaria || ''} onChange={(e) => setFormData({...formData, valorDiaria: parseFloat(e.target.value) || 0})} />
                                </label>
                            </div>

                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Observações Internas</span>
                                <textarea className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm resize-none h-24" placeholder="Detalhes de faturamento, prazos..." value={formData.observacao} onChange={(e) => setFormData({...formData, observacao: e.target.value})} />
                            </label>
                        </form>

                        <div className="mt-6 pt-6 border-t border-border flex justify-end gap-3">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-4 border border-border text-text-muted font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-surface-dark transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSubmit} disabled={submitting} className="px-8 py-4 bg-primary text-background-dark font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                {submitting ? 'Salvando...' : 'Salvar Cliente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
