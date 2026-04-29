import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
import { maskCPF, maskPhone, formatCPFHidden } from '../utils/masks';

interface Motorista {
    id: string;
    nome: string;
    cpf: string;
    telefone: string;
    cnh: string;
    vinculo: 'propria' | 'terceirizado';
    status: 'ativo' | 'inativo';
    validadeCNH?: string;
    cavaloPlaca?: string;
    bauPlaca?: string;
    criadoEm: any;
    atualizadoEm: any;
}

interface VeiculoRef {
    id: string;
    placa: string;
    tipo: 'cavalo' | 'bau';
}


export default function Motoristas() {
    const location = useLocation();
    // List state
    const [motoristas, setMotoristas] = useState<Motorista[]>([]);
    const [veiculos, setVeiculos] = useState<VeiculoRef[]>([]);
    const [loading, setLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');
    const [filterVinculo, setFilterVinculo] = useState<'todos' | 'propria' | 'terceirizado'>('todos');

    // Form / Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        cpf: '',
        telefone: '',
        cnh: '',
        vinculo: 'propria' as 'propria' | 'terceirizado',
        validadeCNH: '',
        cavaloPlaca: '',
        bauPlaca: ''
    });

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Detail/Confirm Modals state
    const [viewingDriver, setViewingDriver] = useState<Motorista | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ id: string, status: 'ativo' | 'inativo', action: 'ativar' | 'desativar' } | null>(null);
    const [deleteModalId, setDeleteModalId] = useState<string | null>(null);

    // Toast state
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // Real-time listener
    useEffect(() => {
        const q = query(collection(db, 'motoristas'), orderBy('criadoEm', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Motorista));
            setMotoristas(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'veiculos'), orderBy('placa', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                placa: doc.data().placa,
                tipo: doc.data().tipo
            } as VeiculoRef));
            setVeiculos(list);
        });
        return () => unsubscribe();
    }, []);


    useEffect(() => {
        if (location.state && location.state.searchTerm) {
            setSearchTerm(location.state.searchTerm);
            // Limpa o estado para não re-filtrar se o usuário navegar de volta
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    // Toast auto-hide
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
        const expiring = motoristas.filter(m => {
            if (!m.validadeCNH) return false;
            const expiry = new Date(m.validadeCNH);
            const today = new Date();
            const oneMonthFromNow = new Date();
            oneMonthFromNow.setMonth(today.getMonth() + 1);
            return expiry <= oneMonthFromNow && m.status === 'ativo';
        });

        if (expiring.length > 0) {
            const names = expiring.slice(0, 2).map(m => m.nome).join(', ');
            const more = expiring.length > 2 ? ` e mais ${expiring.length - 2}` : '';
            showToast(`Atenção: CNH vencendo/vencida para: ${names}${more}`, 'error');
        }
    };

    useEffect(() => {
        if (motoristas.length > 0 && !loading) {
            checkExpirations();
        }
    }, [loading]);

    const validate = () => {
        const errors: Record<string, string> = {};

        if (formData.nome.trim().length < 3) {
            errors.nome = 'Nome muito curto (mínimo 3 letras)';
        }

        if (formData.cpf.length < 14) {
            errors.cpf = 'CPF incompleto';
        }

        const telNumbers = formData.telefone.replace(/\D/g, '');
        if (telNumbers.length < 10) {
            errors.telefone = 'Telefone incompleto';
        }

        if (formData.cnh.trim().length < 9) {
            errors.cnh = 'CNH inválida (mínimo 9 dígitos)';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleInputChange = (field: string, value: string) => {
        let maskedValue = value;
        if (field === 'cpf') maskedValue = maskCPF(value);
        if (field === 'telefone') maskedValue = maskPhone(value);

        setFormData(prev => ({ ...prev, [field]: maskedValue }));

        // Clear error when user changes field
        if (formErrors[field]) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const openCreateModal = () => {
        setEditingId(null);
        setFormData({
            nome: '',
            cpf: '',
            telefone: '',
            cnh: '',
            vinculo: 'propria',
            validadeCNH: '',
            cavaloPlaca: '',
            bauPlaca: ''
        });
        setFormErrors({});
        setIsFormOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submit clicked. Validating...");

        if (!validate()) {
            console.log("Validation failed", formErrors);
            showToast('Verifique os campos obrigatórios', 'error');
            return;
        }

        setSubmitting(true);
        try {
            if (editingId) {
                console.log("Updating existing driver:", editingId);
                const driverRef = doc(db, 'motoristas', editingId);
                await updateDoc(driverRef, {
                    ...formData,
                    atualizadoEm: serverTimestamp()
                });
                showToast('Motorista atualizado com sucesso!', 'success');
            } else {
                console.log("Adding new driver...");
                await addDoc(collection(db, 'motoristas'), {
                    ...formData,
                    status: 'ativo',
                    criadoEm: serverTimestamp(),
                    atualizadoEm: serverTimestamp()
                });
                showToast('Motorista cadastrado com sucesso!', 'success');
            }
            setIsFormOpen(false);
        } catch (error: any) {
            console.error("Firestore Error:", error);
            showToast(error.message || 'Erro ao salvar no banco de dados', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (driver: Motorista) => {
        setEditingId(driver.id);
        setFormData({
            nome: driver.nome,
            cpf: driver.cpf,
            telefone: driver.telefone,
            cnh: driver.cnh,
            vinculo: driver.vinculo,
            validadeCNH: driver.validadeCNH || '',
            cavaloPlaca: driver.cavaloPlaca || '',
            bauPlaca: driver.bauPlaca || ''
        });
        setFormErrors({});
        setIsFormOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteModalId) return;
        try {
            await deleteDoc(doc(db, 'motoristas', deleteModalId));
            showToast('Motorista excluído permanentemente.', 'success');
        } catch (error) {
            showToast('Erro ao excluir motorista.', 'error');
        } finally {
            setDeleteModalId(null);
        }
    };

    const handleToggleStatus = async () => {
        if (!confirmModal) return;
        try {
            const driverRef = doc(db, 'motoristas', confirmModal.id);
            await updateDoc(driverRef, {
                status: confirmModal.status,
                atualizadoEm: serverTimestamp()
            });
            showToast(`Motorista ${confirmModal.action === 'ativar' ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        } catch (error) {
            showToast('Erro ao atualizar status.', 'error');
        } finally {
            setConfirmModal(null);
        }
    };

    const getInitials = (name: string) => {
        return String(name || '').trim().split(' ').map(n => n?.[0] || '').join('').toUpperCase().substring(0, 2);
    };

    const filteredMotoristas = motoristas.filter(m => {
        const matchesSearch = (m.nome && m.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (m.cpf && m.cpf.includes(searchTerm));
        const matchesStatus = filterStatus === 'todos' || m.status === filterStatus;
        const matchesVinculo = filterVinculo === 'todos' || m.vinculo === filterVinculo;
        return matchesSearch && matchesStatus && matchesVinculo;
    });

    const totalPages = Math.ceil(filteredMotoristas.length / pageSize);
    const paginatedDrivers = filteredMotoristas.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-text-primary tracking-tight text-2xl lg:text-3xl font-bold leading-tight">Gestão de Motoristas</h1>
                    <p className="text-text-muted text-xs lg:text-sm font-normal">Visualize e gerencie todos os motoristas cadastrados na plataforma.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                    <button
                        onClick={openCreateModal}
                        className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-background-dark font-black py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 active:scale-95 text-xs lg:text-sm uppercase tracking-wider"
                    >
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                        Novo Motorista
                    </button>
                </div>
            </div>

            {/* List and Filters Section */}
            <div className="bg-surface/50 rounded-3xl border border-border overflow-hidden backdrop-blur-sm shadow-xl">
                <div className="p-4 lg:p-6 border-b border-border bg-surface/30 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="relative w-full lg:w-96">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary material-symbols-outlined text-[20px]">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por nome, placa ou CPF..."
                            className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-2.5 text-xs lg:text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-all placeholder:text-text-muted"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                        <div className="flex items-center gap-4">
                            <span className="text-[10px] text-text-muted font-black uppercase tracking-widest">Vínculo:</span>
                            <div className="flex bg-background border border-border rounded-xl p-1 h-9 items-center outline-none">
                                <button
                                    onClick={() => setFilterVinculo('todos')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${filterVinculo === 'todos' ? 'bg-primary text-background-dark shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setFilterVinculo('propria')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${filterVinculo === 'propria' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                    Frotas
                                </button>
                                <button
                                    onClick={() => setFilterVinculo('terceirizado')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${filterVinculo === 'terceirizado' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-text-muted hover:text-text-primary'}`}
                                >
                                    Terceiro
                                </button>
                            </div>
                        </div>
                </div>
                {/* Status Tabs */}
                <div className="px-4 lg:px-6 py-4 flex flex-wrap items-center gap-2 border-b border-border bg-surface/10">
                    <button
                        onClick={() => setFilterStatus('todos')}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterStatus === 'todos' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20 scale-105' : 'text-text-muted hover:bg-border/30'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">group</span>
                        Todos
                    </button>
                    <button
                        onClick={() => setFilterStatus('ativo')}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterStatus === 'ativo' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20 scale-105' : 'text-text-muted hover:bg-border/30'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        Ativos
                    </button>
                    <button
                        onClick={() => setFilterStatus('inativo')}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filterStatus === 'inativo' ? 'bg-slate-500 text-white shadow-lg shadow-slate-500/20 scale-105' : 'text-text-muted hover:bg-border/30'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">cancel</span>
                        Inativos
                    </button>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Motorista</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Vínculo</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Veículo Alocado</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Contatos</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-[0.2em] text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 rounded-xl bg-border"></div>
                                                <div className="h-4 w-40 bg-border rounded-lg"></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : filteredMotoristas.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="size-16 bg-primary/5 rounded-full flex items-center justify-center text-primary/20 mb-4 border border-primary/10">
                                                <span className="material-symbols-outlined text-[36px]">no_accounts</span>
                                            </div>
                                            <p className="text-text-secondary font-bold text-sm uppercase tracking-widest text-[10px]">Nenhum registro encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedDrivers.map((driver) => (
                                    <tr
                                        key={driver.id}
                                        onClick={() => handleEdit(driver)}
                                        className="hover:bg-primary/5 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 rounded-xl bg-background border border-border flex items-center justify-center text-primary font-black text-sm group-hover:border-primary/50 transition-colors shrink-0">
                                                    {getInitials(driver.nome)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-text-primary font-black text-xs lg:text-sm truncate max-w-[200px]">{driver.nome}</p>
                                                    <p className="text-[10px] text-text-muted font-bold tracking-tight uppercase">{formatCPFHidden(driver.cpf)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight border ${driver.vinculo === 'propria' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                <div className={`size-1.5 rounded-full ${driver.vinculo === 'propria' ? 'bg-primary' : 'bg-blue-400'}`}></div>
                                                {driver.vinculo}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-text-primary">
                                                    <span className="material-symbols-outlined text-[14px] text-primary">local_shipping</span>
                                                    <span className="text-[11px] font-black uppercase tracking-widest">{driver.cavaloPlaca || '---'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-text-muted">
                                                    <span className="material-symbols-outlined text-[14px]">rv_hookup</span>
                                                    <span className="text-[10px] font-bold uppercase">{driver.bauPlaca || '---'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2 text-text-secondary">
                                                    <span className="material-symbols-outlined text-[14px]">call</span>
                                                    <span className="text-[11px] font-bold">{driver.telefone}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-text-muted">
                                                    <span className="material-symbols-outlined text-[14px]">badge</span>
                                                    <span className="text-[10px] font-medium tracking-tight">CNH: {driver.cnh}</span>
                                                    {driver.validadeCNH && (
                                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border ${
                                                            new Date(driver.validadeCNH) < new Date() 
                                                            ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                                                            : new Date(driver.validadeCNH) <= new Date(new Date().setMonth(new Date().getMonth() + 1))
                                                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                            : 'bg-green-500/10 text-green-500 border-green-500/20'
                                                        }`}>
                                                            {new Date(driver.validadeCNH) <= new Date(new Date().setMonth(new Date().getMonth() + 1)) && (
                                                                <span className="material-symbols-outlined text-[10px] mr-1">warning</span>
                                                            )}
                                                            {new Date(driver.validadeCNH) < new Date() ? 'Vencida ' : 'Vence '}
                                                            {new Date(driver.validadeCNH).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConfirmModal({
                                                        id: driver.id,
                                                        status: driver.status === 'ativo' ? 'inativo' : 'ativo',
                                                        action: driver.status === 'ativo' ? 'desativar' : 'ativar'
                                                    });
                                                }}
                                                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${driver.status === 'ativo'
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white'
                                                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500 hover:text-white'
                                                    }`}
                                            >
                                                {driver.status}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-1.5 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEdit(driver);
                                                    }}
                                                    className="size-8 rounded-lg bg-background border border-border flex items-center justify-center text-text-muted hover:text-primary transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteModalId(driver.id);
                                                    }}
                                                    className="size-8 rounded-lg bg-background border border-border flex items-center justify-center text-text-muted hover:text-red-500 transition-all"
                                                >
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

                {/* Pagination Footer */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-border bg-background-dark/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                            Mostrando {paginatedDrivers.length} de {filteredMotoristas.length} motoristas
                        </p>
                        <div className="flex gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="size-9 flex items-center justify-center rounded-xl border border-border text-text-muted hover:bg-surface transition-all disabled:opacity-30"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                            </button>
                            <div className="flex gap-1">
                                {[...Array(totalPages)].map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentPage(i + 1)}
                                        className={`size-9 flex items-center justify-center rounded-xl font-black text-xs transition-all ${currentPage === i + 1
                                            ? 'bg-primary text-background-dark shadow-md'
                                            : 'text-text-muted hover:bg-surface border border-transparent hover:border-border'
                                            }`}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="size-9 flex items-center justify-center rounded-xl border border-border text-text-muted hover:bg-surface transition-all disabled:opacity-30"
                            >
                                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* FORM POPUP (Add / Edit) - FIXED VALIDATION ERRORS */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => !submitting && setIsFormOpen(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="p-6 lg:p-8 border-b border-border flex justify-between items-center bg-primary/5">
                            <div className="flex items-center gap-4">
                                <div className="size-10 lg:size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                    <span className="material-symbols-outlined text-[24px] lg:text-[28px]">
                                        {editingId ? 'edit_note' : 'person_add'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg lg:text-xl font-black text-text-primary tracking-tight leading-tight">
                                        {editingId ? 'Editar Motorista' : 'Novo Cadastro'}
                                    </h3>
                                    <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] mt-0.5">Gerenciamento de Frota</p>
                                </div>
                            </div>
                            <button onClick={() => !submitting && setIsFormOpen(false)} className="size-10 rounded-full hover:bg-border/30 flex items-center justify-center text-text-muted transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 lg:gap-x-8 gap-y-4 lg:gap-y-6">
                                <label className="flex flex-col md:col-span-2">
                                    <span className="text-text-secondary text-[11px] font-black uppercase tracking-widest mb-2 ml-1">Nome Completo</span>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary material-symbols-outlined text-[20px]">person</span>
                                        <input
                                            className={`w-full bg-background border ${formErrors.nome ? 'border-red-500' : 'border-border'} rounded-2xl pl-12 pr-4 py-3 text-xs lg:text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-all`}
                                            placeholder="Ex: Pedro Henrique Silva"
                                            value={formData.nome}
                                            onChange={(e) => handleInputChange('nome', e.target.value)}
                                            disabled={submitting}
                                        />
                                    </div>
                                    {formErrors.nome && <span className="text-red-500 text-[10px] mt-1 ml-1 font-bold italic">{formErrors.nome}</span>}
                                </label>

                                <label className="flex flex-col">
                                    <span className="text-text-secondary text-[11px] font-black uppercase tracking-widest mb-2 ml-1">CPF</span>
                                    <input
                                        className={`w-full bg-background border ${formErrors.cpf ? 'border-red-500' : 'border-border'} rounded-2xl px-5 py-3 text-xs lg:text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-all`}
                                        placeholder="000.000.000-00"
                                        value={formData.cpf}
                                        onChange={(e) => handleInputChange('cpf', e.target.value)}
                                        disabled={submitting}
                                    />
                                    {formErrors.cpf && <span className="text-red-500 text-[10px] mt-1 ml-1 font-bold italic">{formErrors.cpf}</span>}
                                </label>

                                <label className="flex flex-col">
                                    <span className="text-text-secondary text-[11px] font-black uppercase tracking-widest mb-2 ml-1">Telefone</span>
                                    <input
                                        className={`w-full bg-background border ${formErrors.telefone ? 'border-red-500' : 'border-border'} rounded-2xl px-5 py-3 text-xs lg:text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-all`}
                                        placeholder="(00) 00000-0000"
                                        value={formData.telefone}
                                        onChange={(e) => handleInputChange('telefone', e.target.value)}
                                        disabled={submitting}
                                    />
                                    {formErrors.telefone && <span className="text-red-500 text-[10px] mt-1 ml-1 font-bold italic">{formErrors.telefone}</span>}
                                </label>

                                <label className="flex flex-col">
                                    <span className="text-text-secondary text-[11px] font-black uppercase tracking-widest mb-2 ml-1">CNH</span>
                                    <input
                                        className={`w-full bg-background border ${formErrors.cnh ? 'border-red-500' : 'border-border'} rounded-2xl px-5 py-3 text-xs lg:text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-all`}
                                        placeholder="Nº Registro"
                                        value={formData.cnh}
                                        onChange={(e) => handleInputChange('cnh', e.target.value)}
                                        disabled={submitting}
                                    />
                                    {formErrors.cnh && <span className="text-red-500 text-[10px] mt-1 ml-1 font-bold italic">{formErrors.cnh}</span>}
                                </label>

                                <label className="flex flex-col">
                                    <span className="text-text-secondary text-[11px] font-black uppercase tracking-widest mb-2 ml-1">Validade CNH</span>
                                    <input
                                        type="date"
                                        className="w-full bg-background border border-border rounded-2xl px-5 py-3 text-xs lg:text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-all"
                                        value={formData.validadeCNH}
                                        onChange={(e) => handleInputChange('validadeCNH', e.target.value)}
                                        disabled={submitting}
                                    />
                                </label>


                                <div className="flex flex-col">
                                    <span className="text-text-secondary text-[11px] font-black uppercase tracking-widest mb-2 ml-1">Vínculo</span>
                                    <div className="flex gap-2 h-[44px]">
                                        <button
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => handleInputChange('vinculo', 'propria')}
                                            className={`flex-1 rounded-2xl border font-black text-[10px] uppercase tracking-tighter transition-all ${formData.vinculo === 'propria' ? 'bg-primary/20 border-primary text-primary' : 'bg-background border-border text-text-muted'}`}
                                        >
                                            Frota
                                        </button>
                                        <button
                                            type="button"
                                            disabled={submitting}
                                            onClick={() => handleInputChange('vinculo', 'terceirizado')}
                                            className={`flex-1 rounded-2xl border font-black text-[10px] uppercase tracking-tighter transition-all ${formData.vinculo === 'terceirizado' ? 'bg-primary/20 border-primary text-primary' : 'bg-background border-border text-text-muted'}`}
                                        >
                                            Terceiro
                                        </button>
                                    </div>
                                </div>

                                <div className="md:col-span-2 h-px bg-border my-2"></div>

                                <label className="flex flex-col">
                                    <span className="text-text-secondary text-[11px] font-black uppercase tracking-widest mb-2 ml-1">Cavalo (Trator)</span>
                                    <select 
                                        className="w-full bg-background border border-border rounded-2xl px-5 py-3 text-xs lg:text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                                        value={formData.cavaloPlaca}
                                        onChange={(e) => setFormData({...formData, cavaloPlaca: e.target.value})}
                                        disabled={submitting}
                                    >
                                        <option value="">Selecione o veículo...</option>
                                        {veiculos.filter(v => v.tipo === 'cavalo').map(v => (
                                            <option key={v.id} value={v.placa}>{v.placa}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="flex flex-col">
                                    <span className="text-text-secondary text-[11px] font-black uppercase tracking-widest mb-2 ml-1">Baú / Implemento</span>
                                    <select 
                                        className="w-full bg-background border border-border rounded-2xl px-5 py-3 text-xs lg:text-sm text-text-primary focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                                        value={formData.bauPlaca}
                                        onChange={(e) => setFormData({...formData, bauPlaca: e.target.value})}
                                        disabled={submitting}
                                    >
                                        <option value="">Selecione o implemento...</option>
                                        {veiculos.filter(v => v.tipo === 'bau').map(v => (
                                            <option key={v.id} value={v.placa}>{v.placa}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="mt-8 lg:mt-10 flex flex-col sm:flex-row gap-3">
                                <button
                                    type="button"
                                    onClick={() => !submitting && setIsFormOpen(false)}
                                    className="flex-1 py-3.5 bg-background border border-border text-text-muted font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-border/20 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-[2] py-3.5 bg-primary text-background-dark font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
                                            Processando...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[18px]">{editingId ? 'check_circle' : 'save'}</span>
                                            {editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* VIEW DETAILS POPUP */}
            {viewingDriver && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setViewingDriver(null)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-300 flex flex-col">
                        <div className="bg-primary/20 p-8 border-b border-primary/10 flex justify-between items-center relative overflow-hidden">
                            <h3 className="text-xl font-black text-text-primary flex items-center gap-3 relative z-10">
                                <span className="material-symbols-outlined text-primary text-[32px]">manage_accounts</span>
                                Detalhes do Motorista
                            </h3>
                            <button onClick={() => setViewingDriver(null)} className="text-text-muted hover:text-primary transition-all p-1 relative z-10">
                                <span className="material-symbols-outlined text-[28px]">close</span>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex items-center gap-6 bg-background/50 p-5 rounded-3xl border border-border shadow-inner">
                                <div className="size-20 rounded-[22px] bg-primary/10 flex items-center justify-center text-primary font-black text-3xl border border-primary/20 shadow-lg shrink-0">
                                    {getInitials(viewingDriver.nome)}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-xl font-bold text-text-primary mb-1 truncate">{viewingDriver.nome}</h4>
                                    <div className="flex gap-2">
                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${viewingDriver.status === 'ativo' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                            {viewingDriver.status}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-primary/10 text-primary border-primary/20">
                                            {viewingDriver.vinculo}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 lg:gap-6">
                                <DetailItem label="CPF" value={viewingDriver.cpf} icon="fingerprint" />
                                <DetailItem label="CNH" value={viewingDriver.cnh} icon="badge" />
                                <DetailItem label="Telefone" value={viewingDriver.telefone} icon="call" />
                                <DetailItem label="Validade CNH" value={viewingDriver.validadeCNH ? new Date(viewingDriver.validadeCNH).toLocaleDateString('pt-BR') : '---'} icon="calendar_today" />
                                <DetailItem label="Cavalo" value={viewingDriver.cavaloPlaca || 'Não alocado'} icon="local_shipping" />
                                <DetailItem label="Baú" value={viewingDriver.bauPlaca || 'Não alocado'} icon="rv_hookup" />
                            </div>
                        </div>
                        <div className="p-8 bg-surface border-t border-border flex gap-3">
                            <button
                                onClick={() => { setViewingDriver(null); handleEdit(viewingDriver); }}
                                className="flex-1 py-3 text-primary border border-primary/20 font-black rounded-2xl hover:bg-primary/20 transition-all text-[10px] uppercase tracking-widest"
                            >
                                Editar Registro
                            </button>
                            <button
                                onClick={() => setViewingDriver(null)}
                                className="flex-1 py-3 bg-primary text-background-dark font-black rounded-2xl hover:bg-primary/90 transition-all shadow-lg text-[10px] uppercase tracking-widest"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {deleteModalId && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/95 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDeleteModalId(null)}></div>
                    <div className="bg-surface border border-red-500/20 w-full max-w-sm rounded-[40px] shadow-2xl p-8 relative z-10 animate-in zoom-in-110 duration-200">
                        <div className="flex flex-col items-center text-center gap-6">
                            <div className="size-20 rounded-full bg-red-500/10 text-red-500 shadow-xl flex items-center justify-center animate-bounce">
                                <span className="material-symbols-outlined text-[48px]">delete_forever</span>
                            </div>
                            <h2 className="text-2xl font-black text-text-primary tracking-tight">Excluir Motorista?</h2>
                            <p className="text-text-muted text-xs font-bold uppercase tracking-widest text-center">Ação irreversível no banco de dados.</p>
                        </div>
                        <div className="flex flex-col gap-3 mt-10">
                            <button onClick={handleDelete} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-[24px] shadow-xl text-xs uppercase tracking-widest">Apagar Agora</button>
                            <button onClick={() => setDeleteModalId(null)} className="w-full py-3 text-text-muted font-bold text-xs uppercase tracking-widest">Manter Registro</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM STATUS TOGGLE */}
            {confirmModal && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setConfirmModal(null)}></div>
                    <div className="bg-surface border border-border w-full max-w-sm rounded-[40px] shadow-2xl p-10 relative z-10 animate-in zoom-in-110 duration-200">
                        <div className="flex flex-col items-center text-center gap-6">
                            <div className={`size-20 rounded-full flex items-center justify-center shadow-xl ${confirmModal.action === 'desativar' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}`}>
                                <span className="material-symbols-outlined text-[48px]">
                                    {confirmModal.action === 'desativar' ? 'block' : 'check_circle'}
                                </span>
                            </div>
                            <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Alterar Status?</h3>
                            <p className="text-text-muted text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
                                Você deseja marcar este motorista como <span className="text-text-primary underline">{confirmModal.status}</span>?
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 mt-10">
                            <button onClick={handleToggleStatus} className={`w-full py-4 text-white font-black rounded-[24px] shadow-xl text-xs uppercase tracking-widest ${confirmModal.action === 'desativar' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}>Confirmar Mudança</button>
                            <button onClick={() => setConfirmModal(null)} className="w-full py-3 text-text-muted font-bold text-xs uppercase tracking-widest">Voltar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 duration-300">
                    <div className={`flex items-center gap-3 px-6 py-3.5 rounded-full shadow-2xl border backdrop-blur-md ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                        <span className="material-symbols-outlined text-[18px]">
                            {toast.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <span className="font-black text-[10px] lg:text-xs uppercase tracking-widest">{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailItem({ label, value, icon, primary = false }: { label: string, value: string, icon: string, primary?: boolean }) {
    return (
        <div className="space-y-1 min-w-0">
            <span className="text-[9px] text-text-muted uppercase font-black tracking-widest block">{label}</span>
            <div className={`flex items-center gap-2 font-bold text-sm ${primary ? 'text-primary' : 'text-text-primary'}`}>
                <span className="material-symbols-outlined text-[16px] shrink-0">{icon}</span>
                <span className="truncate">{value}</span>
            </div>
        </div>
    );
}
