import { useState, useEffect } from 'react';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { maskPlate } from '../utils/masks';

interface Veiculo {
    id: string;
    placa: string;
    tipo: 'cavalo' | 'bau';
    subTipo?: string; // e.g., 'Sider', 'Grade Baixa' for bau
    validadeTacografo?: string; // only for cavalo
    validadeLicenciamento: string;
    status: 'ativo' | 'inativo';
    criadoEm: any;
    atualizadoEm: any;
}

const BAU_SUBTYPES = ['80m³', '90m³', '100m³', '110m³', '120m³', 'Sider', 'Grade Baixa', 'Prancha'];
const CAVALO_SUBTYPES = ['Toco', 'Truck', 'Bitruck', 'Carreta', 'LS', 'Rodotrem'];

export default function Veiculos() {
    const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage] = useState(1);
    const pageSize = 10;

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<{
        placa: string;
        tipo: 'cavalo' | 'bau';
        subTipo: string;
        validadeTacografo: string;
        validadeLicenciamento: string;
        status: 'ativo' | 'inativo';
    }>({
        placa: '',
        tipo: 'cavalo',
        subTipo: '',
        validadeTacografo: '',
        validadeLicenciamento: '',
        status: 'ativo'
    });

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{id: string, status: 'ativo'|'inativo', action: string} | null>(null);

    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'veiculos'), orderBy('criadoEm', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Veiculo));
            setVeiculos(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    };

    const checkExpirations = () => {
        const expiring = veiculos.filter(v => {
            const today = new Date();
            const oneMonthFromNow = new Date();
            oneMonthFromNow.setMonth(today.getMonth() + 1);

            const tacExpiry = v.validadeTacografo ? new Date(v.validadeTacografo) : null;
            const licExpiry = new Date(v.validadeLicenciamento);

            const isTacExp = tacExpiry && tacExpiry <= oneMonthFromNow;
            const isLicExp = licExpiry <= oneMonthFromNow;

            return (isTacExp || isLicExp) && v.status === 'ativo';
        });

        if (expiring.length > 0) {
            const plates = expiring.slice(0, 2).map(v => v.placa).join(', ');
            const more = expiring.length > 2 ? ` e mais ${expiring.length - 2}` : '';
            showToast(`Atenção: Documentos vencendo/vencidos para: ${plates}${more}`, 'error');
        }
    };

    useEffect(() => {
        if (veiculos.length > 0 && !loading) {
            checkExpirations();
        }
    }, [loading]);

    const validate = () => {
        const errors: Record<string, string> = {};
        const plateClean = formData.placa.replace(/[^a-zA-Z0-9]/g, '');
        if (plateClean.length < 7) {
            errors.placa = 'Placa incompleta';
        }
        if (!formData.subTipo) {
            errors.subTipo = 'Selecione o sub-tipo';
        }
        if (formData.tipo === 'cavalo' && !formData.validadeTacografo) {
            errors.validadeTacografo = 'Campo obrigatório para Cavalo';
        }
        if (!formData.validadeLicenciamento) {
            errors.validadeLicenciamento = 'Campo obrigatório';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleInputChange = (field: string, value: string) => {
        let maskedValue = value;
        if (field === 'placa') maskedValue = maskPlate(value);
        setFormData(prev => ({ ...prev, [field]: maskedValue }));
    };

    const openCreateModal = () => {
        setEditingId(null);
        setFormData({
            placa: '',
            tipo: 'cavalo',
            subTipo: '',
            validadeTacografo: '',
            validadeLicenciamento: '',
            status: 'ativo'
        });
        setFormErrors({});
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                placa: formData.placa.toUpperCase(),
                atualizadoEm: serverTimestamp()
            };
            
            // Remove tacografo if it's a bau
            if (formData.tipo === 'bau') {
                delete (payload as any).validadeTacografo;
            }

            if (editingId) {
                await updateDoc(doc(db, 'veiculos', editingId), payload);
                showToast('Veículo atualizado com sucesso!', 'success');
            } else {
                await addDoc(collection(db, 'veiculos'), {
                    ...payload,
                    criadoEm: serverTimestamp()
                });
                showToast('Veículo cadastrado com sucesso!', 'success');
            }
            setIsFormOpen(false);
        } catch (error: any) {
            showToast('Erro ao salvar veículo', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (v: Veiculo) => {
        setEditingId(v.id);
        setFormData({
            placa: v.placa,
            tipo: v.tipo,
            subTipo: v.subTipo || '',
            validadeTacografo: v.validadeTacografo || '',
            validadeLicenciamento: v.validadeLicenciamento || '',
            status: v.status
        });
        setIsFormOpen(true);
    };

    const toggleStatus = async (id: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
            await updateDoc(doc(db, 'veiculos', id), {
                status: newStatus,
                atualizadoEm: serverTimestamp()
            });
            showToast(`Veículo ${newStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        } catch (error) {
            console.error("Error toggling status:", error);
            showToast('Erro ao alterar status', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'veiculos', id));
            showToast('Veículo excluído com sucesso!', 'success');
        } catch (error) {
            console.error("Error deleting vehicle:", error);
            showToast('Erro ao excluir veículo', 'error');
        }
        setDeleteModalId(null);
    };

    const isNearExpiration = (dateStr: string) => {
        if (!dateStr) return false;
        const expiry = new Date(dateStr);
        const today = new Date();
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(today.getMonth() + 1);
        return expiry <= oneMonthFromNow && expiry >= today;
    };

    const isExpired = (dateStr: string) => {
        if (!dateStr) return false;
        const expiry = new Date(dateStr);
        const today = new Date();
        return expiry < today;
    };

    const filteredVeiculos = veiculos.filter(v => {
        const matchesSearch = (v.placa || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'todos' || v.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const paginated = filteredVeiculos.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-text-primary tracking-tight text-2xl lg:text-3xl font-bold leading-tight">Gestão de Veículos</h1>
                    <p className="text-text-muted text-xs lg:text-sm font-normal">Controle de frota, tacógrafos e licenciamentos.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-primary hover:bg-primary/90 text-background-dark font-black py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 text-xs lg:text-sm uppercase tracking-wider"
                >
                    <span className="material-symbols-outlined text-[20px]">add_circle</span>
                    Novo Veículo
                </button>
            </div>

            <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-xl">
                <div className="p-4 lg:p-6 border-b border-border bg-surface/30 flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="relative w-full lg:w-96">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary material-symbols-outlined text-[20px]">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por placa..."
                            className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Placa</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Tipo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Sub-tipo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Tacógrafo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Licenciamento</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {paginated.map(v => (
                                <tr key={v.id} onClick={() => handleEdit(v)} className="hover:bg-primary/5 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4 font-black text-sm uppercase text-primary">{v.placa}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${v.tipo === 'cavalo' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                            {v.tipo}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold uppercase">{v.subTipo || '---'}</td>
                                    <td className="px-6 py-4">
                                        {v.tipo === 'cavalo' ? (
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-bold ${isExpired(v.validadeTacografo!) ? 'text-red-500' : isNearExpiration(v.validadeTacografo!) ? 'text-amber-500' : 'text-text-primary'}`}>
                                                    {v.validadeTacografo ? new Date(v.validadeTacografo).toLocaleDateString('pt-BR') : '---'}
                                                </span>
                                                {isNearExpiration(v.validadeTacografo!) && !isExpired(v.validadeTacografo!) && (
                                                    <span className="text-[9px] font-black text-amber-500 uppercase">Vence em breve</span>
                                                )}
                                                {isExpired(v.validadeTacografo!) && (
                                                    <span className="text-[9px] font-black text-red-500 uppercase">Vencido</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-text-muted text-[10px]">N/A</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className={`text-xs font-bold ${isExpired(v.validadeLicenciamento) ? 'text-red-500' : isNearExpiration(v.validadeLicenciamento) ? 'text-amber-500' : 'text-text-primary'}`}>
                                                {v.validadeLicenciamento ? new Date(v.validadeLicenciamento).toLocaleDateString('pt-BR') : '---'}
                                            </span>
                                            {isNearExpiration(v.validadeLicenciamento) && !isExpired(v.validadeLicenciamento) && (
                                                <span className="text-[9px] font-black text-amber-500 uppercase">Vence em breve</span>
                                            )}
                                            {isExpired(v.validadeLicenciamento) && (
                                                <span className="text-[9px] font-black text-red-500 uppercase">Vencido</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmModal({
                                                    id: v.id,
                                                    status: v.status === 'ativo' ? 'inativo' : 'ativo',
                                                    action: v.status === 'ativo' ? 'desativar' : 'ativar'
                                                });
                                            }}
                                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${v.status === 'ativo'
                                                ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white'
                                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500 hover:text-white'
                                                }`}
                                        >
                                            {v.status || 'ativo'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1.5 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(v);
                                                }}
                                                className="size-8 rounded-lg bg-background border border-border flex items-center justify-center text-text-muted hover:text-primary transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteModalId(v.id);
                                                }}
                                                className="size-8 rounded-lg bg-background border border-border flex items-center justify-center text-text-muted hover:text-red-500 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => setIsFormOpen(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 p-8">
                        <h3 className="text-xl font-black text-text-primary mb-6 uppercase tracking-tighter">
                            {editingId ? 'Editar Veículo' : 'Novo Veículo'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Tipo</span>
                                    <select className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" value={formData.tipo} onChange={(e) => setFormData({...formData, tipo: e.target.value as 'cavalo' | 'bau', subTipo: ''})} required>
                                        <option value="cavalo">Cavalo (Trator)</option>
                                        <option value="bau">Baú / Implemento</option>
                                    </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Placa</span>
                                    <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm uppercase font-bold" value={formData.placa} onChange={(e) => handleInputChange('placa', e.target.value)} required />
                                </label>
                            </div>
                            <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Sub-tipo ({formData.tipo})</span>
                                <select className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" value={formData.subTipo} onChange={(e) => setFormData({...formData, subTipo: e.target.value})} required>
                                    <option value="">Selecione...</option>
                                    {(formData.tipo === 'cavalo' ? CAVALO_SUBTYPES : BAU_SUBTYPES).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                {formData.tipo === 'cavalo' && (
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Validade Tacógrafo</span>
                                        <input type="date" className={`w-full bg-background border ${formErrors.validadeTacografo ? 'border-red-500' : 'border-border'} rounded-xl px-4 py-2.5 text-sm`} value={formData.validadeTacografo} onChange={(e) => setFormData({...formData, validadeTacografo: e.target.value})} />
                                    </label>
                                )}
                                <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Validade Licenciamento</span>
                                    <input type="date" className={`w-full bg-background border ${formErrors.validadeLicenciamento ? 'border-red-500' : 'border-border'} rounded-xl px-4 py-2.5 text-sm`} value={formData.validadeLicenciamento} onChange={(e) => setFormData({...formData, validadeLicenciamento: e.target.value})} required />
                                </label>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-3 bg-background border border-border text-text-muted font-black text-[10px] uppercase rounded-xl">Cancelar</button>
                                <button type="submit" disabled={submitting} className="flex-[2] py-3 bg-primary text-background-dark font-black text-[10px] uppercase rounded-xl shadow-lg shadow-primary/20">
                                    {submitting ? 'Salvando...' : 'Salvar Veículo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 duration-300">
                    <div className={`flex items-center gap-3 px-6 py-3.5 rounded-full shadow-2xl border backdrop-blur-md ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        <span className="material-symbols-outlined text-[18px]">
                            {toast.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <span className="text-[11px] font-black uppercase tracking-widest">{toast.message}</span>
                    </div>
                </div>
            )}

            {deleteModalId && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
                    <div className="bg-surface border border-border rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
                        <div className="size-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                            <span className="material-symbols-outlined text-red-500 text-3xl">warning</span>
                        </div>
                        <h3 className="text-xl font-black text-text-primary mb-2 tracking-tight">Excluir Veículo?</h3>
                        <p className="text-text-muted text-sm mb-6">Esta ação não poderá ser desfeita. Tem certeza que deseja continuar?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteModalId(null)} className="flex-1 py-3 px-4 rounded-xl border border-border text-text-muted font-bold text-[10px] uppercase tracking-widest hover:bg-background transition-colors">Cancelar</button>
                            <button onClick={() => handleDelete(deleteModalId)} className="flex-1 py-3 px-4 rounded-xl bg-red-500 text-white font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            {confirmModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
                    <div className="bg-surface border border-border rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl">
                        <div className={`size-16 mx-auto rounded-full flex items-center justify-center mb-4 border ${confirmModal.action === 'ativar' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                            <span className="material-symbols-outlined text-3xl">{confirmModal.action === 'ativar' ? 'check_circle' : 'block'}</span>
                        </div>
                        <h3 className="text-xl font-black text-text-primary mb-2 tracking-tight">{confirmModal.action === 'ativar' ? 'Ativar' : 'Desativar'} Veículo?</h3>
                        <p className="text-text-muted text-sm mb-6">Deseja {confirmModal.action} este veículo no sistema?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 px-4 rounded-xl border border-border text-text-muted font-bold text-[10px] uppercase tracking-widest hover:bg-background transition-colors">Cancelar</button>
                            <button onClick={() => { toggleStatus(confirmModal.id, confirmModal.status === 'ativo' ? 'inativo' : 'ativo'); setConfirmModal(null); }} className={`flex-1 py-3 px-4 rounded-xl text-white font-bold text-[10px] uppercase tracking-widest transition-colors shadow-lg ${confirmModal.action === 'ativar' ? 'bg-green-500 hover:bg-green-600 shadow-green-500/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'}`}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
