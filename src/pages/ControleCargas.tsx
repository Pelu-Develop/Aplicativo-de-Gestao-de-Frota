import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useReactToPrint } from 'react-to-print';
import { BadgeDollarSign } from 'lucide-react';

interface Rota {
    id: string;
    origem: string;
    destino: string;
    cliente: string;
    peso: number;
    valorFrete: number;
    percentualAdiantamento: number;
    adiantamentoPago: boolean;
    saldoPago: boolean;
    codigoRastreio: string;
    entregueDocumento: boolean;
    dataEntregaDocumento: string;
    status: 'Indo para o cliente' | 'Carregando' | 'Viagem' | 'Descarregando' | 'Finalizado' | 'Problema';
    comissionada?: boolean;
    dataEnvioCorreios?: string;
    previsaoChegadaCorreios?: string;
    previsaoChegadaRota?: string;
    dataSaidaRota?: string;
    dataDescarregamentoRota?: string;
    entregue?: boolean;
    litrosAbastecidos?: number;
    valorLitroCombustivel?: number;
    formaPagamento?: string;
    valorComissao?: number;
    anexosEntregas?: string[];
}

interface Viagem {
    id: string;
    codigoViagem: string;
    dataSaida: string;
    dataCarregamento: string;
    dataPrevistaDescarregamento: string;
    motoristaNome: string;
    placaCavalo: string;
    placaBau: string;
    rotas: Rota[];
    // Cached values
    origem: string;
    destino: string;
    cliente: string;
    peso: number;
    valorFrete: number;
    
    status: 'Em planejamento' | 'Em curso' | 'Finalizado' | 'Problema' | string;

    linkComprovante: string;
    comissionada: boolean;
    valorComissao: number;
    litrosAbastecidos: number;
    valorLitroCombustivel: number;
    valorTotalCombustivel: number;
    dataRegistro?: any;
    
    // Resume (Generated when closing)
    resumoCalculo?: {
        totalFretes: number;
        totalAdiantamentos: number;
        totalDespesas: number;
        totalCombustivel: number;
        resultadoOperacional: number;
    };
}

interface Veiculo {
    id: string;
    placa: string;
    tipo: 'cavalo' | 'bau';
    subTipo?: string;
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
    'Em planejamento', 
    'Em curso', 
    'Finalizado', 
    'Problema'
];

const ROTA_STATUS_OPTIONS = [
    'Indo para o cliente',
    'Carregando',
    'Viagem',
    'Descarregando',
    'Finalizado',
    'Problema'
];

const getRotaStatusColor = (status: string) => {
    switch (status) {
        case 'Indo para o cliente':
            return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        case 'Carregando':
        case 'Viagem':
        case 'Descarregando':
            return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        case 'Finalizado':
            return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        case 'Problema':
            return 'bg-red-500/10 text-red-500 border-red-500/20';
        default:
            return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
};

const getRotaCardColor = (status: string) => {
    switch (status) {
        case 'Finalizado': return 'bg-emerald-500/10 border-emerald-500/50 shadow-emerald-500/10';
        case 'Carregando':
        case 'Viagem':
        case 'Descarregando': return 'bg-amber-500/10 border-amber-500/50 shadow-amber-500/10';
        case 'Indo para o cliente': return 'bg-blue-500/10 border-blue-500/50 shadow-blue-500/10';
        case 'Problema': return 'bg-red-500/20 border-red-500/70 shadow-red-500/20 animate-pulse-subtle';
        default: return 'bg-background border-border';
    }
};

const getStatusColor = (status: string, rotas: any[] = []) => {
    if (rotas && Array.isArray(rotas) && rotas.some(r => r.status === 'Problema')) {
        return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    
    const normalized = normalizeStatus(status);
    
    if (normalized === 'Finalizado' || (rotas && Array.isArray(rotas) && rotas.length > 0 && rotas.every(r => r.status === 'Finalizado'))) {
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }

    switch (normalized) {
        case 'Em planejamento': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        case 'Em curso': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
        case 'Finalizado': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        case 'Problema': return 'bg-red-500/10 text-red-500 border-red-500/20';
        default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
};

function normalizeStatus(status: string): string {
    if (!status) return 'Em planejamento';
    const s = status.toUpperCase();
    if (s === 'EM_CURSO' || s === 'CURSO') return 'Em curso';
    if (s === 'CONCLUÍDA' || s === 'FINALIZADO' || s === 'CONCLUIDA') return 'Finalizado';
    if (s === 'PROBLEMA') return 'Problema';
    if (s === 'EM PLANEJAMENTO' || s === 'PLANEJAMENTO') return 'Em planejamento';
    return status;
}




export default function ControleCargas() {
    const location = useLocation();
    const [viagens, setViagens] = useState<Viagem[]>([]);
    const [motoristas, setMotoristas] = useState<{nome: string, status: string, cavaloPlaca?: string, bauPlaca?: string}[]>([]);
    const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
    const [clientes, setClientes] = useState<{nome: string, percentualAdiantamentoPadrao?: number, formaPagamento?: string}[]>([]);
    const [despesasGlobais, setDespesasGlobais] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();

    const [filters, setFilters] = useState({
        search: '',
        status: '',
        statusRota: '',
        motorista: '',
        cliente: '',
        dataInicio: '',
        dataFim: ''
    });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedRotas, setExpandedRotas] = useState<Record<number, boolean>>({});
    const [formData, setFormData] = useState<{
        codigoViagem: string;
        dataSaida: string;
        dataCarregamento: string;
        dataPrevistaDescarregamento: string;
        motoristaNome: string;
        placaCavalo: string;
        placaBau: string;
        rotas: Rota[];
        status: string;
        linkComprovante: string;
        litrosAbastecidos: number;
        valorLitroCombustivel: number;
        valorTotalCombustivel: number;
    }>({
        codigoViagem: '',
        dataSaida: new Date().toISOString().split('T')[0],
        dataCarregamento: '',
        dataPrevistaDescarregamento: '',
        motoristaNome: '',
        placaCavalo: '',
        placaBau: '',
        rotas: [],
        status: 'Em planejamento',
        linkComprovante: '',
        litrosAbastecidos: 0,
        valorLitroCombustivel: 0,
        valorTotalCombustivel: 0
    });
    
    const [submitting, setSubmitting] = useState(false);

    // Fechamento States
    const [isFechamentoOpen, setIsFechamentoOpen] = useState(false);
    const [fechamentoData, setFechamentoData] = useState<any>(null);
    const [fechamentoLoading, setFechamentoLoading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: reportRef,
        documentTitle: `Relatorio_Fechamento_${fechamentoData?.viagem?.codigoViagem || 'Viagem'}`,
    });

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
        if (location.state && location.state.searchTerm) {
            setFilters(prev => ({ ...prev, search: location.state.searchTerm }));
            // Limpa o estado para não re-filtrar se o usuário navegar de volta
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    useEffect(() => {
        const q = query(collection(db, 'motoristas'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                nome: doc.data().nome,
                status: doc.data().status,
                cavaloPlaca: doc.data().cavaloPlaca,
                bauPlaca: doc.data().bauPlaca
            }));
            setMotoristas(list);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'veiculos'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data()
            } as Veiculo));
            setVeiculos(list);
        });
        return () => unsub();
    }, []);


    useEffect(() => {
        const q = query(collection(db, 'clientes'), orderBy('nome', 'asc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                nome: doc.data().nome,
                percentualAdiantamentoPadrao: doc.data().percentualAdiantamentoPadrao,
                formaPagamento: doc.data().formaPagamento
            }));
            setClientes(list);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'despesas_frota'));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDespesasGlobais(list);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const action = searchParams.get('action');
        const isCommission = searchParams.get('commission') === 'true';

        if (action === 'new' && !loading) {
            openCreateModal();
            if (isCommission) {
                // Ao criar uma nova viagem vindo de comissões, podemos marcar a primeira rota
                // Mas como o addRota é chamado no openCreateModal, podemos apenas esperar o usuário marcar
            }
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, loading]);

    const handleMotoristaChange = (nome: string) => {
        const m = motoristas.find(mot => mot.nome === nome);
        setFormData(prev => ({
            ...prev,
            motoristaNome: nome,
            placaCavalo: m?.cavaloPlaca || prev.placaCavalo,
            placaBau: m?.bauPlaca || prev.placaBau
        }));
    };

    const handleVehicleChange = (placa: string) => {
        setFormData({
            ...formData,
            placaCavalo: placa
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
            motoristaNome: '',
            placaCavalo: '',
            placaBau: '',
            rotas: [{
                id: Math.random().toString(36).substr(2, 9),
                origem: '', destino: '', cliente: '', peso: 0, valorFrete: 0,
                percentualAdiantamento: 30, adiantamentoPago: false, saldoPago: false,
                codigoRastreio: '', entregueDocumento: false, dataEntregaDocumento: '',
                status: 'Indo para o cliente'
            }],
            status: 'Em planejamento',
            linkComprovante: '',
            litrosAbastecidos: 0,
            valorLitroCombustivel: 0,
            valorTotalCombustivel: 0
        });
        setIsFormOpen(true);
    };

    const handleEdit = (v: Viagem) => {
        setEditingId(v.id);
        
        let rotas: Rota[] = v.rotas || [];
        // Migration from old flat struct
        if (rotas.length === 0 && v.origem) {
            rotas = [{
                id: Math.random().toString(36).substr(2, 9),
                origem: v.origem || '',
                destino: v.destino || '',
                cliente: v.cliente || '',
                peso: v.peso || 0,
                valorFrete: v.valorFrete || 0,
                percentualAdiantamento: (v as any).percentualAdiantamento || 30,
                adiantamentoPago: (v as any).adiantamentoPago || false,
                saldoPago: (v as any).saldoPago || false,
                codigoRastreio: (v as any).codigoRastreio || '',
                entregueDocumento: (v as any).entregueDocumento || false,
                dataEntregaDocumento: (v as any).dataEntregaDocumento || '',
                status: 'Indo para o cliente'
            }];
        }

        setFormData({
            codigoViagem: v.codigoViagem || '',
            dataSaida: v.dataSaida || '',
            dataCarregamento: v.dataCarregamento || '',
            dataPrevistaDescarregamento: v.dataPrevistaDescarregamento || '',
            motoristaNome: v.motoristaNome || '',
            placaCavalo: v.placaCavalo || '',
            placaBau: v.placaBau || '',
            rotas: rotas.map(r => ({ ...r, status: r.status || 'Indo para o cliente' })),
            status: v.status || 'Em planejamento',
            linkComprovante: v.linkComprovante || '',
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
            // Calculate aggregated fields for backwards compatibility
            const origem = formData.rotas.length > 0 ? formData.rotas[0].origem : '';
            const destino = formData.rotas.length > 0 ? formData.rotas[formData.rotas.length - 1].destino : '';
            const cliente = formData.rotas.length > 0 ? formData.rotas[0].cliente : '';
            const peso = formData.rotas.reduce((acc, r) => acc + r.peso, 0);
            const valorFrete = formData.rotas.reduce((acc, r) => acc + (Number(r.valorFrete) || 0), 0);
            const valorTotalCombustivel = formData.rotas.reduce((acc, r) => acc + ((Number(r.litrosAbastecidos) || 0) * (Number(r.valorLitroCombustivel) || 0)), 0);
            const isComissionada = formData.rotas.some(r => r.comissionada);
            
            const payload = {
                ...formData,
                origem,
                destino,
                cliente,
                peso,
                valorFrete,
                valorTotalCombustivel,
                comissionada: isComissionada
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

    const iniciarFechamento = async (v: Viagem, e: React.MouseEvent) => {
        e.stopPropagation();
        setFechamentoLoading(true);
        try {
            // Fetch despesas linked to this viagem
            const q = query(collection(db, 'despesas_frota'), where('viagensIds', 'array-contains', v.id));
            const snapshot = await getDocs(q);
            const despesasLinked = snapshot.docs.map(doc => doc.data());
            
            const totalDespesas = despesasLinked.reduce((acc, d) => acc + (d.valorTotal || 0), 0);
            
            let rotas = v.rotas || [];
            if (rotas.length === 0 && v.origem) { 
                rotas = [{
                    id: Math.random().toString(36).substr(2, 9),
                    origem: v.origem,
                    destino: v.destino,
                    cliente: v.cliente,
                    peso: v.peso,
                    valorFrete: v.valorFrete,
                    percentualAdiantamento: (v as any).percentualAdiantamento || 30,
                    adiantamentoPago: (v as any).adiantamentoPago || false,
                    saldoPago: (v as any).saldoPago || false,
                    codigoRastreio: '', entregueDocumento: false, dataEntregaDocumento: '',
                    status: 'Indo para o cliente'
                }];
            }

            const totalFretes = rotas.reduce((acc, r) => acc + (r.valorFrete || 0), 0);
            const totalAdiantamentos = rotas.reduce((acc, r) => acc + ((r.valorFrete || 0) * ((r.percentualAdiantamento || 0) / 100)), 0);
            const totalCombustivel = rotas.reduce((acc, r) => acc + ((r.litrosAbastecidos || 0) * (r.valorLitroCombustivel || 0)), 0);
            const resultadoOperacional = totalFretes - (totalDespesas + totalCombustivel);

            setFechamentoData({
                viagem: v,
                rotas: rotas,
                despesas: despesasLinked,
                resumo: {
                    totalFretes,
                    totalAdiantamentos,
                    totalDespesas,
                    totalCombustivel,
                    resultadoOperacional
                }
            });
            setIsFechamentoOpen(true);
        } catch (err) {
            console.error(err);
            alert('Erro ao carregar dados para fechamento.');
        } finally {
            setFechamentoLoading(false);
        }
    };

    const confirmarFechamento = async () => {
        if (!fechamentoData) return;
        try {
            // Finalize all routes within the cycle
            const rotasFinalizadas = fechamentoData.rotas.map((r: any) => ({
                ...r,
                status: 'Finalizado'
            }));

            await updateDoc(doc(db, 'cargas', fechamentoData.viagem.id), {
                status: 'Finalizado',
                rotas: rotasFinalizadas,
                resumoCalculo: fechamentoData.resumo,
                dataAtualizacao: serverTimestamp()
            });
            alert('Viagem e rotas encerradas com sucesso!');
            setIsFechamentoOpen(false);
        } catch (err) {
            console.error(err);
            alert('Erro ao encerrar viagem.');
        }
    };

    const filteredViagens = viagens.filter(v => {
        const matchesSearch = (v.codigoViagem || '').toLowerCase().includes(filters.search.toLowerCase()) ||
                             (v.cliente || '').toLowerCase().includes(filters.search.toLowerCase()) ||
                             (v.origem || '').toLowerCase().includes(filters.search.toLowerCase()) ||
                             (v.destino || '').toLowerCase().includes(filters.search.toLowerCase());
        const matchesStatus = filters.status === '' || normalizeStatus(v.status) === filters.status;
        const matchesStatusRota = filters.statusRota === '' || (v.rotas && Array.isArray(v.rotas) && v.rotas.some((r: any) => r.status === filters.statusRota));
        const matchesMotorista = filters.motorista === '' || v.motoristaNome === filters.motorista;
        const matchesCliente = filters.cliente === '' || (v.rotas && Array.isArray(v.rotas) && v.rotas.some((r: any) => r.cliente === filters.cliente));
        
        let matchesDate = true;
        if (filters.dataInicio) {
            matchesDate = matchesDate && v.dataSaida >= filters.dataInicio;
        }
        if (filters.dataFim) {
            matchesDate = matchesDate && v.dataSaida <= filters.dataFim;
        }

        return matchesSearch && matchesStatus && matchesStatusRota && matchesMotorista && matchesCliente && matchesDate;
    });

    const viagensTotais = filteredViagens.length;
    
    // Calculate total values for dashboard
    const valorTotal = filteredViagens.reduce((acc, curr) => acc + (curr.rotas?.reduce((sum: number, r: any) => sum + (r.valorFrete || 0), 0) || 0), 0);
    
    const filteredIds = filteredViagens.map(v => v.id);
    const totalDespesasDash = despesasGlobais
        .filter(d => d.viagensIds && Array.isArray(d.viagensIds) && d.viagensIds.some((vid: string) => filteredIds.includes(vid)))
        .reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
        
    const totalCombustivelDash = filteredViagens.reduce((acc, curr) => {
        const rotasCombustivel = curr.rotas?.reduce((sum: number, r: any) => sum + ((r.litrosAbastecidos || 0) * (r.valorLitroCombustivel || 0)), 0) || 0;
        return acc + rotasCombustivel;
    }, 0);

    const updateRota = (index: number, field: string, value: any) => {
        const newRotas = [...formData.rotas];
        newRotas[index] = { ...newRotas[index], [field]: value };
        
        // Auto-fill percentualAdiantamento and formaPagamento when client is selected
        if (field === 'cliente') {
            const selectedClient = clientes.find(c => c.nome === value);
            if (selectedClient) {
                if (selectedClient.percentualAdiantamentoPadrao !== undefined) {
                    newRotas[index].percentualAdiantamento = selectedClient.percentualAdiantamentoPadrao;
                }
                if (selectedClient.formaPagamento) {
                    newRotas[index].formaPagamento = selectedClient.formaPagamento;
                }
            }
        }
        
        setFormData({ ...formData, rotas: newRotas });
    };

    const addRota = () => {
        let novaOrigem = '';
        if (formData.rotas.length > 0) {
            novaOrigem = formData.rotas[formData.rotas.length - 1].destino;
        }

        setFormData({
            ...formData,
            rotas: [
                ...formData.rotas,
                {
                    id: Math.random().toString(36).substr(2, 9),
                    origem: novaOrigem, destino: '', cliente: '', peso: 0, valorFrete: 0,
                    percentualAdiantamento: 30, adiantamentoPago: false, saldoPago: false,
                    codigoRastreio: '', entregueDocumento: false, dataEntregaDocumento: '',
                    status: 'Indo para o cliente',
                    valorComissao: 500
                }
            ]
        });
    };

    const removeRota = (index: number) => {
        if(formData.rotas.length <= 1) return;
        const newRotas = formData.rotas.filter((_, i) => i !== index);
        setFormData({ ...formData, rotas: newRotas });
    };

    return (
        <div className="space-y-6 text-text-primary pb-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Gestão de Ciclos de Viagem</h1>
                    <p className="text-primary/80 text-sm">Gerenciamento de rotas, fretes e encerramento de viagens.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreateModal}
                        className="bg-primary hover:bg-primary/90 text-background-dark font-black h-[42px] px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 uppercase text-xs"
                    >
                        <span className="material-symbols-outlined text-xl">add</span>
                        Novo Ciclo
                    </button>
                </div>
            </div>

            {/* Dash Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface border border-border shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-primary">payments</span>
                    </div>
                    <p className="text-primary/80 text-[10px] font-black leading-normal uppercase tracking-widest">Frete Total ({viagensTotais} ciclos)</p>
                    <p className="text-text-primary tracking-tight text-3xl font-black leading-tight">R$ {valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface border border-border shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-red-500">local_gas_station</span>
                    </div>
                    <p className="text-primary/80 text-[10px] font-black leading-normal uppercase tracking-widest">Combustível ({viagensTotais} ciclos)</p>
                    <p className="text-red-500 tracking-tight text-3xl font-black leading-tight">- R$ {totalCombustivelDash.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface border border-border shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-orange-500">receipt_long</span>
                    </div>
                    <p className="text-primary/80 text-[10px] font-black leading-normal uppercase tracking-widest">Despesas ({viagensTotais} ciclos)</p>
                    <p className="text-orange-500 tracking-tight text-3xl font-black leading-tight">- R$ {totalDespesasDash.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface border border-border shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-emerald-500">account_balance_wallet</span>
                    </div>
                    <p className="text-primary/80 text-[10px] font-black leading-normal uppercase tracking-widest">Líquido Total ({viagensTotais} ciclos)</p>
                    <p className="text-emerald-500 tracking-tight text-3xl font-black leading-tight">R$ {(valorTotal - totalCombustivelDash - totalDespesasDash).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-xl">filter_list</span>
                    <h2 className="text-sm font-black uppercase tracking-widest">Filtros de Busca</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3 lg:gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-primary/80 ml-1">Busca Rápida</span>
                        <div className="relative group">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-primary/80 text-sm group-focus-within:text-primary transition-colors">search</span>
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
                        <span className="text-[10px] font-black uppercase text-primary/80 ml-1">Cliente</span>
                        <select 
                            className="w-full bg-background border border-border rounded-xl px-4 h-[34px] text-xs outline-none focus:border-primary"
                            value={filters.cliente}
                            onChange={(e) => setFilters({...filters, cliente: e.target.value})}
                        >
                            <option value="">Todos</option>
                            {clientes.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-primary/80 ml-1">Status Rota</span>
                        <select 
                            className="w-full bg-background border border-border rounded-xl px-4 h-[34px] text-xs outline-none focus:border-primary"
                            value={filters.statusRota}
                            onChange={(e) => setFilters({...filters, statusRota: e.target.value})}
                        >
                            <option value="">Todos os Status (Rota)</option>
                            {ROTA_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-primary/80 ml-1">Motorista</span>
                        <select 
                            className="w-full bg-background border border-border rounded-xl px-4 h-[34px] text-xs outline-none focus:border-primary"
                            value={filters.motorista}
                            onChange={(e) => setFilters({...filters, motorista: e.target.value})}
                        >
                            <option value="">Todos os Motoristas</option>
                            {motoristas.map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
                        </select>

                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-primary/80 ml-1">Início (Saída)</span>
                        <input 
                            type="date" 
                            className="w-full bg-background border border-border rounded-xl px-4 py-1.5 text-xs outline-none focus:border-primary"
                            value={filters.dataInicio}
                            onChange={(e) => setFilters({...filters, dataInicio: e.target.value})}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase text-primary/80 ml-1">Fim (Saída)</span>
                        <input 
                            type="date" 
                            className="w-full bg-background border border-border rounded-xl px-4 py-1.5 text-xs outline-none focus:border-primary"
                            value={filters.dataFim}
                            onChange={(e) => setFilters({...filters, dataFim: e.target.value})}
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ search: '', status: '', statusRota: '', motorista: '', cliente: '', dataInicio: '', dataFim: '' })}
                            className="w-full lg:w-fit lg:px-4 h-[34px] bg-background-dark border border-border text-primary/80 hover:text-primary hover:border-primary/50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            title="Limpar Filtros"
                        >
                            <span className="material-symbols-outlined text-sm">filter_list_off</span>
                            <span className="lg:hidden xl:inline">Limpar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-6 bg-surface border border-border p-1.5 rounded-2xl w-fit shadow-sm">
                <button
                    onClick={() => setFilters({ ...filters, status: '' })}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filters.status === '' ? 'bg-primary text-background-dark shadow-lg shadow-primary/20 scale-105' : 'text-text-muted hover:bg-border/30'}`}
                >
                    <span className="material-symbols-outlined text-[18px]">list</span>
                    Todos
                </button>
                {STATUS_OPTIONS.map(status => (
                    <button
                        key={status}
                        onClick={() => setFilters({ ...filters, status })}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filters.status === status ? 'bg-primary text-background-dark shadow-lg shadow-primary/20 scale-105' : 'text-text-muted hover:bg-border/30'}`}
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {status === 'Em planejamento' ? 'edit_note' : 
                             status === 'Em curso' ? 'local_shipping' : 
                             status === 'Finalizado' ? 'task_alt' : 'warning'}
                        </span>
                        {status}
                    </button>
                ))}
            </div>

            {/* Trips List */}
            <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-black text-primary/80 uppercase tracking-widest">Cód. / Saída</th>
                                <th className="px-6 py-4 text-[10px] font-black text-primary/80 uppercase tracking-widest">Motorista</th>
                                <th className="px-6 py-4 text-[10px] font-black text-primary/80 uppercase tracking-widest">Rotas</th>
                                <th className="px-6 py-4 text-[10px] font-black text-primary/80 uppercase tracking-widest text-right">Frete Total</th>
                                <th className="px-6 py-4 text-[10px] font-black text-primary/80 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-primary/80 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading || fechamentoLoading ? (
                                <tr><td colSpan={6} className="p-20 text-center text-primary/80">Processando...</td></tr>
                            ) : filteredViagens.length === 0 ? (
                                <tr><td colSpan={6} className="p-20 text-center text-primary/80 italic">Nenhuma viagem corresponde aos filtros.</td></tr>
                            ) : (
                                filteredViagens.map(v => {
                                    const countRotas = v.rotas ? v.rotas.length : 1;
                                    return (
                                    <tr key={v.id} onClick={() => handleEdit(v)} className="hover:bg-primary/5 transition-colors cursor-pointer group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter w-fit mb-1">{v.codigoViagem}</span>
                                                <span className="text-xs font-medium">{v.dataSaida ? new Date(v.dataSaida + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium truncate max-w-[150px]">{v.motoristaNome}</span>
                                                <span className="text-[9px] text-primary/80 uppercase font-black tracking-widest">{v.placaCavalo || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-text-primary uppercase">{countRotas} {countRotas === 1 ? 'Rota' : 'Rotas'}</span>
                                                <span className="text-[10px] text-primary/80 uppercase font-black tracking-widest truncate max-w-[200px]">
                                                    {v.origem} → {v.destino}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-bold text-emerald-500">
                                            R$ {(v.valorFrete || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(v.status, v.rotas)}`}>
                                                {normalizeStatus(v.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 items-center">
                                                {v.status === 'Em curso' && (
                                                    <button onClick={(e) => iniciarFechamento(v, e)} className="bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1" title="Encerrar Viagem">
                                                        <span className="material-symbols-outlined text-[14px]">task_alt</span> Encerrar
                                                    </button>
                                                )}
                                                {v.status === 'Finalizado' && (
                                                    <button onClick={(e) => iniciarFechamento(v, e)} className="bg-primary/10 text-primary hover:bg-primary hover:text-background-dark px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1" title="Ver Relatório">
                                                        <span className="material-symbols-outlined text-[14px]">receipt_long</span> Relatório
                                                    </button>
                                                )}
                                                <button onClick={(e) => handleDelete(v.id, e)} className="text-primary/80 hover:text-red-500 p-1 transition-colors">
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )})
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
                        <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                            <div className="flex items-center gap-4">
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tighter">
                                    {editingId ? 'Editar Ciclo de Viagem' : 'Novo Ciclo de Viagem'}
                                </h3>
                                <button type="button" onClick={() => {
                                    addRota();
                                    setExpandedRotas(prev => ({...prev, [formData.rotas.length]: true}));
                                    setTimeout(() => document.getElementById(`rota-card-${formData.rotas.length}`)?.scrollIntoView({behavior: 'smooth', block: 'center'}), 100);
                                }} className="text-[10px] bg-primary/10 text-primary font-black uppercase px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-primary hover:text-background-dark transition-colors">
                                    <span className="material-symbols-outlined text-[14px]">add</span> Adicionar Rota
                                </button>
                            </div>
                            <button onClick={() => setIsFormOpen(false)} className="text-primary/80 hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-4 space-y-8 custom-scrollbar pt-2">
                            {/* Secção 1: Identificação e Datas */}
                            <div className="flex flex-col gap-6 bg-background-dark/30 p-6 rounded-3xl border border-border">
                                <div className="flex items-center justify-between border-b border-border pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                            <BadgeDollarSign size={18} />
                                        </div>
                                        <h4 className="text-xs font-black uppercase text-text-primary tracking-widest">Configurações do Ciclo</h4>
                                    </div>
                                    </div>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-3 space-y-4">
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Código</span>
                                        <input className="w-full bg-background border border-border rounded-xl px-4 text-sm font-bold text-primary h-[50px]" value={formData.codigoViagem} readOnly />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Status</span>
                                        <select className={`w-full bg-background border rounded-xl px-4 py-3 text-sm font-bold h-[50px] appearance-none ${getStatusColor(formData.status)}`} value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})} required>
                                            {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-background text-text-primary">{s}</option>)}
                                        </select>
                                    </label>
                                </div>
                                <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-4 bg-background-dark/30 p-5 rounded-2xl border border-border">
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Motorista</span>
                                        <select className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" value={formData.motoristaNome} onChange={(e) => handleMotoristaChange(e.target.value)} required>
                                            <option value="">Selecione...</option>
                                            {motoristas.filter(m => m.status === 'ativo').map(m => <option key={m.nome} value={m.nome}>{m.nome}</option>)}
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Veículo (Cavalo)</span>
                                        <select className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" value={formData.placaCavalo} onChange={(e) => handleVehicleChange(e.target.value)} required>
                                            <option value="">Selecione...</option>
                                            {veiculos.filter(v => v.tipo === 'cavalo').map(v => <option key={v.id} value={v.placa}>{v.placa} ({v.subTipo})</option>)}
                                        </select>
                                    </label>

                                    <label className="flex flex-col gap-2">
                                        <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Placa Baú</span>
                                        <select className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm" value={formData.placaBau} onChange={(e) => setFormData({...formData, placaBau: e.target.value})} required>
                                            <option value="">Selecione...</option>
                                            {veiculos.filter(v => v.tipo === 'bau').map(v => <option key={v.id} value={v.placa}>{v.placa} ({v.subTipo})</option>)}
                                        </select>
                                    </label>
                                </div>
                            </div>
                            </div>

                            {/* Secção 2: Rotas */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">route</span> Rotas do Ciclo
                                    </h4>
                                </div>
                                
                                {formData.rotas.map((rota, index) => {
                                    const isExpanded = expandedRotas[index] !== false; // Default to true
                                    const isAtrasado = rota.previsaoChegadaRota && new Date(rota.previsaoChegadaRota + 'T23:59:59') < new Date() && !['Descarregando', 'Finalizado'].includes(rota.status);
                                    return (
                                    <div key={rota.id} id={`rota-card-${index}`} className={`p-5 rounded-[24px] relative group shadow-sm transition-all border ${getRotaCardColor(rota.status)}`}>
                                        {formData.rotas.length > 1 && (
                                            <button type="button" onClick={() => removeRota(index)} className="absolute -top-3 -right-3 bg-red-500 text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform z-10">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        )}
                                        <div 
                                            className="flex items-center justify-between cursor-pointer mb-2"
                                            onClick={() => setExpandedRotas(prev => ({...prev, [index]: !isExpanded}))}
                                        >
                                            <div className="flex items-center gap-4 flex-1">
                                                <span className="bg-primary/20 text-primary size-8 rounded-full flex items-center justify-center text-sm font-black">{index + 1}</span>
                                                {isExpanded ? (
                                                    <span className="text-[10px] font-black uppercase text-primary/80 tracking-widest">Detalhes da Rota</span>
                                                ) : (
                                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 flex-1 text-xs items-center">
                                                        <div className="flex flex-col"><span className="text-[9px] text-primary/80 uppercase font-black">Origem</span><span className="font-bold truncate" title={rota.origem}>{rota.origem || '-'}</span></div>
                                                        <div className="flex flex-col"><span className="text-[9px] text-primary/80 uppercase font-black">Destino</span><span className="font-bold truncate" title={rota.destino}>{rota.destino || '-'}</span></div>
                                                        <div className="flex flex-col"><span className="text-[9px] text-primary/80 uppercase font-black">Cliente</span><span className="font-bold truncate" title={rota.cliente}>{rota.cliente || '-'}</span></div>
                                                        <div className="flex flex-col"><span className="text-[9px] text-primary/80 uppercase font-black">Status</span><span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border w-fit ${getRotaStatusColor(rota.status)}`}>{rota.status}</span></div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] text-primary/80 uppercase font-black">Data Chegada</span>
                                                            <span className={`font-bold truncate ${isAtrasado ? 'text-red-500' : ''}`}>
                                                                {rota.previsaoChegadaRota ? new Date(rota.previsaoChegadaRota + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                                                {isAtrasado && <span className="ml-1 text-[8px] animate-pulse">(! ATRASADO)</span>}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col"><span className="text-[9px] text-primary/80 uppercase font-black">Frete</span><span className="font-bold text-emerald-500 truncate">R$ {(rota.valorFrete || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                                                    </div>
                                                )}
                                            </div>
                                            <button type="button" className="text-primary/80 p-2 rounded-full hover:bg-surface transition-colors">
                                                <span className="material-symbols-outlined transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                                            </button>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Origem</span>
                                                <input type="text" list="estados-brasil" className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm" value={rota.origem} onChange={(e) => updateRota(index, 'origem', e.target.value)} disabled={formData.status === 'Finalizado'} required />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Destino</span>
                                                <input type="text" list="estados-brasil" className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm" value={rota.destino} onChange={(e) => updateRota(index, 'destino', e.target.value)} disabled={formData.status === 'Finalizado'} required />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Cliente Solicitante</span>
                                                <input type="text" list="clientes-list" className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm" value={rota.cliente} onChange={(e) => updateRota(index, 'cliente', e.target.value)} disabled={formData.status === 'Finalizado'} required />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Peso (t)</span>
                                                <input type="number" step="0.01" className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm" value={rota.peso || ''} onChange={(e) => updateRota(index, 'peso', parseFloat(e.target.value) || 0)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Data de Saída</span>
                                                <input type="date" className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm" value={rota.dataSaidaRota || ''} onChange={(e) => updateRota(index, 'dataSaidaRota', e.target.value)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isAtrasado ? 'text-red-500' : 'text-primary/80'}`}>Data de Chegada {isAtrasado && ' (ATRASADO)'}</span>
                                                <input type="date" className={`w-full bg-surface border ${isAtrasado ? 'border-red-500 text-red-500' : 'border-border'} rounded-xl px-4 py-2.5 text-sm`} value={rota.previsaoChegadaRota || ''} onChange={(e) => updateRota(index, 'previsaoChegadaRota', e.target.value)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Data Descarregamento</span>
                                                <input type="date" className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm" value={rota.dataDescarregamentoRota || ''} onChange={(e) => updateRota(index, 'dataDescarregamentoRota', e.target.value)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-primary/5 p-4 rounded-xl border border-primary/20 mb-4">
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Frete R$</span>
                                                <input type="number" step="0.01" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-emerald-500" value={rota.valorFrete || ''} onChange={(e) => updateRota(index, 'valorFrete', parseFloat(e.target.value) || 0)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">% Adiant.</span>
                                                <input type="number" step="0.01" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-blue-500" value={rota.percentualAdiantamento || ''} onChange={(e) => updateRota(index, 'percentualAdiantamento', parseFloat(e.target.value) || 0)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-2 lg:col-span-2">
                                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1">Forma de Pagamento</span>
                                                <input type="text" placeholder="Ex: Pix, Pamcard..." className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm" value={rota.formaPagamento || ''} onChange={(e) => updateRota(index, 'formaPagamento', e.target.value)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <div className="flex flex-col gap-1 lg:col-span-2 pt-2 justify-center">
                                                <div className="flex gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase text-primary/80">Adiantamento R$</span>
                                                        <span className="text-sm font-bold text-blue-500">R$ {((rota.valorFrete || 0) * (rota.percentualAdiantamento || 0) / 100).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black uppercase text-primary/80">Saldo R$</span>
                                                        <span className="text-sm font-bold text-emerald-500">R$ {((rota.valorFrete || 0) - ((rota.valorFrete || 0) * (rota.percentualAdiantamento || 0) / 100)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col justify-center gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input type="checkbox" className="rounded border-border text-primary focus:ring-primary size-4" checked={rota.adiantamentoPago} onChange={(e) => updateRota(index, 'adiantamentoPago', e.target.checked)} disabled={formData.status === 'Finalizado'} />
                                                    <span className="text-[10px] font-black uppercase text-text-primary group-hover:text-primary transition-colors">Adiant. Pago</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input type="checkbox" className="rounded border-border text-emerald-500 focus:ring-emerald-500 size-4" checked={rota.saldoPago} onChange={(e) => updateRota(index, 'saldoPago', e.target.checked)} disabled={formData.status === 'Finalizado'} />
                                                    <span className="text-[10px] font-black uppercase text-text-primary group-hover:text-emerald-500 transition-colors">Saldo Pago</span>
                                                </label>
                                            </div>
                                            <div className="flex flex-col justify-center gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input type="checkbox" className="rounded border-border text-purple-500 focus:ring-purple-500 size-4" checked={rota.comissionada || false} onChange={(e) => updateRota(index, 'comissionada', e.target.checked)} disabled={formData.status === 'Finalizado'} />
                                                    <span className="text-[10px] font-black uppercase text-text-primary group-hover:text-purple-500 transition-colors">Comissionada</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer group">
                                                    <input type="checkbox" className="rounded border-border text-green-500 focus:ring-green-500 size-4" checked={rota.entregue || false} onChange={(e) => updateRota(index, 'entregue', e.target.checked)} disabled={formData.status === 'Finalizado'} />
                                                    <span className="text-[10px] font-black uppercase text-text-primary group-hover:text-green-500 transition-colors">Comprovante Recebido</span>
                                                </label>
                                            </div>

                                            <div className="flex flex-col gap-2 justify-center lg:col-span-2">
                                                 <label className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-black text-primary/80 uppercase">Status da Rota</span>
                                                    <select className={`w-full bg-surface border ${getRotaStatusColor(rota.status)} rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none`} value={rota.status} onChange={(e) => updateRota(index, 'status', e.target.value as any)}>
                                                        {ROTA_STATUS_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-surface text-text-primary">{opt}</option>)}
                                                    </select>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 border border-border bg-surface p-4 rounded-xl relative overflow-hidden">
                                            {(!rota.entregue && rota.previsaoChegadaCorreios && new Date(rota.previsaoChegadaCorreios) < new Date()) && (
                                                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>
                                            )}
                                            <label className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-primary/80 uppercase">Cod. Rastreio (Correios)</span>
                                                <input type="text" className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs" value={rota.codigoRastreio} onChange={(e) => updateRota(index, 'codigoRastreio', e.target.value)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-primary/80 uppercase">Envio Correios</span>
                                                <input type="date" className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs" value={rota.dataEnvioCorreios || ''} onChange={(e) => updateRota(index, 'dataEnvioCorreios', e.target.value)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-1">
                                                <span className={`text-[9px] font-black uppercase ${!rota.entregue && rota.previsaoChegadaCorreios && new Date(rota.previsaoChegadaCorreios) < new Date() ? 'text-red-500' : 'text-primary/80'}`}>Prev. Correios</span>
                                                <input type="date" className={`w-full bg-background border ${!rota.entregue && rota.previsaoChegadaCorreios && new Date(rota.previsaoChegadaCorreios) < new Date() ? 'border-red-500 text-red-500' : 'border-border'} rounded-lg px-2 py-1.5 text-xs`} value={rota.previsaoChegadaCorreios || ''} onChange={(e) => updateRota(index, 'previsaoChegadaCorreios', e.target.value)} disabled={formData.status === 'Finalizado'} />
                                                {(!rota.entregue && rota.previsaoChegadaCorreios && new Date(rota.previsaoChegadaCorreios) < new Date()) && <span className="text-[8px] text-red-500 font-bold mt-1">Atrasado!</span>}
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-border bg-background-dark/50 p-4 rounded-xl">
                                            <div className="md:col-span-3 flex items-center gap-2 mb-2 border-b border-border pb-2">
                                                <span className="material-symbols-outlined text-[16px] text-primary">local_gas_station</span>
                                                <span className="text-[10px] font-black uppercase text-primary tracking-widest">Abastecimento na Rota</span>
                                            </div>
                                            <label className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-primary/80 uppercase">Litros Abastecidos</span>
                                                <input type="number" step="0.01" className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs" value={rota.litrosAbastecidos || ''} onChange={(e) => updateRota(index, 'litrosAbastecidos', parseFloat(e.target.value) || 0)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-primary/80 uppercase">Preço por Litro</span>
                                                <input type="number" step="0.001" className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs" value={rota.valorLitroCombustivel || ''} onChange={(e) => updateRota(index, 'valorLitroCombustivel', parseFloat(e.target.value) || 0)} disabled={formData.status === 'Finalizado'} />
                                            </label>
                                            <label className="flex flex-col gap-1">
                                                <span className="text-[9px] font-black text-primary/80 uppercase">Custo Total Combustível</span>
                                                <span className="w-full bg-surface border border-primary/20 text-primary font-black rounded-lg px-2 py-1.5 text-xs">
                                                    R$ {((rota.litrosAbastecidos || 0) * (rota.valorLitroCombustivel || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                                </span>
                                            </label>
                                        </div>

                                        {rota.anexosEntregas && rota.anexosEntregas.length > 0 && (
                                            <div className="grid grid-cols-1 gap-2 border border-primary/20 bg-primary/5 p-4 rounded-xl mt-4">
                                                <div className="flex items-center gap-2 mb-2 border-b border-primary/20 pb-2">
                                                    <span className="material-symbols-outlined text-[16px] text-primary">image</span>
                                                    <span className="text-[10px] font-black uppercase text-primary tracking-widest">Comprovantes de Entrega / Despesas</span>
                                                </div>
                                                <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                                                    {rota.anexosEntregas.map((url: string, i: number) => (
                                                        <div key={i} className="relative shrink-0 group">
                                                            {url.includes('.pdf') || url.includes('token') === false /* basic check */ ? (
                                                                <a href={url} target="_blank" rel="noreferrer" className="w-24 h-24 bg-surface border border-primary/30 rounded-xl flex items-center justify-center hover:bg-primary/10 transition-colors block">
                                                                    <span className="material-symbols-outlined text-red-500 text-3xl">picture_as_pdf</span>
                                                                </a>
                                                            ) : (
                                                                <a href={url} target="_blank" rel="noreferrer">
                                                                    <img src={url} alt={`Comprovante ${i+1}`} className="w-24 h-24 object-cover rounded-xl border border-primary/30 hover:opacity-80 transition-opacity" />
                                                                </a>
                                                            )}
                                                            {formData.status !== 'Finalizado' && (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        const updatedAnexos = (rota.anexosEntregas || []).filter((_: any, idx: number) => idx !== i);
                                                                        updateRota(index, 'anexosEntregas', updatedAnexos);
                                                                    }}
                                                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    title="Excluir Comprovante"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                            
                            <datalist id="estados-brasil">
                                {ESTADOS_BR.map(estado => <option key={estado} value={estado} />)}
                            </datalist>
                            <datalist id="clientes-list">
                                {clientes.map(c => <option key={c.nome} value={c.nome} />)}
                            </datalist>

                            {/* Secção 3: Outros */}
                            <div className="bg-background-dark/30 border border-border rounded-[32px] p-8">
                                {/* Fuel Registration Section (Removed fields) */}
                            </div>
                        </form>

                        <div className="mt-6 pt-6 border-t border-border flex flex-col gap-4 shrink-0 bg-surface z-20">
                            <div className="flex gap-2 flex-wrap items-center overflow-x-auto pb-2 custom-scrollbar">
                                <span className="text-[10px] font-black uppercase text-primary/80 tracking-widest mr-2">Ir para Rota:</span>
                                {formData.rotas.map((rota, index) => (
                                    <button 
                                        key={`jump-btn-${index}`}
                                        type="button" 
                                        onClick={() => {
                                            setExpandedRotas(prev => ({...prev, [index]: true}));
                                            setTimeout(() => document.getElementById(`rota-card-${index}`)?.scrollIntoView({behavior: 'smooth', block: 'center'}), 100);
                                        }}
                                        className="text-[10px] font-black uppercase bg-background border border-border px-3 py-2 rounded-lg hover:border-primary text-text-primary whitespace-nowrap shadow-sm transition-all flex items-center gap-1"
                                    >
                                        <span className="text-primary">R{index + 1}</span>
                                        <span className="text-primary/80 hidden md:inline">|</span>
                                        <span>{rota.origem ? rota.origem.split(' - ')[0] : '...'} <span className="font-bold text-primary">→</span> {rota.destino ? rota.destino.split(' - ')[0] : '...'}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-4 border border-border text-primary/80 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-surface-dark transition-colors">
                                    Cancelar
                                </button>
                                <button onClick={handleSubmit} disabled={submitting} className="px-10 py-4 bg-primary text-background-dark font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                                    {submitting ? 'Salvando...' : (editingId ? 'Salvar Ciclo' : 'Criar Ciclo')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fechamento Modal / Relatório */}
            {isFechamentoOpen && fechamentoData && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => setIsFechamentoOpen(false)}></div>
                    <div className="bg-white text-black w-full max-w-4xl rounded-[32px] shadow-2xl relative z-10 flex flex-col max-h-[95vh] overflow-hidden">
                        
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="text-xl font-black uppercase tracking-tighter">
                                Encerramento de Ciclo
                            </h3>
                            <div className="flex gap-2">
                                {fechamentoData.viagem.status !== 'CONCLUÍDA' && (
                                    <button onClick={confirmarFechamento} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg hover:bg-emerald-600 transition-colors">
                                        Confirmar e Encerrar
                                    </button>
                                )}
                                <button onClick={handlePrint} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg hover:bg-blue-600 transition-colors flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">print</span> Imprimir
                                </button>
                                <button onClick={() => setIsFechamentoOpen(false)} className="text-gray-500 hover:text-red-500 p-2">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Área de Impressão */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white" ref={reportRef}>
                            <div className="max-w-3xl mx-auto space-y-6">
                                {/* Header Relatório */}
                                <div className="text-center border-b-2 border-black pb-4 mb-6">
                                    <h1 className="text-2xl font-black uppercase tracking-widest">Relatório de Fechamento de Viagem</h1>
                                    <p className="text-sm font-bold text-gray-600">Ciclo {fechamentoData.viagem.codigoViagem} • Data: {new Date().toLocaleDateString('pt-BR')}</p>
                                </div>

                                {/* Info Motorista */}
                                <div className="grid grid-cols-2 gap-4 border border-black p-4 rounded">
                                    <div><span className="font-bold uppercase text-xs text-gray-500 block">Motorista</span><span className="font-bold">{fechamentoData.viagem.motoristaNome}</span></div>
                                    <div><span className="font-bold uppercase text-xs text-gray-500 block">Veículo</span><span className="font-bold">{fechamentoData.viagem.placaCavalo} / {fechamentoData.viagem.placaBau}</span></div>
                                </div>

                                {/* Rotas */}
                                <div>
                                    <h4 className="font-black uppercase text-sm border-b border-gray-300 mb-2 pb-1">Rotas Realizadas</h4>
                                    <table className="w-full text-sm border-collapse border border-gray-300">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border border-gray-300 p-2 text-left">Origem</th>
                                                <th className="border border-gray-300 p-2 text-left">Destino</th>
                                                <th className="border border-gray-300 p-2 text-right">Combustível</th>
                                                <th className="border border-gray-300 p-2 text-right">Frete (R$)</th>
                                                <th className="border border-gray-300 p-2 text-right">Adiantamento (R$)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fechamentoData.rotas.map((r: any, i: number) => {
                                                const adt = r.valorFrete * (r.percentualAdiantamento / 100);
                                                return (
                                                <tr key={i}>
                                                    <td className="border border-gray-300 p-2">{r.origem}</td>
                                                    <td className="border border-gray-300 p-2">{r.destino}</td>
                                                    <td className="border border-gray-300 p-2 text-right">{((r.litrosAbastecidos || 0) * (r.valorLitroCombustivel || 0)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                    <td className="border border-gray-300 p-2 text-right">{r.valorFrete.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                    <td className="border border-gray-300 p-2 text-right">{adt.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                </tr>
                                            )})}
                                            <tr className="bg-gray-50 font-bold">
                                                <td colSpan={2} className="border border-gray-300 p-2 text-right uppercase">Subtotal Rotas</td>
                                                <td className="border border-gray-300 p-2 text-right">{fechamentoData.resumo.totalCombustivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                <td className="border border-gray-300 p-2 text-right">{fechamentoData.resumo.totalFretes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                <td className="border border-gray-300 p-2 text-right">{fechamentoData.resumo.totalAdiantamentos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Despesas */}
                                <div>
                                    <h4 className="font-black uppercase text-sm border-b border-gray-300 mb-2 pb-1">Despesas Lançadas</h4>
                                    {fechamentoData.despesas.length === 0 ? (
                                        <p className="text-sm italic text-gray-500">Nenhuma despesa vinculada a este ciclo.</p>
                                    ) : (
                                        <table className="w-full text-sm border-collapse border border-gray-300">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="border border-gray-300 p-2 text-left">Data</th>
                                                    <th className="border border-gray-300 p-2 text-left">Tipo</th>
                                                    <th className="border border-gray-300 p-2 text-right">Valor (R$)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fechamentoData.despesas.map((d: any, i: number) => (
                                                    <tr key={i}>
                                                        <td className="border border-gray-300 p-2">{d.dataInicio || (d.dataRegistro && d.dataRegistro.toDate ? d.dataRegistro.toDate().toLocaleDateString('pt-BR') : '-')}</td>
                                                        <td className="border border-gray-300 p-2">{d.origem === 'motorista_mobile' || d.origem === 'conciliacao_motorista' ? 'Prestação de Contas' : 'Avulsa'}</td>
                                                        <td className="border border-gray-300 p-2 text-right">{(d.valorTotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-gray-50 font-bold">
                                                    <td colSpan={2} className="border border-gray-300 p-2 text-right uppercase">Subtotal Despesas</td>
                                                    <td className="border border-gray-300 p-2 text-right text-red-600">- {fechamentoData.resumo.totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                {/* Resumo Financeiro */}
                                <div>
                                    <h4 className="font-black uppercase text-sm border-b border-gray-300 mb-2 pb-1">Resumo Financeiro (Resultado Operacional)</h4>
                                    <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm max-w-sm ml-auto">
                                        <div className="font-bold flex justify-between border-b border-gray-200 pb-1">
                                            <span>(+) Total Fretes</span>
                                            <span>{fechamentoData.resumo.totalFretes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-200 pb-1 text-red-600">
                                            <span>(-) Despesas</span>
                                            <span>{fechamentoData.resumo.totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-200 pb-1 text-red-600">
                                            <span>(-) Combustível</span>
                                            <span>{fechamentoData.resumo.totalCombustivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="font-black flex justify-between bg-gray-100 p-2 mt-2 text-base rounded">
                                            <span>LÍQUIDO:</span>
                                            <span>R$ {fechamentoData.resumo.resultadoOperacional.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Espaço para anotações extras no relatório */}
                                <div className="mt-12 p-4 border border-dashed border-gray-300 rounded text-xs italic text-gray-500">
                                    Anotações adicionais: ______________________________________________________________________________________________________________________________________________________________________________________________________________________________________________________
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
