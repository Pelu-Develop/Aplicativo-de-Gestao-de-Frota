import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    updateDoc,
    doc,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import PrintLogo from '../assets/logo-pdf.png';

interface Motorista {
    id: string;
    nome: string;
    cpf: string;
    vinculo: string;
    placaCavalo: string;
    placaCarreta?: string;
}

interface ItemDespesa {
    categoria: string;
    valor: number;
    descricao: string;
    data?: string;
}

interface Despesa {
    id: string;
    motoristaNome: string;
    motoristaId?: string;
    motoristaCPF?: string;
    placaCavalo: string;
    placaBau: string;
    viagensIds?: string[];
    dataInicio: string;
    dataFim: string;
    diasDiaria: number;
    valorDiaria: number;
    totalDiarias: number;
    comissaoCombustivel: number;
    adiantamento: number;
    items: ItemDespesa[];
    valorTotal: number;
    saldoFinal: number;
    status?: 'pendente' | 'finalizado';
    dataRegistro: any;
}

const CATEGORIAS = ['Combustível', 'Peças', 'Serviços', 'Lavagem', 'Descarga', 'Estacionamento', 'Transporte', 'Borracharia', 'Outros'];

export default function Despesas() {
    const [despesas, setDespesas] = useState<Despesa[]>([]);
    const [motoristasProprios, setMotoristasProprios] = useState<Motorista[]>([]);
    const [todasViagens, setTodasViagens] = useState<any[]>([]);
    const [idParaVincular, setIdParaVincular] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();

    // Form / Edit state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        motoristaNome: '',
        motoristaCPF: '',
        placaCavalo: '',
        placaBau: '',
        viagensIds: [] as string[],
        dataInicio: '',
        dataFim: '',
        valorDiaria: 110,
        comissaoCombustivel: 0,
        adiantamento: 0,
        items: [] as ItemDespesa[],
        status: 'pendente' as 'pendente' | 'finalizado'
    });

    const [printingDespesa, setPrintingDespesa] = useState<Despesa | null>(null);

    const [newItem, setNewItem] = useState({ categoria: '', valor: '', descricao: '', data: '' });

    // Filters state
    const [filters, setFilters] = useState({
        nome: '',
        placa: '',
        dataInicio: '',
        dataFim: '',
        viagemId: ''
    });

    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [globalValorDiaria, setGlobalValorDiaria] = useState<number>(110);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newGlobalRate, setNewGlobalRate] = useState<string>('110');

    // Fetch Motoristas
    useEffect(() => {
        const q = query(collection(db, 'motoristas'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Motorista));
            setMotoristasProprios(list);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Despesas
    useEffect(() => {
        const q = query(collection(db, 'despesas_frota'), orderBy('dataRegistro', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Despesa));
            setDespesas(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Global Config
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'config', 'diaria'), (snapshot) => {
            if (snapshot.exists() && snapshot.data().valor !== undefined) {
                const value = Number(snapshot.data().valor) || 110;
                setGlobalValorDiaria(value);
                setNewGlobalRate(value.toString());
                // Update formData if creating new
                if (!editingId) {
                    setFormData(prev => ({ ...prev, valorDiaria: value }));
                }
            }
        });
        return () => unsubscribe();
    }, [editingId]);

    // Fetch Todas as Viagens para vínculo simples
    useEffect(() => {
        const q = query(collection(db, 'cargas'), orderBy('dataSaida', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                codigoViagem: doc.data().codigoViagem,
                origem: doc.data().origem,
                destino: doc.data().destino,
                dataSaida: doc.data().dataSaida,
                motoristaNome: doc.data().motoristaNome,
                cliente: doc.data().cliente,
                dataCarregamento: doc.data().dataCarregamento,
                dataPrevistaDescarregamento: doc.data().dataPrevistaDescarregamento
            } as any));
            setTodasViagens(list);
        });
        return () => unsubscribe();
    }, []);

    // Effect to handle query params (new action or filter by name)
    useEffect(() => {
        const action = searchParams.get('action');
        const nomeParam = searchParams.get('nome');

        if (action === 'new' && !loading) {
            openCreateModal();
            setSearchParams({}, { replace: true });
        } else if (nomeParam && !loading) {
            setFilters(prev => ({ ...prev, nome: nomeParam }));
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, loading]);

    const handleMotoristaChange = (nome: string) => {
        const motorista = motoristasProprios.find(m => m.nome === nome);
        if (motorista) {
            setFormData({
                ...formData,
                motoristaNome: nome,
                motoristaCPF: motorista.cpf || '',
                placaCavalo: motorista.placaCavalo || '',
                placaBau: motorista.placaCarreta || '',
                viagensIds: [] // Limpa ao trocar motorista
            });
        } else {
            setFormData({ ...formData, motoristaNome: nome, motoristaCPF: '', viagensIds: [] });
        }
    };

    const toggleViagem = (viagemId: string) => {
        const current = formData.viagensIds || [];
        if (current.includes(viagemId)) {
            setFormData({ ...formData, viagensIds: current.filter(id => id !== viagemId) });
        } else {
            setFormData({ ...formData, viagensIds: [...current, viagemId] });
        }
    };

    const calculateDiarias = () => {
        if (!formData.dataInicio || !formData.dataFim) return 0;
        const start = new Date(formData.dataInicio);
        const end = new Date(formData.dataFim);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    };

    const addItem = () => {
        if (!newItem.categoria || !newItem.valor) {
            showToast('Preencha categoria e valor do item', 'error');
            return;
        }
        setFormData({
            ...formData,
            items: [...formData.items, {
                categoria: newItem.categoria,
                valor: parseFloat(newItem.valor),
                descricao: newItem.descricao,
                data: newItem.data || new Date().toISOString().split('T')[0]
            }]
        });
        setNewItem({ categoria: '', valor: '', descricao: '', data: '' });
    };

    const removeItem = (index: number) => {
        const updated = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: updated });
    };

    const editItem = (index: number) => {
        const itemToEdit = formData.items[index];
        setNewItem({
            categoria: itemToEdit.categoria,
            valor: itemToEdit.valor.toString(),
            descricao: itemToEdit.descricao || '',
            data: itemToEdit.data || ''
        });
        removeItem(index);
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openCreateModal = () => {
        setEditingId(null);
        setFormData({
            motoristaNome: '',
            motoristaCPF: '',
            placaCavalo: '',
            placaBau: '',
            viagensIds: [],
            dataInicio: new Date().toISOString().split('T')[0],
            dataFim: new Date().toISOString().split('T')[0],
            valorDiaria: globalValorDiaria,
            comissaoCombustivel: 0,
            adiantamento: 0,
            items: [],
            status: 'pendente'
        });
        setIsFormOpen(true);
    };

    const handleEdit = (despesa: Despesa) => {
        setEditingId(despesa.id);
        setFormData({
            motoristaNome: despesa.motoristaNome,
            motoristaCPF: despesa.motoristaCPF || '',
            placaCavalo: despesa.placaCavalo || '',
            placaBau: despesa.placaBau || '',
            viagensIds: despesa.viagensIds || [],
            dataInicio: despesa.dataInicio || '',
            dataFim: despesa.dataFim || '',
            valorDiaria: despesa.valorDiaria || 110,
            comissaoCombustivel: despesa.comissaoCombustivel || 0,
            adiantamento: despesa.adiantamento || 0,
            items: despesa.items || [],
            status: despesa.status || 'pendente'
        });
        setIsFormOpen(true);
    };

    const handleToggleStatus = async (e: React.MouseEvent, despesa: Despesa) => {
        e.stopPropagation();
        const newStatus = despesa.status === 'finalizado' ? 'pendente' : 'finalizado';
        try {
            await updateDoc(doc(db, 'despesas_frota', despesa.id), {
                status: newStatus,
                dataAtualizacao: serverTimestamp()
            });
            showToast(`Acerto ${newStatus === 'finalizado' ? 'finalizado' : 'reaberto'} com sucesso!`, 'success');
        } catch (error) {
            console.error(error);
            showToast('Erro ao alterar status', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const dias = calculateDiarias();
        const totalDiarias = dias * formData.valorDiaria;
        const totalItems = formData.items.reduce((acc, curr) => acc + curr.valor, 0);
        const valorTotal = totalDiarias + totalItems + (formData.comissaoCombustivel || 0);
        const saldoFinal = valorTotal - (formData.adiantamento || 0);

        if (!formData.motoristaNome) {
            showToast('Selecione um motorista', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const motorista = motoristasProprios.find(m => m.nome === formData.motoristaNome);

            const payload = {
                motoristaNome: formData.motoristaNome,
                motoristaId: motorista?.id || null,
                motoristaCPF: formData.motoristaCPF || motorista?.cpf || '',
                placaCavalo: formData.placaCavalo,
                placaBau: formData.placaBau,
                viagensIds: formData.viagensIds || [],
                dataInicio: formData.dataInicio,
                dataFim: formData.dataFim,
                diasDiaria: dias,
                valorDiaria: formData.valorDiaria,
                totalDiarias: totalDiarias,
                comissaoCombustivel: formData.comissaoCombustivel,
                adiantamento: formData.adiantamento || 0,
                items: formData.items,
                valorTotal: valorTotal,
                saldoFinal: saldoFinal,
                status: formData.status || 'pendente',
                dataRegistro: editingId ? (despesas.find(d => d.id === editingId)?.dataRegistro || serverTimestamp()) : serverTimestamp()
            };

            if (editingId) {
                await updateDoc(doc(db, 'despesas_frota', editingId), {
                    ...payload,
                    dataAtualizacao: serverTimestamp()
                });
                showToast('Acerto atualizado com sucesso!', 'success');
            } else {
                await addDoc(collection(db, 'despesas_frota'), payload);
                showToast('Acerto registrado com sucesso!', 'success');
            }

            setIsFormOpen(false);
            setFormData({ motoristaNome: '', motoristaCPF: '', placaCavalo: '', placaBau: '', viagensIds: [], dataInicio: '', dataFim: '', valorDiaria: 110, comissaoCombustivel: 0, adiantamento: 0, items: [], status: 'pendente' });
        } catch (error) {
            console.error(error);
            showToast('Erro ao salvar acerto', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        setSubmitting(true);
        try {
            await deleteDoc(doc(db, 'despesas_frota', deletingId));
            showToast('Acerto excluído com sucesso!', 'success');
            setDeletingId(null);
        } catch (error) {
            console.error(error);
            showToast('Erro ao excluir acerto', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateGlobalRate = async () => {
        const val = parseFloat(newGlobalRate);
        if (isNaN(val)) return;
        try {
            await updateDoc(doc(db, 'config', 'diaria'), { valor: val });
            setIsSettingsOpen(false);
            showToast('Valor da diária atualizado globalmente', 'success');
        } catch (error) {
            // Se o documento não existir, tenta criar
            try {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(doc(db, 'config', 'diaria'), { valor: val });
                setIsSettingsOpen(false);
                showToast('Valor da diária definido globalmente', 'success');
            } catch (e) {
                console.error(e);
                showToast('Erro ao atualizar valor da diária', 'error');
            }
        }
    };

    const filteredDespesas = despesas.filter(d => {
        const matchNome = !filters.nome || (d.motoristaNome && d.motoristaNome.toLowerCase().includes(filters.nome.toLowerCase()));
        const matchPlaca = !filters.placa ||
            (d.placaCavalo && d.placaCavalo.toLowerCase().includes(filters.placa.toLowerCase())) ||
            (d.placaBau && d.placaBau.toLowerCase().includes(filters.placa.toLowerCase()));

        let matchPeriodo = true;
        const dInicio = d.dataInicio ? new Date(d.dataInicio.includes('T') ? d.dataInicio : d.dataInicio + 'T12:00:00') : null;
        const dFim = d.dataFim ? new Date(d.dataFim.includes('T') ? d.dataFim : d.dataFim + 'T12:00:00') : null;

        if (filters.dataInicio) {
            const fInicio = new Date(filters.dataInicio.includes('T') ? filters.dataInicio : filters.dataInicio + 'T12:00:00');
            if (dInicio && dInicio < fInicio) matchPeriodo = false;
        }
        if (filters.dataFim) {
            const fFim = new Date(filters.dataFim.includes('T') ? filters.dataFim : filters.dataFim + 'T12:00:00');
            if (dFim && dFim > fFim) matchPeriodo = false;
        }

        const matchViagem = !filters.viagemId || (Array.isArray(d.viagensIds) && d.viagensIds.some(id => id && String(id).toLowerCase().includes(filters.viagemId.toLowerCase())));

        return matchNome && matchPlaca && matchPeriodo && matchViagem;
    });

    // Autocomplete Suggestions
    const sugestoesMotoristas = Array.from(new Set(motoristasProprios.map(m => m.nome))).sort();
    const sugestoesPlacas = Array.from(new Set([
        ...despesas.map(d => d.placaCavalo),
        ...despesas.map(d => d.placaBau)
    ])).filter(Boolean).sort();
    const sugestoesViagens = Array.from(new Set(despesas.flatMap(d => d.viagensIds || []))).sort();

    return (
        <div className="space-y-6 text-text-primary">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Acerto de Viagem</h1>
                    <p className="text-text-muted text-sm">Controle financeiro detalhado por veículo e motorista.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="bg-surface border border-border text-text-muted hover:border-primary hover:text-primary p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center h-[42px] w-[42px]"
                        title="Configurações Globais"
                    >
                        <span className="material-symbols-outlined text-xl">settings</span>
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="bg-primary hover:bg-primary/90 text-background-dark font-black h-[42px] px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 uppercase text-xs"
                    >
                        <span className="material-symbols-outlined text-xl">add_card</span>
                        Novo Lançamento
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 bg-surface border border-border p-4 rounded-[24px] shadow-sm">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-text-muted ml-1">Motorista</span>
                    <input
                        type="text"
                        placeholder="Nome..."
                        list="sugestoes-motoristas"
                        className="bg-background border border-border rounded-xl px-3 h-[34px] text-xs focus:border-primary/50 outline-none w-full"
                        value={filters.nome}
                        onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
                    />
                    <datalist id="sugestoes-motoristas">
                        {sugestoesMotoristas.map(nome => <option key={nome} value={nome} />)}
                    </datalist>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-text-muted ml-1">Placa</span>
                    <input
                        type="text"
                        placeholder="ABC-1234"
                        list="sugestoes-placas"
                        className="bg-background border border-border rounded-xl px-3 h-[34px] text-xs focus:border-primary/50 outline-none w-full"
                        value={filters.placa}
                        onChange={(e) => setFilters({ ...filters, placa: e.target.value })}
                    />
                    <datalist id="sugestoes-placas">
                        {sugestoesPlacas.map(placa => <option key={placa} value={placa} />)}
                    </datalist>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-text-muted ml-1">ID Viagem</span>
                    <input
                        type="text"
                        placeholder="Busca ID..."
                        list="sugestoes-viagens"
                        className="bg-background border border-border rounded-xl px-3 h-[34px] text-xs focus:border-primary/50 outline-none w-full"
                        value={filters.viagemId}
                        onChange={(e) => setFilters({ ...filters, viagemId: e.target.value })}
                    />
                    <datalist id="sugestoes-viagens">
                        {sugestoesViagens.map(id => <option key={id} value={id} />)}
                    </datalist>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-text-muted ml-1">Início (Acerto)</span>
                    <input
                        type="date"
                        className="bg-background border border-border rounded-xl px-3 h-[34px] text-xs outline-none w-full"
                        value={filters.dataInicio}
                        onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                        onClick={(e) => (e.target as any).showPicker?.()}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-text-muted ml-1">Fim (Acerto)</span>
                    <input
                        type="date"
                        className="bg-background border border-border rounded-xl px-3 h-[34px] text-xs outline-none w-full"
                        value={filters.dataFim}
                        onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                        onClick={(e) => (e.target as any).showPicker?.()}
                    />
                </div>
                <div className="flex items-end flex-1 min-w-[100px]">
                    <button
                        onClick={() => setFilters({ nome: '', placa: '', dataInicio: '', dataFim: '', viagemId: '' })}
                        className="w-full h-[34px] bg-background-dark border border-border text-text-muted hover:text-primary hover:border-primary/50 rounded-xl flex items-center justify-center gap-2 transition-colors text-[10px] font-black uppercase tracking-widest"
                    >
                        <span className="material-symbols-outlined text-sm">filter_list_off</span>
                        Limpar
                    </button>
                </div>
            </div>

            <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Veículo / Motorista</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Período / Viagens</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Dias</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Viagens (IDs)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Total Despesa</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Adiantamento</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Saldo Final</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr><td colSpan={9} className="p-20 text-center text-text-muted uppercase text-[10px] font-black tracking-widest">Carregando dados...</td></tr>
                            ) : filteredDespesas.length === 0 ? (
                                <tr><td colSpan={9} className="p-20 text-center text-text-muted">Nenhum acerto encontrado com os filtros aplicados.</td></tr>
                            ) : (
                                filteredDespesas.map((d) => (
                                    <tr
                                        key={d.id}
                                        onClick={() => handleEdit(d)}
                                        className="hover:bg-primary/5 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
                                                        {d.placaCavalo || 'S/P'}
                                                    </span>
                                                    <span className="text-text-primary font-bold text-sm">{d.motoristaNome}</span>
                                                </div>
                                                <span className="text-[10px] text-text-muted uppercase font-bold">{d.placaBau || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium">
                                                    {d.dataInicio ? `${new Date(d.dataInicio.includes('T') ? d.dataInicio : d.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} → ${new Date(d.dataFim.includes('T') ? d.dataFim : d.dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}` : '---'}
                                                </span>
                                                {d.viagensIds && d.viagensIds.length > 0 && (
                                                    <span className="text-[9px] text-primary font-black uppercase tracking-widest">
                                                        {d.viagensIds.length} viagem(ns) vinculada(s)
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-background-dark border border-border px-2 py-1 rounded-lg text-xs font-bold">
                                                {d.diasDiaria || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[250px]">
                                                {d.viagensIds && d.viagensIds.length > 0 ? (
                                                    d.viagensIds.map((id, idx) => (
                                                        <span key={idx} className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter">
                                                            #{id.substring(0, 6)}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-text-muted">---</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-xs font-bold text-primary">R$ {d.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-xs font-bold text-blue-500">R$ {d.adiantamento?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`text-base font-black ${d.saldoFinal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                R$ {d.saldoFinal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${d.status === 'finalizado' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                                                {d.status || 'pendente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                <button
                                                    onClick={(e) => handleToggleStatus(e, d)}
                                                    className={`size-10 rounded-xl bg-background border flex items-center justify-center transition-all ${d.status === 'finalizado' ? 'text-orange-500 border-orange-500/30 hover:bg-orange-500/10' : 'text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10'}`}
                                                    title={d.status === 'finalizado' ? 'Reabrir Acerto' : 'Finalizar Acerto'}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">{d.status === 'finalizado' ? 'lock_open' : 'lock'}</span>
                                                </button>
                                                {d.status === 'finalizado' && <span className="material-symbols-outlined text-[14px] text-green-500/50">lock</span>}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setPrintingDespesa(d); }}
                                                    className="size-10 rounded-xl bg-background border border-border flex items-center justify-center text-text-muted hover:text-emerald-500 hover:border-emerald-500/30 transition-all font-black"
                                                    title="Imprimir"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">print</span>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(d); }}
                                                    className="size-10 rounded-xl bg-background border border-border flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/30 transition-all disabled:opacity-30"
                                                    disabled={d.status === 'finalizado'}
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeletingId(d.id); }}
                                                    className="size-10 rounded-xl bg-background border border-border flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-500/30 transition-all disabled:opacity-30"
                                                    disabled={d.status === 'finalizado'}
                                                    title="Excluir"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
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

            {/* Modal Form */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => !submitting && setIsFormOpen(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-3xl rounded-[32px] shadow-2xl relative z-10 p-8 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined">{editingId ? 'edit_document' : 'add_card'}</span>
                                </div>
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tighter">
                                    {editingId ? 'Editar Acerto' : 'Novo Acerto de Viagem'}
                                </h3>
                            </div>
                            <button type="button" onClick={() => !submitting && setIsFormOpen(false)} className="text-text-muted hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar scroll-smooth">
                            {/* Motorista e Veículo */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Motorista</span>
                                    <select
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-primary/50"
                                        value={formData.motoristaNome}
                                        onChange={(e) => handleMotoristaChange(e.target.value)}
                                        required
                                        disabled={submitting || formData.status === 'finalizado'}
                                    >
                                        <option value="">Selecione o motorista</option>
                                        {motoristasProprios.map(m => (
                                            <option key={m.id} value={m.nome}>{m.nome}</option>
                                        ))}
                                    </select>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Placa Cavalo</span>
                                        <input
                                            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm font-black text-primary uppercase tracking-widest focus:outline-none disabled:opacity-50"
                                            placeholder="ABC-1234"
                                            value={formData.placaCavalo}
                                            onChange={(e) => setFormData({ ...formData, placaCavalo: e.target.value.toUpperCase() })}
                                            disabled={submitting || formData.status === 'finalizado'}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Placa Baú</span>
                                        <input
                                            className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm font-black text-primary uppercase tracking-widest focus:outline-none disabled:opacity-50"
                                            placeholder="XYZ-5678"
                                            value={formData.placaBau}
                                            onChange={(e) => setFormData({ ...formData, placaBau: e.target.value.toUpperCase() })}
                                            disabled={submitting || formData.status === 'finalizado'}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Vincular Viagens (Novo Formato Simples) */}
                            <div className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 text-primary">Pesquisar e Vincular Viagens</span>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            list="lista-viagens-global"
                                            placeholder="Busque por código ou ID..."
                                            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
                                            value={idParaVincular}
                                            onChange={(e) => setIdParaVincular(e.target.value)}
                                        />
                                        <datalist id="lista-viagens-global">
                                            {todasViagens.map(v => (
                                                <option key={v.id} value={v.codigoViagem}>{v.motoristaNome} • {v.origem} → {v.destino}</option>
                                            ))}
                                        </datalist>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const viagem = todasViagens.find(v => v.codigoViagem === idParaVincular || v.id === idParaVincular);
                                                if (viagem) {
                                                    if (!formData.viagensIds.includes(viagem.id)) {
                                                        setFormData({ ...formData, viagensIds: [...formData.viagensIds, viagem.id] });
                                                    }
                                                    setIdParaVincular('');
                                                } else {
                                                    alert('Viagem não encontrada');
                                                }
                                            }}
                                            className="bg-primary/20 hover:bg-primary text-primary hover:text-background-dark font-black px-4 rounded-xl transition-all"
                                        >
                                            ADICIONAR
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Viagens Vinculadas</span>
                                    <div className="bg-background-dark/30 rounded-2xl border border-border overflow-hidden min-h-[50px]">
                                        {formData.viagensIds.length === 0 ? (
                                            <p className="text-[10px] text-text-muted italic p-6 text-center">Nenhuma viagem vinculada a este acerto.</p>
                                        ) : (
                                            <div className="divide-y divide-border/50">
                                                {formData.viagensIds.map((vid: string) => {
                                                    const v = todasViagens.find(t => t.id === vid);
                                                    return (
                                                        <div key={vid} className="flex justify-between items-center p-3 hover:bg-primary/5 transition-colors">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-primary uppercase">{v?.codigoViagem || 'Cód. Desconhecido'}</span>
                                                                <span className="text-[9px] text-text-muted font-bold">{v?.motoristaNome} • {v?.origem} → {v?.destino}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, viagensIds: formData.viagensIds.filter((id: string) => id !== vid) })}
                                                                className="text-text-muted hover:text-red-500 transition-colors p-1"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Datas da Viagem */}
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Data Início (Acerto)</span>
                                    <input type="date" className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-text-primary outline-none" value={formData.dataInicio} onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })} disabled={submitting || formData.status === 'finalizado'} />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Data Final (Acerto)</span>
                                    <input type="date" className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-text-primary outline-none disabled:opacity-50" value={formData.dataFim} onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })} disabled={submitting || formData.status === 'finalizado'} />
                                </label>
                            </div>

                            {/* Diárias e Comissões - FIXED LAYOUT */}
                            <div className={`bg-primary/5 p-5 rounded-[2.5rem] border border-primary/10 ${formData.status === 'finalizado' ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="flex flex-col items-center justify-center bg-background/50 rounded-2xl border border-border p-3">
                                        <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Dias Totais</p>
                                        <p className="text-2xl font-black text-primary">{calculateDiarias()}</p>
                                    </div>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Valor Diária</span>
                                        <input
                                            type="number"
                                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-primary font-bold outline-none disabled:opacity-50"
                                            value={formData.valorDiaria === 0 ? '' : formData.valorDiaria}
                                            onChange={(e) => setFormData({ ...formData, valorDiaria: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                            disabled={submitting || formData.status === 'finalizado'}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Adiantamento</span>
                                        <input
                                            type="number"
                                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-blue-500 font-bold outline-none disabled:opacity-50"
                                            placeholder="Recebido"
                                            value={formData.adiantamento === 0 ? '' : formData.adiantamento}
                                            onChange={(e) => setFormData({ ...formData, adiantamento: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                            disabled={submitting || formData.status === 'finalizado'}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Comissão Comb.</span>
                                        <input
                                            type="number"
                                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-primary font-bold outline-none disabled:opacity-50"
                                            value={formData.comissaoCombustivel === 0 ? '' : formData.comissaoCombustivel}
                                            onChange={(e) => setFormData({ ...formData, comissaoCombustivel: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                            disabled={submitting || formData.status === 'finalizado'}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Seção de Itens (Peças, Serviços, etc) */}
                            <div className={`space-y-4 ${formData.status === 'finalizado' ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-lg">list_alt</span>
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Itens da Despesa</span>
                                </div>
                                <div className="grid grid-cols-12 gap-2">
                                    <select
                                        className="col-span-3 bg-background border border-border rounded-xl px-3 py-2.5 text-xs outline-none"
                                        value={newItem.categoria}
                                        onChange={(e) => setNewItem({ ...newItem, categoria: e.target.value })}
                                        disabled={submitting || formData.status === 'finalizado'}
                                    >
                                        <option value="">Categoria</option>
                                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input
                                        type="date"
                                        className="col-span-3 bg-background border border-border rounded-xl px-2 py-2.5 text-[10px] outline-none"
                                        value={newItem.data}
                                        onChange={(e) => setNewItem({ ...newItem, data: e.target.value })}
                                        disabled={submitting || formData.status === 'finalizado'}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Valor"
                                        className="col-span-2 bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-bold"
                                        value={newItem.valor}
                                        onChange={(e) => setNewItem({ ...newItem, valor: e.target.value })}
                                    />
                                    <input
                                        placeholder="Observação"
                                        className="col-span-3 bg-background border border-border rounded-xl px-3 py-2.5 text-xs"
                                        value={newItem.descricao}
                                        onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="col-span-1 bg-primary text-background-dark rounded-xl flex items-center justify-center hover:bg-primary/80 transition-colors shadow-lg"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {formData.items.map((item, idx) => (
                                        <div key={idx} className="flex flex-col bg-surface border border-border p-4 rounded-2xl text-xs group/item relative shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-primary uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded text-[10px]">{item.categoria}</span>
                                                    {item.data && (
                                                        <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                                            {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-sm text-text-primary">R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <button type="button" onClick={() => editItem(idx)} className="text-blue-500 hover:text-blue-400 cursor-pointer">
                                                            <span className="material-symbols-outlined text-[16px]">edit</span>
                                                        </button>
                                                        <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-400 cursor-pointer">
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            {item.descricao && (
                                                <div className="bg-background-dark/50 p-2 rounded-xl border border-border/50">
                                                    <p className="text-[10px] text-text-muted italic">{item.descricao}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>

                        <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
                            <div className="flex gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-0.5">Total Despesas</span>
                                    <span className="text-xl font-black text-text-primary tracking-tight">
                                        R$ {(
                                            (calculateDiarias() * formData.valorDiaria) +
                                            formData.items.reduce((acc, curr) => acc + curr.valor, 0) +
                                            (formData.comissaoCombustivel || 0)
                                        ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex flex-col border-l border-border pl-6">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1 ml-0.5">Saldo a Receber/Pagar</span>
                                    <span className={`text-2xl font-black tracking-tight ${((calculateDiarias() * formData.valorDiaria) + formData.items.reduce((acc, curr) => acc + curr.valor, 0) + (formData.comissaoCombustivel || 0) - (formData.adiantamento || 0)) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        R$ {(
                                            (calculateDiarias() * formData.valorDiaria) +
                                            formData.items.reduce((acc, curr) => acc + curr.valor, 0) +
                                            (formData.comissaoCombustivel || 0) -
                                            (formData.adiantamento || 0)
                                        ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, status: formData.status === 'finalizado' ? 'pendente' : 'finalizado' })}
                                        className={`px-4 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest border transition-all flex items-center gap-2 ${formData.status === 'finalizado' ? 'bg-orange-500/10 border-orange-500 text-orange-500 hover:bg-orange-500/20' : 'bg-green-500/10 border-green-500 text-green-500 hover:bg-green-500/20'}`}
                                    >
                                        <span className="material-symbols-outlined text-sm">{formData.status === 'finalizado' ? 'lock_open' : 'lock'}</span>
                                        {formData.status === 'finalizado' ? 'Abrir para Edição' : 'Finalizar Acerto'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => !submitting && setIsFormOpen(false)}
                                    className="px-6 py-4 border border-border text-text-muted font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-surface-dark transition-colors"
                                >
                                    Voltar
                                </button>
                                {formData.status !== 'finalizado' && (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="px-10 py-4 bg-primary text-background-dark font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                    >
                                        {submitting ? 'Gravando...' : editingId ? 'Salvar Alterações' : 'Confirmar Acerto'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Modal - Documento Legal */}
            {printingDespesa && (
                <div className="fixed inset-0 z-[150] bg-white text-black overflow-y-auto p-10 print:p-0 print:overflow-visible">
                    <style>
                        {`
                            @media print {
                                @page { size: A4; margin: 1cm; }
                                body * { visibility: hidden; }
                                .print-container, .print-container * { visibility: visible; }
                                .print-container { 
                                    position: absolute; 
                                    left: 0; 
                                    top: 0; 
                                    width: 100%; 
                                    box-shadow: none !important;
                                    border: none !important;
                                    padding: 0 !important;
                                }
                                .no-break { break-inside: avoid; }
                                table { width: 100% !important; }
                            }
                        `}
                    </style>
                    <div className="print-container max-w-[800px] mx-auto bg-white p-8 border border-gray-200 shadow-xl print:shadow-none print:border-none rounded-sm">
                        {/* Header do Documento */}
                        <div className="flex justify-between items-start border-b-[3px] border-black pb-2 mb-3">
                            <div className="flex items-center gap-3">
                                <img src={PrintLogo} alt="Logo" className="h-12 w-auto object-contain" />
                                <div>
                                    <h1 className="text-2xl font-black uppercase tracking-tighter mb-0.5">Acerto de Viagem</h1>
                                    <p className="text-[10px] font-bold text-gray-600 uppercase">Golden Gestão de Frota</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[8px] font-black uppercase">Data do Registro</p>
                                <p className="text-base font-bold">{printingDespesa.dataRegistro?.toDate?.() ? printingDespesa.dataRegistro.toDate().toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
                                <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">ID: {printingDespesa.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                        </div>

                        {/* Dados do Motorista e Veículo */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="space-y-1">
                                <h2 className="text-[8px] font-black uppercase tracking-widest border-b border-gray-300 pb-0.5">Informações do Motorista</h2>
                                <div>
                                    <p className="text-[8px] text-gray-500 uppercase font-black">Nome Completo</p>
                                    <p className="text-sm font-bold leading-none">{printingDespesa.motoristaNome}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] text-gray-500 uppercase font-black">CPF</p>
                                    <p className="text-sm font-bold leading-none">{printingDespesa.motoristaCPF || '---.---.------'}</p>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-[8px] font-black uppercase tracking-widest border-b border-gray-300 pb-0.5">Equipamento</h2>
                                <div className="flex gap-4">
                                    <div>
                                        <p className="text-[8px] text-gray-500 uppercase font-black">Placa Cavalo</p>
                                        <p className="text-base font-black tracking-tight leading-none">{printingDespesa.placaCavalo}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] text-gray-500 uppercase font-black">Placa Baú</p>
                                        <p className="text-base font-black tracking-tight leading-none">{printingDespesa.placaBau}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detalhes da Viagem */}
                        <div className="mb-3">
                            <h2 className="text-[8px] font-black uppercase tracking-widest border-b border-gray-300 pb-0.5 mb-2">Resumo da Movimentação</h2>
                            <div className="bg-gray-50 p-2.5 rounded-lg grid grid-cols-3 gap-2 mb-2">
                                <div>
                                    <p className="text-[8px] text-gray-500 uppercase font-black">Período</p>
                                    <p className="text-xs font-bold">{new Date(printingDespesa.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(printingDespesa.dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] text-gray-500 uppercase font-black">Total de Dias</p>
                                    <p className="text-xs font-bold">{printingDespesa.diasDiaria} Diárias (R$ {printingDespesa.valorDiaria?.toLocaleString('pt-BR')})</p>
                                </div>
                                <div>
                                    <p className="text-[8px] text-gray-500 uppercase font-black">Contagem de Cargas</p>
                                    <p className="text-xs font-bold">{printingDespesa.viagensIds?.length || 0} Viagens</p>
                                </div>
                            </div>
                            
                            {printingDespesa.viagensIds && printingDespesa.viagensIds.length > 0 && (
                                <table className="w-full text-[9px] border-collapse mt-1">
                                    <thead>
                                        <tr className="bg-gray-100 border-y border-gray-300 text-left font-black uppercase text-[7px]">
                                            <th className="py-1 px-2">Cód / Cliente</th>
                                            <th className="py-1 px-2">Datas (Carreg/Descarreg)</th>
                                            <th className="py-1 px-2">Rota (Origem → Destino)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {todasViagens.filter(v => printingDespesa.viagensIds?.includes(v.id)).map(v => (
                                            <tr key={v.id}>
                                                <td className="py-1 px-2">
                                                    <p className="font-bold">{v.codigoViagem || 'V-N/A'}</p>
                                                    <p className="text-[7px] text-gray-500">{v.cliente || '-'}</p>
                                                </td>
                                                <td className="py-1 px-2 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span>{v.dataCarregamento ? new Date(v.dataCarregamento + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</span>
                                                        <span className="text-[7px] text-gray-400 italic">Prev: {v.dataPrevistaDescarregamento ? new Date(v.dataPrevistaDescarregamento + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</span>
                                                    </div>
                                                </td>
                                                <td className="py-1 px-2 uppercase">{v.origem} → {v.destino}</td>
                                            </tr>
                                        ))}
                                        {/* Fallback if list is not fully loaded in state */}
                                        {printingDespesa.viagensIds.length > todasViagens.filter(v => printingDespesa.viagensIds?.includes(v.id)).length && (
                                            <tr>
                                                <td colSpan={3} className="py-1 px-2 text-gray-400 italic text-[7px]">
                                                    + {printingDespesa.viagensIds.length - todasViagens.filter(v => printingDespesa.viagensIds?.includes(v.id)).length} outras viagens vinculadas a este acerto.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Tabela de Despesas */}
                        <div className="mb-3">
                            <h2 className="text-[8px] font-black uppercase tracking-widest border-b border-gray-300 pb-0.5 mb-2">Discriminação de Valores</h2>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-black text-left font-black uppercase text-[10px]">
                                        <th className="py-2">Descrição / Categoria</th>
                                        <th className="py-2">Observação</th>
                                        <th className="py-2 text-right">Valor Parcial</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    <tr>
                                        <td className="py-1.5 font-bold uppercase text-[10px]">Diárias ({printingDespesa.diasDiaria}x R$ {printingDespesa.valorDiaria?.toLocaleString('pt-BR')})</td>
                                        <td className="py-1.5 text-gray-500 text-[9px]">Gastos de viagem</td>
                                        <td className="py-1.5 text-right font-bold text-xs whitespace-nowrap">R$ {printingDespesa.totalDiarias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    {printingDespesa.comissaoCombustivel > 0 && (
                                        <tr>
                                            <td className="py-1.5 font-bold uppercase text-[10px]">Comissão de Combustível</td>
                                            <td className="py-1.5 text-gray-500 text-[9px]">Bonificação</td>
                                            <td className="py-1.5 text-right font-bold text-xs whitespace-nowrap">R$ {printingDespesa.comissaoCombustivel?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    )}
                                    {(() => {
                                        // Agrupar itens por categoria para não quebrar o layout do PDF
                                        const groupedItems = printingDespesa.items.reduce((acc: any, item) => {
                                            if (!acc[item.categoria]) {
                                                acc[item.categoria] = { valor: 0, descricoes: [] as string[] };
                                            }
                                            acc[item.categoria].valor += item.valor;
                                            if (item.descricao) acc[item.categoria].descricoes.push(item.descricao);
                                            return acc;
                                        }, {});

                                        return Object.entries(groupedItems).map(([cat, info]: [any, any], i) => (
                                            <tr key={i}>
                                                <td className="py-1.5 font-bold uppercase text-[10px]">
                                                    <div className="flex flex-col">
                                                        <span>{cat}</span>
                                                    </div>
                                                </td>
                                                <td className="py-1.5 text-gray-500 text-[8px] leading-tight max-w-[250px]">
                                                    {info.descricoes.length > 0 ? info.descricoes.join(' | ') : 'Despesa de viagem'}
                                                </td>
                                                <td className="py-1.5 text-right font-bold text-xs whitespace-nowrap">R$ {info.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                                <tfoot className="no-break">
                                    <tr className="border-t-2 border-black">
                                        <td colSpan={2} className="py-2 font-black uppercase text-right text-[10px]">Subtotal de Despesas</td>
                                        <td className="py-2 text-right font-black text-xs text-primary whitespace-nowrap">R$ {printingDespesa.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr className="border-b border-gray-300">
                                        <td colSpan={2} className="py-1.5 font-bold uppercase text-right text-[10px] text-blue-600">(-) Adiantamento de Viagem</td>
                                        <td className="py-1.5 text-right font-bold text-[10px] text-blue-600 whitespace-nowrap">R$ {printingDespesa.adiantamento?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                    <tr className="bg-gray-100">
                                        <td colSpan={2} className="py-2 px-4 font-black uppercase text-right text-sm">
                                            {printingDespesa.saldoFinal >= 0 ? 'Saldo a Receber' : 'Saldo Devedor / Próxima Viagem'}
                                        </td>
                                        <td className={`py-2 px-4 text-right font-black text-lg whitespace-nowrap ${printingDespesa.saldoFinal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            R$ {Math.abs(printingDespesa.saldoFinal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Assinaturas */}
                        <div className="mt-4 grid grid-cols-2 gap-10 no-break">
                            <div className="flex flex-col items-center">
                                <div className="w-full border-t-[1.5px] border-black mb-1"></div>
                                <p className="text-[8px] font-black uppercase tracking-widest text-center">Assinatura de Responsável</p>
                                <p className="text-[7px] text-gray-400 uppercase">EMPRESA / GESTOR DE FROTA</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-full border-t-[1.5px] border-black mb-1"></div>
                                <p className="text-[8px] font-black uppercase tracking-widest text-center">Assinatura do Motorista</p>
                                <p className="text-[8px] font-bold text-center leading-none uppercase">{printingDespesa.motoristaNome}</p>
                                <p className="text-[7px] text-gray-400">CPF: {printingDespesa.motoristaCPF || '---.---.------'}</p>
                            </div>
                        </div>

                        {/* Botões de Ação (não aparecem no print) */}
                        <div className="mt-12 flex justify-end gap-3 print:hidden">
                            <button
                                onClick={() => setPrintingDespesa(null)}
                                className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                            >
                                Fechar Visualização
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="px-8 py-3 bg-primary text-black rounded-xl text-sm font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                            >
                                Imprimir Agora
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingId && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/95 backdrop-blur-sm" onClick={() => !submitting && setDeletingId(null)}></div>
                    <div className="bg-surface border border-red-500/20 w-full max-w-sm rounded-[40px] shadow-2xl p-10 relative z-10 animate-in zoom-in-110 duration-200">
                        <div className="flex flex-col items-center text-center gap-6">
                            <div className="size-20 rounded-full bg-red-500/10 text-red-500 shadow-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-[48px]">delete_forever</span>
                            </div>
                            <h2 className="text-2xl font-black text-text-primary tracking-tight">Excluir Acerto?</h2>
                            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest text-center leading-relaxed">
                                Esta ação não pode ser desfeita e o registro financeiro será removido.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 mt-10">
                            <button
                                onClick={handleDelete}
                                disabled={submitting}
                                className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-[24px] shadow-xl text-xs uppercase tracking-widest disabled:opacity-50"
                            >
                                {submitting ? 'Excluindo...' : 'Apagar Registro'}
                            </button>
                            <button onClick={() => setDeletingId(null)} className="w-full py-3 text-text-muted font-bold text-xs uppercase tracking-widest">Manter</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Configurações Globais */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => setIsSettingsOpen(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative z-10 p-8 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">settings</span>
                            Configurações
                        </h3>

                        <div className="space-y-6">
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Valor Padrão da Diária (R$)</span>
                                <input
                                    type="number"
                                    className="w-full bg-background border border-border rounded-2xl px-4 py-4 text-xl font-black text-primary outline-none focus:border-primary shadow-inner"
                                    value={newGlobalRate}
                                    onChange={(e) => setNewGlobalRate(e.target.value)}
                                    placeholder="0.00"
                                />
                                <p className="text-[9px] text-text-muted px-1 italic">Este valor será usado automaticamente em novos acertos e no aplicativo do motorista.</p>
                            </label>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="flex-1 px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-background border border-border text-text-muted hover:bg-surface transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleUpdateGlobalRate}
                                    className="flex-1 px-4 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-primary text-background-dark shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Salvar Alteração
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5">
                    <div className={`px-6 py-3 rounded-full border backdrop-blur-md font-black text-[10px] uppercase tracking-widest flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                        <span className="material-symbols-outlined text-[18px]">
                            {toast.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}
