import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Viagem {
    id: string;
    codigoViagem: string;
    dataSaida: string;
    dataCarregamento: string;
    dataPrevistaDescarregamento: string;
    origem: string;
    destino: string;
    motoristaNome: string;
    placaCavalo: string;
    placaBau: string;
    cliente: string;
    peso: number;
    valorFrete: number;
    percentualAdiantamento: number;
    adiantamentoPago: boolean;
    saldoPago: boolean;
    status: 'Aguardando Carga' | 'A Caminho do Cliente' | 'Carregando' | 'Em Viagem' | 'Descarregando' | 'Finalizado' | 'Problema';
    linkComprovante: string;
    codigoRastreio: string; // Correios/Envio
    entregueDocumento: boolean;
    dataEntregaDocumento: string;
    comissionada: boolean;
    valorComissao: number;
    litrosAbastecidos: number;
    valorLitroCombustivel: number;
    valorTotalCombustivel: number;
    dataRegistro?: any;
}

interface Motorista {
    id: string;
    nome: string;
    placaCavalo?: string;
    placaCarreta?: string;
}

const ESTADOS_BR = [
    "Acre, AC", "Alagoas, AL", "Amapá, AP", "Amazonas, AM", "Bahia, BA", "Ceará, CE", 
    "Distrito Federal, DF", "Espírito Santo, ES", "Goiás, GO", "Maranhão, MA", 
    "Mato Grosso, MT", "Mato Grosso do Sul, MS", "Minas Gerais, MG", "Pará, PA", 
    "Paraíba, PB", "Paraná, PR", "Pernambuco, PE", "Piauí, PI", "Rio de Janeiro, RJ", 
    "Rio Grande do Norte, RN", "Rio Grande do Sul, RS", "Rondônia, RO", "Roraima, RR", 
    "Santa Catarina, SC", "São Paulo, SP", "Sergipe, SE", "Tocantins, TO"
];

const STATUS_OPTIONS = [
    'Aguardando Carga', 
    'A Caminho do Cliente', 
    'Carregando', 
    'Em Viagem', 
    'Descarregando', 
    'Finalizado', 
    'Problema'
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Aguardando Carga': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        case 'A Caminho do Cliente': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        case 'Carregando': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
        case 'Em Viagem': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        case 'Descarregando': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
        case 'Finalizado': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        case 'Problema': return 'bg-red-500/10 text-red-500 border-red-500/20';
        default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
};

export default function ControleCargas() {
    const [viagens, setViagens] = useState<Viagem[]>([]);
    const [motoristas, setMotoristas] = useState<Motorista[]>([]);
    const [clientes, setClientes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();

    // Filters state
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        motorista: '',
        dataInicio: '',
        dataFim: ''
    });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        codigoViagem: '',
        dataSaida: new Date().toISOString().split('T')[0],
        dataCarregamento: '',
        dataPrevistaDescarregamento: '',
        origem: '',
        destino: '',
        motoristaNome: '',
        placaCavalo: '',
        placaBau: '',
        cliente: '',
        peso: 0,
        valorFrete: 0,
        percentualAdiantamento: 30,
        adiantamentoPago: false,
        saldoPago: false,
        status: 'Aguardando Carga' as Viagem['status'],
        linkComprovante: '',
        codigoRastreio: '',
        entregueDocumento: false,
        dataEntregaDocumento: '',
        comissionada: false,
        valorComissao: 500,
        litrosAbastecidos: 0,
        valorLitroCombustivel: 0,
        valorTotalCombustivel: 0
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'cargas'), orderBy('dataRegistro', 'desc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Viagem));
            setViagens(list);
            setLoading(false);
        }, (error) => {
            console.error('Erro ao buscar cargas', error);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'motoristas'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                nome: doc.data().nome,
                placaCavalo: doc.data().placaCavalo,
                placaCarreta: doc.data().placaCarreta
            } as Motorista));
            setMotoristas(list);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'clientes'), orderBy('nome', 'asc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => doc.data().nome);
            setClientes(list);
        });
        return () => unsub();
    }, []);

    // Effect to open modal if action=new is in URL
    useEffect(() => {
        const action = searchParams.get('action');
        const isCommission = searchParams.get('commission') === 'true';

        if (action === 'new' && !loading) {
            openCreateModal();
            if (isCommission) {
                setFormData(prev => ({ ...prev, comissionada: true }));
            }
            // Remove params from URL after opening
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, loading]);

    const handleMotoristaChange = (nome: string) => {
        const motorista = motoristas.find(m => m.nome === nome);
        setFormData({
            ...formData,
            motoristaNome: nome,
            placaCavalo: motorista?.placaCavalo || '',
            placaBau: motorista?.placaCarreta || ''
        });
    };

    const openCreateModal = () => {
        setEditingId(null);
        let seq = Math.floor(Math.random() * 9000) + 1000;
        if(viagens.length > 0) {
           seq = viagens.length + 1000;
        }
        setFormData({
            codigoViagem: `V-${seq}`,
            dataSaida: new Date().toISOString().split('T')[0],
            dataCarregamento: '',
            dataPrevistaDescarregamento: '',
            origem: '',
            destino: '',
            motoristaNome: '',
            placaCavalo: '',
            placaBau: '',
            cliente: '',
            peso: 0,
            valorFrete: 0,
            percentualAdiantamento: 30,
            adiantamentoPago: false,
            saldoPago: false,
            status: 'Aguardando Carga',
            linkComprovante: '',
            codigoRastreio: '',
            entregueDocumento: false,
            dataEntregaDocumento: '',
            comissionada: false,
            valorComissao: 500,
            litrosAbastecidos: 0,
            valorLitroCombustivel: 0,
            valorTotalCombustivel: 0
        });
        setIsFormOpen(true);
    };

    const handleEdit = (v: Viagem) => {
        setEditingId(v.id);
        setFormData({
            codigoViagem: v.codigoViagem || '',
            dataSaida: v.dataSaida || '',
            dataCarregamento: v.dataCarregamento || '',
            dataPrevistaDescarregamento: v.dataPrevistaDescarregamento || '',
            origem: v.origem || '',
            destino: v.destino || '',
            motoristaNome: v.motoristaNome || '',
            placaCavalo: v.placaCavalo || '',
            placaBau: v.placaBau || '',
            cliente: v.cliente || '',
            peso: v.peso || 0,
            valorFrete: v.valorFrete || 0,
            percentualAdiantamento: v.percentualAdiantamento !== undefined ? v.percentualAdiantamento : 30,
            adiantamentoPago: v.adiantamentoPago || false,
            saldoPago: v.saldoPago || false,
            status: v.status || 'Aguardando Carga',
            linkComprovante: v.linkComprovante || '',
            codigoRastreio: v.codigoRastreio || '',
            entregueDocumento: v.entregueDocumento || false,
            dataEntregaDocumento: v.dataEntregaDocumento || '',
            valorComissao: v.valorComissao !== undefined ? v.valorComissao : 500,
            litrosAbastecidos: v.litrosAbastecidos || 0,
            valorLitroCombustivel: v.valorLitroCombustivel || 0,
            valorTotalCombustivel: v.valorTotalCombustivel || 0
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm('Tem certeza que deseja excluir?')) {
            await deleteDoc(doc(db, 'cargas', id));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...formData,
            };

            if (editingId) {
                await updateDoc(doc(db, 'cargas', editingId), {
                    ...payload,
                    dataAtualizacao: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'cargas'), {
                    ...payload,
                    dataRegistro: serverTimestamp()
                });
            }
            setIsFormOpen(false);
            setEditingId(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar viagem');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredViagens = viagens.filter(v => {
        const matchesSearch = v.codigoViagem.toLowerCase().includes(filters.search.toLowerCase()) ||
                             v.cliente.toLowerCase().includes(filters.search.toLowerCase()) ||
                             v.origem.toLowerCase().includes(filters.search.toLowerCase()) ||
                             v.destino.toLowerCase().includes(filters.search.toLowerCase());
        const matchesStatus = filters.status === '' || v.status === filters.status;
        const matchesMotorista = filters.motorista === '' || v.motoristaNome === filters.motorista;
        
        let matchesDate = true;
        if (filters.dataInicio) {
            matchesDate = matchesDate && v.dataSaida >= filters.dataInicio;
        }
        if (filters.dataFim) {
            matchesDate = matchesDate && v.dataSaida <= filters.dataFim;
        }

        return matchesSearch && matchesStatus && matchesMotorista && matchesDate;
    });

    const viagensTotais = filteredViagens.length;
    const pesoTotal = filteredViagens.reduce((acc, curr) => acc + (curr.peso || 0), 0);
    const valorTotal = filteredViagens.reduce((acc, curr) => acc + (curr.valorFrete || 0), 0);

    const valorAdiantamento = (formData.valorFrete * formData.percentualAdiantamento) / 100;
    const valorSaldo = formData.valorFrete - valorAdiantamento;

    return (
        <div className="space-y-6 text-text-primary">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Controle de Viagens</h1>
                    <p className="text-text-muted text-sm">Gerenciamento de cargas, fretes e logística.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreateModal}
                        className="bg-primary hover:bg-primary/90 text-background-dark font-black h-[42px] px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 uppercase text-xs"
                    >
                        <span className="material-symbols-outlined text-xl">add</span>
                        Nova Viagem
                    </button>
                </div>
            </div>

            {/* Dash Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface border border-border shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-primary">local_shipping</span>
                    </div>
                    <p className="text-text-muted text-sm font-medium leading-normal uppercase tracking-wider">Viagens Filtradas</p>
                    <p className="text-text-primary tracking-tight text-3xl font-bold leading-tight">{viagensTotais}</p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface border border-border shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-primary">scale</span>
                    </div>
                    <p className="text-text-muted text-sm font-medium leading-normal uppercase tracking-wider">Peso Total</p>
                    <p className="text-text-primary tracking-tight text-3xl font-bold leading-tight">{pesoTotal}t</p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface border border-border shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-primary">payments</span>
                    </div>
                    <p className="text-text-muted text-sm font-medium leading-normal uppercase tracking-wider">Valor em Frete</p>
                    <p className="text-text-primary tracking-tight text-3xl font-bold leading-tight">R$ {valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-xl">filter_list</span>
                    <h2 className="text-sm font-black uppercase tracking-widest">Filtros de Busca</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Busca Rápida</span>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm group-focus-within:text-primary transition-colors">search</span>
                            <input 
                                type="text" 
                                placeholder="Cód., Cliente..." 
                                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 h-[34px] text-xs focus:border-primary outline-none transition-all"
                                value={filters.search}
                                onChange={(e) => setFilters({...filters, search: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Status</span>
                        <select 
                            className="w-full bg-background border border-border rounded-xl px-4 h-[34px] text-xs outline-none focus:border-primary"
                            value={filters.status}
                            onChange={(e) => setFilters({...filters, status: e.target.value})}
                        >
                            <option value="">Todos os Status</option>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Motorista</span>
                        <select 
                            className="w-full bg-background border border-border rounded-xl px-4 h-[34px] text-xs outline-none focus:border-primary"
                            value={filters.motorista}
                            onChange={(e) => setFilters({...filters, motorista: e.target.value})}
                        >
                            <option value="">Todos os Motoristas</option>
                            {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Início (Saída)</span>
                        <input 
                            type="date" 
                            className="w-full bg-background border border-border rounded-xl px-4 py-1.5 text-xs outline-none focus:border-primary"
                            value={filters.dataInicio}
                            onChange={(e) => setFilters({...filters, dataInicio: e.target.value})}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Fim (Saída)</span>
                        <input 
                            type="date" 
                            className="w-full bg-background border border-border rounded-xl px-4 py-1.5 text-xs outline-none focus:border-primary"
                            value={filters.dataFim}
                            onChange={(e) => setFilters({...filters, dataFim: e.target.value})}
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ search: '', status: '', motorista: '', dataInicio: '', dataFim: '' })}
                            className="w-full lg:w-fit lg:px-4 h-[34px] bg-background-dark border border-border text-text-muted hover:text-primary hover:border-primary/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            title="Limpar Filtros"
                        >
                            <span className="material-symbols-outlined text-sm">filter_list_off</span>
                            <span className="lg:hidden xl:inline">Limpar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Trips List */}
            <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Cód. / Saída</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Origem → Destino</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Motorista</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Pgto</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Docs (Correio)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr><td colSpan={8} className="p-20 text-center text-text-muted">Carregando viagens...</td></tr>
                            ) : filteredViagens.length === 0 ? (
                                <tr><td colSpan={8} className="p-20 text-center text-text-muted italic">Nenhuma viagem corresponde aos filtros.</td></tr>
                            ) : (
                                filteredViagens.map(v => (
                                    <tr key={v.id} onClick={() => handleEdit(v)} className="hover:bg-primary/5 transition-colors cursor-pointer group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter w-fit mb-1">{v.codigoViagem}</span>
                                                <span className="text-xs font-medium">{v.dataSaida ? new Date(v.dataSaida + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-text-primary uppercase">{v.origem}</span>
                                                <span className="text-[10px] text-text-muted uppercase font-black tracking-widest">→ {v.destino}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium truncate max-w-[150px]">{v.motoristaNome}</span>
                                                <span className="text-[9px] text-text-muted uppercase font-black tracking-widest">{v.placaCavalo || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium truncate max-w-[150px]">{v.cliente}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col gap-1 items-center">
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${v.adiantamentoPago ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                                    AD: {v.adiantamentoPago ? 'PAGO' : 'PND'}
                                                </span>
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${v.saldoPago ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                                    SL: {v.saldoPago ? 'PAGO' : 'PND'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`material-symbols-outlined text-lg ${v.entregueDocumento ? 'text-green-500' : 'text-text-muted/30'}`}>
                                                    {v.entregueDocumento ? 'mark_email_read' : 'mail'}
                                                </span>
                                                {v.codigoRastreio && <span className="text-[8px] font-black uppercase text-text-muted">{v.codigoRastreio}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(v.status)}`}>
                                                {v.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {v.linkComprovante && (
                                                    <a href={v.linkComprovante} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-text-muted hover:text-blue-500 p-1 transition-colors" title="Google Drive">
                                                        <span className="material-symbols-outlined text-lg">description</span>
                                                    </a>
                                                )}
                                                <button onClick={(e) => handleDelete(v.id, e)} className="text-text-muted hover:text-red-500 p-1 transition-colors">
                                                    <span className="material-symbols-outlined text-lg">delete</span>
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

            {/* Edit / Add Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => setIsFormOpen(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-5xl rounded-[32px] shadow-2xl relative z-10 p-8 flex flex-col max-h-[95vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-text-primary uppercase tracking-tighter">
                                {editingId ? 'Editar Viagem' : 'Nova Viagem'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-text-muted hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-4 space-y-8 custom-scrollbar pt-2">
                            {/* Secção 1: Identificação e Datas */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-3 space-y-4">
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Código</span>
                                        <input className="w-full bg-background border border-border rounded-xl px-4 text-sm font-bold text-primary h-[50px]" value={formData.codigoViagem} readOnly />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Status</span>
                                        <select className={`w-full bg-background border rounded-xl px-4 py-3 text-sm font-bold h-[50px] appearance-none ${getStatusColor(formData.status)}`} value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})} required>
                                            {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-background text-text-primary">{s}</option>)}
                                        </select>
                                    </label>
                                </div>
                                <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-4 bg-background-dark/30 p-5 rounded-2xl border border-border">
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Data Registro (Saída)</span>
                                        <input type="date" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary" value={formData.dataSaida} onChange={(e) => setFormData({...formData, dataSaida: e.target.value})} required />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Data Carregamento</span>
                                        <input type="date" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary" value={formData.dataCarregamento} onChange={(e) => setFormData({...formData, dataCarregamento: e.target.value})} />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Prev. Descarregamento</span>
                                        <input type="date" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary border-amber-500/30" value={formData.dataPrevistaDescarregamento} onChange={(e) => setFormData({...formData, dataPrevistaDescarregamento: e.target.value})} />
                                    </label>
                                </div>
                            </div>

                            {/* Secção 2: Rota e Participantes */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">route</span> Itinerário
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Origem</span>
                                            <input type="text" list="estados-brasil" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Ex: Bahia, BA" value={formData.origem} onChange={(e) => setFormData({...formData, origem: e.target.value})} required />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Destino</span>
                                            <input type="text" list="estados-brasil" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Ex: Santa Catarina, SC" value={formData.destino} onChange={(e) => setFormData({...formData, destino: e.target.value})} required />
                                        </label>
                                        <datalist id="estados-brasil">
                                            {ESTADOS_BR.map(estado => <option key={estado} value={estado} />)}
                                        </datalist>
                                    </div>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Cliente Solicitante</span>
                                        <input type="text" list="clientes-list" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Buscar cliente cadastrado..." value={formData.cliente} onChange={(e) => setFormData({...formData, cliente: e.target.value})} required />
                                        <datalist id="clientes-list">
                                            {clientes.map(c => <option key={c} value={c} />)}
                                        </datalist>
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">person</span> Execução (Motorista)
                                    </h4>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Motorista</span>
                                        <select className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" value={formData.motoristaNome} onChange={(e) => handleMotoristaChange(e.target.value)} required>
                                            <option value="">Selecione o motorista...</option>
                                            {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                                        </select>
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Placa Cavalo</span>
                                            <input className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm uppercase" value={formData.placaCavalo} onChange={(e) => setFormData({...formData, placaCavalo: e.target.value.toUpperCase()})} />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Placa Baú</span>
                                            <input className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm uppercase" value={formData.placaBau} onChange={(e) => setFormData({...formData, placaBau: e.target.value.toUpperCase()})} />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Secção 3: Valores e Adiantamentos */}
                            <div className="bg-primary/5 border border-primary/20 rounded-[32px] p-8">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Base de Frete</h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Peso da Carga (t)</span>
                                                <input type="number" step="0.01" className="bg-background border border-border rounded-xl px-4 py-3 text-sm font-bold" value={formData.peso || ''} onChange={(e) => setFormData({...formData, peso: parseFloat(e.target.value) || 0})} />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Valor Total Frete</span>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-sm">R$</span>
                                                    <input type="number" step="0.01" className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-emerald-500" value={formData.valorFrete || ''} onChange={(e) => setFormData({...formData, valorFrete: parseFloat(e.target.value) || 0})} />
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest text-center">Calculo Adiantamento</h4>
                                        <div className="flex flex-col gap-4 items-center">
                                            <div className="flex items-center gap-3">
                                                <input type="number" className="w-20 bg-background border border-border rounded-xl px-3 py-2 text-center text-sm font-bold text-blue-500" value={formData.percentualAdiantamento} onChange={(e) => setFormData({...formData, percentualAdiantamento: parseFloat(e.target.value) || 0})} />
                                                <span className="text-xl font-black text-text-muted">%</span>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-1">Valor do Adiantamento</p>
                                                <p className="text-xl font-black text-text-primary">R$ {valorAdiantamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-text-muted uppercase font-black tracking-widest mb-1">Saldo Final</p>
                                                <p className="text-xl font-black text-emerald-500">R$ {valorSaldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-center gap-4">
                                        <label className="flex items-center gap-3 p-4 bg-background border border-border rounded-2xl cursor-pointer hover:border-green-500/50 transition-all group">
                                            <div className={`size-6 rounded-lg border flex items-center justify-center transition-all ${formData.adiantamentoPago ? 'bg-green-500 border-green-500 text-white' : 'bg-surface border-border'}`}>
                                                {formData.adiantamentoPago && <span className="material-symbols-outlined text-[16px]">check</span>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={formData.adiantamentoPago} onChange={(e) => setFormData({...formData, adiantamentoPago: e.target.checked})} />
                                            <span className="text-xs font-bold text-text-primary group-hover:text-green-500">Adiantamento Pago</span>
                                        </label>
                                        <label className="flex items-center gap-3 p-4 bg-background border border-border rounded-2xl cursor-pointer hover:border-green-500/50 transition-all group">
                                            <div className={`size-6 rounded-lg border flex items-center justify-center transition-all ${formData.saldoPago ? 'bg-green-500 border-green-500 text-white' : 'bg-surface border-border'}`}>
                                                {formData.saldoPago && <span className="material-symbols-outlined text-[16px]">check</span>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={formData.saldoPago} onChange={(e) => setFormData({...formData, saldoPago: e.target.checked})} />
                                            <span className="text-xs font-bold text-text-primary group-hover:text-green-500">Saldo Final Pago</span>
                                        </label>
                                        <label className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded-2xl cursor-pointer hover:bg-primary/20 transition-all group">
                                            <div className={`size-6 rounded-lg border flex items-center justify-center transition-all ${formData.comissionada ? 'bg-primary border-primary text-background-dark' : 'bg-surface border-border'}`}>
                                                {formData.comissionada && <span className="material-symbols-outlined text-[16px]">check</span>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={formData.comissionada} onChange={(e) => setFormData({...formData, comissionada: e.target.checked})} />
                                            <span className="text-xs font-black uppercase text-primary">Viagem Comissionada</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Fuel Registration Section */}
                                <div className="mt-8 pt-8 border-t border-primary/10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-primary">local_gas_station</span>
                                        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Informações de Abastecimento (Insights)</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Litros Abastecidos</span>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-bold" 
                                                placeholder="0.00"
                                                value={formData.litrosAbastecidos || ''} 
                                                onChange={(e) => {
                                                    const litros = parseFloat(e.target.value) || 0;
                                                    const total = litros * (formData.valorLitroCombustivel || 0);
                                                    setFormData({...formData, litrosAbastecidos: litros, valorTotalCombustivel: parseFloat(total.toFixed(2))});
                                                }} 
                                            />
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Preço por Litro</span>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-xs">R$</span>
                                                <input 
                                                    type="number" 
                                                    step="0.001" 
                                                    className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm font-bold" 
                                                    placeholder="0.000"
                                                    value={formData.valorLitroCombustivel || ''} 
                                                    onChange={(e) => {
                                                        const preco = parseFloat(e.target.value) || 0;
                                                        const total = (formData.litrosAbastecidos || 0) * preco;
                                                        setFormData({...formData, valorLitroCombustivel: preco, valorTotalCombustivel: parseFloat(total.toFixed(2))});
                                                    }} 
                                                />
                                            </div>
                                        </label>
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 font-bold">Custo Total Combustível</span>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-sm">R$</span>
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    className="w-full bg-primary/5 border border-primary/20 rounded-xl pl-10 pr-4 py-3 text-sm font-black text-primary" 
                                                    value={formData.valorTotalCombustivel || ''} 
                                                    readOnly 
                                                />
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Secção 4: Comprovantes e Envio (Correio) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-background-dark/30 p-6 rounded-[32px] border border-border">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">inventory</span> Documentação Física (Correios)
                                    </h4>
                                    <div className="grid grid-cols-1 gap-4">
                                        <label className="flex flex-col gap-2">
                                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Cód. Rastreio / Envio</span>
                                            <input className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" placeholder="Ex: BR123456789" value={formData.codigoRastreio} onChange={(e) => setFormData({...formData, codigoRastreio: e.target.value.toUpperCase()})} />
                                        </label>
                                        <div className="flex gap-4">
                                            <label className="flex-1 flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Data que Chegou</span>
                                                <input type="date" className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-green-500/50" value={formData.dataEntregaDocumento} onChange={(e) => setFormData({...formData, dataEntregaDocumento: e.target.value})} />
                                            </label>
                                            <div className="flex items-end pb-1.5">
                                                <label className="flex items-center gap-2 cursor-pointer bg-background border border-border h-[44px] px-4 rounded-xl hover:border-green-500/50 transition-colors">
                                                    <input type="checkbox" className="size-4 rounded border-border" checked={formData.entregueDocumento} onChange={(e) => setFormData({...formData, entregueDocumento: e.target.checked})} />
                                                    <span className="text-[10px] font-black uppercase text-text-muted">Chegou no Cliente</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">cloud_upload</span> Arquivos Digitais
                                    </h4>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Link Google Drive</span>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-lg">link</span>
                                            <input type="url" className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:border-blue-500/50" placeholder="https://drive.google.com/..." value={formData.linkComprovante} onChange={(e) => setFormData({...formData, linkComprovante: e.target.value})} />
                                        </div>
                                        <p className="text-[9px] text-text-muted italic ml-1">Pasta contendo fotos da carga, assinatura do canhoto, etc.</p>
                                    </label>
                                </div>
                            </div>
                        </form>

                        <div className="mt-6 pt-6 border-t border-border flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-4 border border-border text-text-muted font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-surface-dark transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSubmit} disabled={submitting} className="px-10 py-4 bg-primary text-background-dark font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                {submitting ? 'Salvando Alterações...' : 'Salvar Viagem'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
