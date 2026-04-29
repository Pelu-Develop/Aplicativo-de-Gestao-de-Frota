import { collection, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import {
    TrendingUp,
    DollarSign,
    Truck,
    Percent,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Activity
} from 'lucide-react';

interface Carga {
    id: string;
    codigoViagem: string;
    origem: string;
    destino: string;
    cliente: string;
    valorFrete: number;
    valorTotalCombustivel: number;
    dataSaida: string;
    percentualAdiantamento?: number;
    adiantamentoPago?: boolean;
    saldoPago?: boolean;
    rotas?: any[];
}

interface Despesa {
    id: string;
    motoristaNome: string;
    placaCavalo: string;
    viagensIds?: string[];
    valorTotal: number;
    dataInicio: string;
    dataFim: string;
    status?: string;
}

interface Operacao {
    id: string;
    motoristaNome: string;
    placaCavalo: string;
    dataInicio: string;
    dataFim: string;
    status: string;
    viagensVinculadas: Carga[];
    freteRealizado: number;
    fretePendente: number;
    freteFaturado: number;
    despesaCombustivel: number;
    despesaMotorista: number;
    lucroLiquido: number;
    margem: number;
    // Acerto metadata
    totalDiarias: number;
    adiantamentoMotorista: number;
    itensDespesa: any[];
}

export default function ProfitabilityDashboard() {
    const [despesas, setDespesas] = useState<Despesa[]>([]);
    const [cargas, setCargas] = useState<Carga[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        termo: '',
        cliente: '',
        origem: '',
        destino: '',
        dataInicio: '',
        dataFim: '',
        status: ''
    });
    const [selectedOperacao, setSelectedOperacao] = useState<Operacao | null>(null);
    const [editTrips, setEditTrips] = useState<{ [id: string]: { valorFrete: number, valorTotalCombustivel: number } }>({});
    const [saving, setSaving] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const qDespesas = query(collection(db, 'despesas_frota'));
        const unsubDespesas = onSnapshot(qDespesas, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Despesa));
            // Sort in memory to avoid needing a composite index
            const sortedList = list.sort((a: any, b: any) => {
                const dateA = a.dataRegistro?.seconds || 0;
                const dateB = b.dataRegistro?.seconds || 0;
                return dateB - dateA;
            });
            setDespesas(sortedList);
        }, (error) => {
            console.error("Erro ao buscar despesas no Dashboard:", error);
        });

        const qCargas = query(collection(db, 'cargas'));
        const unsubCargas = onSnapshot(qCargas, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Carga));
            setCargas(list);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar cargas no Dashboard:", error);
            setLoading(false);
        });

        return () => {
            unsubDespesas();
            unsubCargas();
        };
    }, []);

    // Consolidate data to form "Operations"
    const operacoes: Operacao[] = despesas.map(d => {
        const linkedCargas = (d.viagensIds || []).map(id => cargas.find(c => c.id === id)).filter(Boolean) as Carga[];
        
        let freteRealizado = 0;
        let fretePendente = 0;

        linkedCargas.forEach(c => {
            const total = Number(c.valorFrete) || 0;
            const percAdiant = Number(c.percentualAdiantamento) || 0;
            const valAdiant = (total * percAdiant) / 100;
            const valSaldo = total - valAdiant;

            let realizadoParaEstaCarga = 0;
            if (c.adiantamentoPago) realizadoParaEstaCarga += valAdiant;
            if (c.saldoPago) realizadoParaEstaCarga += valSaldo;

            freteRealizado += realizadoParaEstaCarga;
            fretePendente += (total - realizadoParaEstaCarga);
        });

        const freteFaturado = linkedCargas.reduce((acc, curr) => acc + (Number(curr.valorFrete) || 0), 0);
        
        const despesaCombustivel = linkedCargas.reduce((acc, curr) => {
            // Check root field first
            if (curr.valorTotalCombustivel) return acc + Number(curr.valorTotalCombustivel);
            // Fallback to summing routes
            const fuelFromRoutes = curr.rotas?.reduce((sum: number, r: any) => sum + ((Number(r.litrosAbastecidos) || 0) * (Number(r.valorLitroCombustivel) || 0)), 0) || 0;
            return acc + fuelFromRoutes;
        }, 0);

        const despesaMotorista = Number(d.valorTotal) || 0;

        const lucroLiquido = freteFaturado - despesaCombustivel - despesaMotorista;
        const margem = freteFaturado > 0 ? (lucroLiquido / freteFaturado) * 100 : 0;

        return {
            id: d.id,
            motoristaNome: d.motoristaNome,
            placaCavalo: d.placaCavalo || 'N/A',
            dataInicio: d.dataInicio,
            dataFim: d.dataFim,
            status: d.status || 'pendente',
            viagensVinculadas: linkedCargas,
            freteRealizado,
            fretePendente,
            freteFaturado,
            despesaCombustivel,
            despesaMotorista,
            lucroLiquido,
            margem,
            totalDiarias: (d as any).totalDiarias || 0,
            adiantamentoMotorista: (d as any).adiantamento || 0,
            itensDespesa: (d as any).items || []
        };
    }).filter(op => op.viagensVinculadas.length > 0); // Only operations with linked trips

    // Aggregations with expanded filters
    const filteredOps = operacoes.filter(op => {
        const matchTermo = !filters.termo || 
            op.motoristaNome.toLowerCase().includes(filters.termo.toLowerCase()) || 
            op.placaCavalo.toLowerCase().includes(filters.termo.toLowerCase()) ||
            op.viagensVinculadas.some(v => v.codigoViagem?.toLowerCase().includes(filters.termo.toLowerCase()));

        const matchCliente = !filters.cliente || op.viagensVinculadas.some(v => v.cliente?.toLowerCase().includes(filters.cliente.toLowerCase()));
        const matchOrigem = !filters.origem || op.viagensVinculadas.some(v => v.origem?.toLowerCase().includes(filters.origem.toLowerCase()));
        const matchDestino = !filters.destino || op.viagensVinculadas.some(v => v.destino?.toLowerCase().includes(filters.destino.toLowerCase()));
        const matchStatus = !filters.status || op.status === filters.status;

        let matchData = true;
        if (filters.dataInicio) matchData = matchData && op.dataInicio >= filters.dataInicio;
        if (filters.dataFim) matchData = matchData && op.dataInicio <= filters.dataFim;

        return matchTermo && matchCliente && matchOrigem && matchDestino && matchStatus && matchData;
    });
    
    const freteTotalGlobal = filteredOps.reduce((acc, curr) => acc + curr.freteFaturado, 0);
    const combustivelGlobal = filteredOps.reduce((acc, curr) => acc + curr.despesaCombustivel, 0);
    const motoristaGlobal = filteredOps.reduce((acc, curr) => acc + curr.despesaMotorista, 0);
    const lucroLiquidoGlobal = filteredOps.reduce((acc, curr) => acc + curr.lucroLiquido, 0);
    const margemGlobal = freteTotalGlobal > 0 ? (lucroLiquidoGlobal / freteTotalGlobal) * 100 : 0;

    // Chart Data (Top 10 operations)
    const chartData = filteredOps
        .sort((a, b) => b.lucroLiquido - a.lucroLiquido)
        .slice(0, 8)
        .map(op => ({
            name: (op.motoristaNome || 'Motorista').split(' ')[0],
            Frete: op.freteFaturado,
            Custos: op.despesaCombustivel + op.despesaMotorista,
            Lucro: op.lucroLiquido
        }));

    const handleSelectOperacao = (op: Operacao) => {
        setSelectedOperacao(op);
        const edits: any = {};
        op.viagensVinculadas.forEach(v => {
            edits[v.id] = { valorFrete: v.valorFrete, valorTotalCombustivel: v.valorTotalCombustivel };
        });
        setEditTrips(edits);
    };

    const handleTripEdit = (tripId: string, field: 'valorFrete' | 'valorTotalCombustivel', value: string) => {
        const val = parseFloat(value) || 0;
        setEditTrips(prev => ({
            ...prev,
            [tripId]: { ...prev[tripId], [field]: val }
        }));
    };

    const handleSaveEdits = async () => {
        setSaving(true);
        try {
            const promises = Object.entries(editTrips).map(([id, data]) => 
                updateDoc(doc(db, 'cargas', id), {
                    valorFrete: data.valorFrete,
                    valorTotalCombustivel: data.valorTotalCombustivel
                })
            );
            await Promise.all(promises);
            setSelectedOperacao(null);
        } catch (error) {
            console.error("Erro ao salvar edições:", error);
            alert("Erro ao salvar algumas alterações nas viagens.");
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    // Insights Data
    const statsPorCliente = filteredOps.reduce((acc: any, op) => {
        op.viagensVinculadas.forEach(v => {
            const clienteKey = v.cliente || 'Desconhecido';
            if (!acc[clienteKey]) {
                acc[clienteKey] = { nome: clienteKey, totalFrete: 0, totalLucro: 0, viagens: 0 };
            }
            const ratio = (Number(v.valorFrete) || 0) / (op.freteFaturado || 1);
            acc[clienteKey].totalFrete += (Number(v.valorFrete) || 0);
            acc[clienteKey].totalLucro += (op.lucroLiquido * ratio);
            acc[clienteKey].viagens += 1;
        });
        return acc;
    }, {});

    const topClientes = Object.values(statsPorCliente)
        .sort((a: any, b: any) => b.totalLucro - a.totalLucro)
        .slice(0, 5);

    const statsPorRota = filteredOps.reduce((acc: any, op) => {
        op.viagensVinculadas.forEach(v => {
            const rota = `${v.origem} → ${v.destino}`;
            if (!acc[rota]) {
                acc[rota] = { rota, totalFrete: 0, totalLucro: 0, viagens: 0 };
            }
            const ratio = (Number(v.valorFrete) || 0) / (op.freteFaturado || 1);
            acc[rota].totalFrete += (Number(v.valorFrete) || 0);
            acc[rota].totalLucro += (op.lucroLiquido * ratio);
            acc[rota].viagens += 1;
        });
        return acc;
    }, {});

    const topRotas = Object.values(statsPorRota)
        .sort((a: any, b: any) => (b.totalLucro/b.viagens) - (a.totalLucro/a.viagens))
        .slice(0, 5);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
    );

    if (operacoes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-surface border border-dashed border-border rounded-[32px] text-center space-y-4 animate-in fade-in duration-700">
                <div className="p-6 bg-primary/5 rounded-full text-primary/20">
                    <Activity size={64} />
                </div>
                <div className="max-w-md">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Análise de Lucro Vazia</h3>
                    <p className="text-sm text-text-muted mt-2">
                        Para calcular a lucratividade, o sistema precisa saber quais <strong>viagens</strong> pertencem a cada <strong>acerto de motorista</strong>.
                    </p>
                    <div className="mt-8 p-6 bg-background rounded-3xl text-left border border-border shadow-inner space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-black text-xs">1</div>
                            <p className="text-[11px] text-text-muted leading-relaxed">Vá no menu <strong>"Operacional &gt; Conciliação"</strong> ou <strong>"Despesas"</strong>.</p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-black text-xs">2</div>
                            <p className="text-[11px] text-text-muted leading-relaxed">Ao aprovar um acerto, selecione as <strong>Viagens Vinculadas</strong> (ida e volta geralmente).</p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary font-black text-xs">3</div>
                            <p className="text-[11px] text-text-muted leading-relaxed">O lucro aparecerá aqui automaticamente considerando: <strong>Frete Realizado - Combustível - Despesas</strong>.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-500 pb-10 print:p-0 print:bg-white text-text-primary">
            {/* Report Header (Print Only) */}
            <div className="hidden print:block mb-8 border-b-2 border-primary pb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black uppercase text-primary">Relatório de Resultado Operacional</h1>
                        <p className="text-sm font-bold text-gray-600 mt-1 uppercase tracking-widest">Sistema de Gestão de Frota</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 uppercase">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase">Filtros: {filters.dataInicio || 'Início'} até {filters.dataFim || 'Fim'}</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-4 gap-4 mt-8">
                    <div className="border border-gray-200 p-4 rounded-xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Total Realizado</p>
                        <p className="text-xl font-black text-gray-900">R$ {freteTotalGlobal.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="border border-gray-200 p-4 rounded-xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Custos Totais</p>
                        <p className="text-xl font-black text-gray-900">R$ {(combustivelGlobal + motoristaGlobal).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="border border-gray-200 p-4 rounded-xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Lucro Líquido</p>
                        <p className="text-xl font-black text-emerald-600">R$ {lucroLiquidoGlobal.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="border border-gray-200 p-4 rounded-xl">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Margem Média</p>
                        <p className="text-xl font-black text-gray-900">{margemGlobal.toFixed(2)}%</p>
                    </div>
                </div>
            </div>

            {/* Header / Actions */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:hidden">
                <div>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Activity size={24} />
                        </div>
                        Resultado Operacional
                    </h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Análise de Lucratividade Filtrada</p>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <button 
                        onClick={handlePrint}
                        className="bg-surface border border-border h-11 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-primary hover:border-primary/50 transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">print</span>
                        Imprimir Relatório
                    </button>
                    <button 
                        onClick={() => setFilters({ termo: '', cliente: '', origem: '', destino: '', dataInicio: '', dataFim: '', status: '' })}
                        className="bg-surface border border-border h-11 px-4 rounded-xl text-text-muted hover:text-red-500 transition-all"
                        title="Limpar Filtros"
                    >
                        <span className="material-symbols-outlined text-lg">filter_list_off</span>
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-surface border border-border rounded-[32px] p-6 shadow-sm space-y-4 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Filtro Geral (Mot, Placa, Cód)</span>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={filters.termo}
                                onChange={(e) => setFilters(prev => ({ ...prev, termo: e.target.value }))}
                                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-xs focus:border-primary outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Cliente</span>
                        <input
                            type="text"
                            placeholder="Filtrar por cliente..."
                            value={filters.cliente}
                            onChange={(e) => setFilters(prev => ({ ...prev, cliente: e.target.value }))}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs focus:border-primary outline-none transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-black uppercase text-text-muted ml-1">Origem</span>
                            <input
                                type="text"
                                placeholder="UF..."
                                value={filters.origem}
                                onChange={(e) => setFilters(prev => ({ ...prev, origem: e.target.value }))}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs focus:border-primary outline-none transition-all uppercase"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-black uppercase text-text-muted ml-1">Destino</span>
                            <input
                                type="text"
                                placeholder="UF..."
                                value={filters.destino}
                                onChange={(e) => setFilters(prev => ({ ...prev, destino: e.target.value }))}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs focus:border-primary outline-none transition-all uppercase"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                         <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-black uppercase text-text-muted ml-1">Início</span>
                            <input
                                type="date"
                                value={filters.dataInicio}
                                onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:border-primary outline-none transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-black uppercase text-text-muted ml-1">Fim</span>
                            <input
                                type="date"
                                value={filters.dataFim}
                                onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:border-primary outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Global Aggregations */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                            <TrendingUp size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-tight">Total Faturado<br/>(Fretes Realizados)</span>
                    </div>
                    <h4 className="text-3xl font-black text-emerald-500 tracking-tighter">R$ {freteTotalGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h4>
                </div>
                
                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                            <DollarSign size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-tight">Custo Total<br/>(Comb. + Despesas)</span>
                    </div>
                    <h4 className="text-3xl font-black text-red-500 tracking-tighter">R$ {(combustivelGlobal + motoristaGlobal).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h4>
                </div>

                <div className="bg-primary/10 border border-primary/20 p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/20 text-primary rounded-xl">
                                <DollarSign size={18} />
                            </div>
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-tight">Lucro Liquido<br/>Acumulado</span>
                        </div>
                        <h4 className="text-3xl font-black text-text-primary tracking-tighter">R$ {lucroLiquidoGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h4>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                            <Percent size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-tight">Margem de<br/>Lucro Média</span>
                    </div>
                    <div className="flex items-end gap-2">
                        <h4 className="text-3xl font-black text-text-primary tracking-tighter">{margemGlobal.toFixed(1)}%</h4>
                        <div className={`flex items-center text-[10px] font-bold px-2 py-1 rounded-lg mb-1 ${margemGlobal >= 20 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {margemGlobal >= 20 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Comparativo Chart */}
                <div className="lg:col-span-2 bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Top Operações por Lucratividade</h3>
                            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">Comparativo de Receita vs Custos</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} tickFormatter={(value) => `R$${value/1000}k`} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(234, 179, 8, 0.05)' }}
                                    contentStyle={{ backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '16px', color: '#f8fafc', fontWeight: 700 }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }} />
                                <Bar dataKey="Frete" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="Custos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="Lucro" fill="#eab308" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Resumo de Custos */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm flex flex-col">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Composição de Custos</h3>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-8">Base global filtrada</p>

                    <div className="flex-1 space-y-6">
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-text-secondary">Combustível Total</span>
                                <span className="text-orange-500">R$ {combustivelGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="w-full h-3 bg-background-dark rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500" style={{ width: `${(combustivelGlobal / (combustivelGlobal + motoristaGlobal || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-text-secondary">Acertos de Motoristas</span>
                                <span className="text-blue-500">R$ {motoristaGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="w-full h-3 bg-background-dark rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${(motoristaGlobal / (combustivelGlobal + motoristaGlobal || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-border">
                        <div className="flex flex-col p-4 bg-background border border-border rounded-2xl">
                             <span className="text-[10px] text-text-muted font-black uppercase tracking-widest">Alerta de Margem</span>
                             <p className="text-xs text-text-secondary mt-1">Margem ideal do setor gira em torno de 15% a 25%. Monitore rotas deficitárias.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Novas Seções de Insights (Clientes e Rotas) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden">
                {/* Ranking de Clientes */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Lucratividade por Cliente</h3>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-8">Melhores margens por volume</p>

                    <div className="space-y-6">
                        {topClientes.map((c: any, index) => (
                            <div key={index} className="flex items-center gap-4">
                                <div className="size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold shrink-0">
                                    {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-sm font-black text-text-primary truncate uppercase">{c.nome}</span>
                                        <span className="text-xs font-bold text-emerald-500">R$ {c.totalLucro.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 h-2 bg-background-dark rounded-full overflow-hidden mr-3">
                                            <div 
                                                className="h-full bg-emerald-500" 
                                                style={{ width: `${(c.totalLucro / (topClientes[0] as any).totalLucro) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] text-text-muted font-bold whitespace-nowrap">{c.viagens} VIAGENS</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ranking de Rotas */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Desempenho por Rota</h3>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-8">Lucro médio por trecho</p>

                    <div className="space-y-6">
                        {topRotas.map((r: any, index) => (
                            <div key={index} className="flex items-center gap-4">
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                                    <span className="material-symbols-outlined text-lg">route</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs font-black text-text-primary truncate uppercase">{r.rota}</span>
                                        <span className="text-xs font-bold text-primary">R$ {(r.totalLucro/r.viagens).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}/méd.</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex-1 h-2 bg-background-dark rounded-full overflow-hidden mr-3">
                                            <div 
                                                className="h-full bg-primary" 
                                                style={{ width: `${((r.totalLucro/r.viagens) / ((topRotas[0] as any).totalLucro/(topRotas[0] as any).viagens)) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] text-text-muted font-bold whitespace-nowrap">{( (r.totalLucro / r.totalFrete) * 100 ).toFixed(1)}% MARGEM</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabela de Operações (Screen) */}
            <div className="bg-surface border border-border rounded-[40px] overflow-hidden shadow-sm print:hidden">
                <div className="p-8 border-b border-border flex justify-between items-center bg-background/50">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                        <Truck className="text-primary" size={20} /> Detalhamento por Operação (Acerto)
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1200px]">
                        <thead>
                            <tr className="bg-background-dark/80 text-[10px] font-black uppercase tracking-widest text-text-muted border-b border-border">
                                <th className="px-8 py-4">Operação e Motorista</th>
                                <th className="px-8 py-4">Período</th>
                                <th className="px-8 py-4 text-center">Viagens</th>
                                <th className="px-8 py-4 text-emerald-500 text-right">Frete Faturado</th>
                                <th className="px-8 py-4 text-orange-500 text-right">Combustível</th>
                                <th className="px-8 py-4 text-blue-500 text-right">Acerto Mot.</th>
                                <th className="px-8 py-4 text-primary text-right">Lucro Líquido</th>
                                <th className="px-8 py-4 text-center">Margem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredOps.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-8 py-16 text-center text-text-muted text-xs uppercase tracking-widest font-black">
                                        Nenhuma operação consolidada encontrada ou com viagens vinculadas.
                                    </td>
                                </tr>
                            ) : filteredOps.sort((a,b) => b.lucroLiquido - a.lucroLiquido).map((op) => (
                                <tr 
                                    key={op.id} 
                                    className="hover:bg-primary/5 transition-colors group cursor-pointer"
                                    onClick={() => handleSelectOperacao(op)}
                                >
                                    <td className="px-8 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-text-primary uppercase">{op.motoristaNome}</span>
                                            <span className="text-[10px] text-text-muted font-bold tracking-widest">Placa: {op.placaCavalo}</span>
                                            {op.status === 'pendente' && <span className="text-[8px] bg-orange-500/10 text-orange-500 border border-orange-500/30 px-1 py-0.5 rounded w-fit uppercase font-bold mt-1">Acerto Pendente</span>}
                                        </div>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="text-xs font-bold text-text-secondary whitespace-nowrap">
                                            {op.dataInicio ? new Date(op.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'} até <br/> 
                                            {op.dataFim ? new Date(op.dataFim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <div className="flex justify-center flex-wrap gap-1 max-w-[150px]">
                                            {op.viagensVinculadas.map(v => (
                                                <span key={v.id} className="text-[8px] border border-border bg-background px-1.5 py-0.5 rounded text-text-muted font-bold" title={`${v.origem} -> ${v.destino}`}>
                                                    #{v.codigoViagem || v.id.slice(0,5)}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-black text-emerald-500/90 whitespace-nowrap">R$ {op.freteFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            {op.fretePendente > 0 && <span className="text-[9px] text-text-muted font-bold tracking-tighter uppercase">Pendente: R$ {op.fretePendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <span className="text-sm font-black text-orange-500/90 whitespace-nowrap">- R$ {op.despesaCombustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <span className="text-sm font-black text-blue-500/90 whitespace-nowrap">- R$ {op.despesaMotorista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </td>
                                    <td className="px-8 py-4 text-right bg-primary/5">
                                        <span className={`text-base font-black whitespace-nowrap ${op.lucroLiquido >= 0 ? 'text-text-primary' : 'text-red-500'}`}>
                                            R$ {op.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black
                                            ${op.margem >= 20 ? 'bg-emerald-500/10 text-emerald-500' : 
                                              op.margem >= 0 ? 'bg-amber-500/10 text-amber-500' : 
                                              'bg-red-500/10 text-red-500'}
                                        `}>
                                            {op.margem.toFixed(2)}%
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tabela de Operações (Print Only) */}
            <div className="hidden print:block w-full">
                <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                        <tr className="border-b-2 border-gray-300">
                            <th className="py-2 text-gray-600 uppercase">Motorista / Placa</th>
                            <th className="py-2 text-gray-600 uppercase">Período</th>
                            <th className="py-2 text-gray-600 uppercase text-right">Frete Faturado</th>
                            <th className="py-2 text-gray-600 uppercase text-right">Custos</th>
                            <th className="py-2 text-gray-600 uppercase text-right">Lucro Líquido</th>
                            <th className="py-2 text-gray-600 uppercase text-center">Margem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredOps.map((op) => (
                            <tr key={op.id}>
                                <td className="py-2 font-bold uppercase">{op.motoristaNome} ({op.placaCavalo})</td>
                                <td className="py-2">{op.dataInicio} » {op.dataFim}</td>
                                <td className="py-2 text-right">R$ {op.freteFaturado.toLocaleString('pt-BR')}</td>
                                <td className="py-2 text-right">R$ {(op.despesaCombustivel + op.despesaMotorista).toLocaleString('pt-BR')}</td>
                                <td className="py-2 text-right font-black">R$ {op.lucroLiquido.toLocaleString('pt-BR')}</td>
                                <td className="py-2 text-center font-bold">{op.margem.toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[8px] text-gray-400 uppercase font-bold">
                    Fim do Relatório Operacional • Aplicativo de Gestão de Frota
                </div>
            </div>

            {/* Modal de Detalhamento e Edição */}
            {selectedOperacao && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => !saving && setSelectedOperacao(null)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-4xl rounded-[40px] shadow-2xl relative z-10 p-8 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-text-primary uppercase tracking-tight">Detalhamento da Operação</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{selectedOperacao.motoristaNome}</span>
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Placa: {selectedOperacao.placaCavalo}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedOperacao(null)}
                                className="size-10 rounded-xl bg-background border border-border flex items-center justify-center text-text-muted hover:text-primary transition-all"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-10">
                            {/* Resumo cards no Modal */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-background-dark/50 p-4 rounded-3xl border border-border">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Lucro Líquido</p>
                                    <h5 className={`text-xl font-black ${selectedOperacao.lucroLiquido >= 0 ? 'text-text-primary' : 'text-red-500'}`}>
                                        R$ {selectedOperacao.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </h5>
                                </div>
                                <div className="bg-background-dark/50 p-4 rounded-3xl border border-border">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Margem Real</p>
                                    <h5 className="text-xl font-black text-text-primary">
                                        {selectedOperacao.margem.toFixed(2)}%
                                    </h5>
                                </div>
                                <div className="bg-background-dark/50 p-4 rounded-3xl border border-border">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Frete Realizado</p>
                                    <h5 className="text-xl font-black text-emerald-500">
                                        R$ {selectedOperacao.freteFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </h5>
                                    {selectedOperacao.fretePendente > 0 && (
                                        <p className="text-[9px] font-bold text-text-muted mt-1 italic">
                                            Pendente: R$ {selectedOperacao.fretePendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    )}
                                </div>
                                <div className="bg-background-dark/50 p-4 rounded-3xl border border-border">
                                    <p className="text-[8px] font-black text-text-muted uppercase tracking-widest mb-1">Custo Motorista</p>
                                    <h5 className="text-xl font-black text-blue-500">
                                        R$ {selectedOperacao.despesaMotorista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </h5>
                                </div>
                            </div>

                            {/* Detalhes do Acerto (DADOS DO ACERTO) */}
                            <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-[32px] space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-base">account_balance_wallet</span> 
                                        Dados da Prestação de Contas (Acerto)
                                    </h4>
                                    <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${selectedOperacao.status === 'finalizado' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-orange-500/10 text-orange-500 border-orange-500/30'}`}>
                                        {selectedOperacao.status}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[9px] font-bold text-text-muted uppercase mb-1">Total Diárias</p>
                                            <p className="text-sm font-black text-text-primary">R$ {selectedOperacao.totalDiarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-text-muted uppercase mb-1">Adiantamento Realizado</p>
                                            <p className="text-sm font-black text-red-400">R$ {selectedOperacao.adiantamentoMotorista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 space-y-3">
                                        <p className="text-[9px] font-bold text-text-muted uppercase">Lançamentos Extras</p>
                                        <div className="bg-background/50 rounded-2xl border border-border p-3">
                                            {selectedOperacao.itensDespesa.length === 0 ? (
                                                <p className="text-[10px] text-text-muted italic">Nenhum item extra lançado.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {selectedOperacao.itensDespesa.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center text-[11px] border-b border-border/50 pb-1 last:border-0 last:pb-0">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-text-secondary">{item.categoria}</span>
                                                                <span className="text-[9px] text-text-muted">{item.descricao}</span>
                                                            </div>
                                                            <span className="font-black text-text-primary">R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tabela de Viagens no Modal */}
                            <div>
                                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Truck size={14} /> Viagens Vinculadas (Ajuste Rápido)
                                </h4>
                                <div className="bg-background border border-border rounded-3xl overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-background-dark/80 text-[10px] font-black uppercase tracking-widest text-text-muted border-b border-border">
                                                <th className="px-6 py-3 font-black">ID/Cód</th>
                                                <th className="px-6 py-3 font-black">Rota</th>
                                                <th className="px-6 py-3 font-black">Status Pgto</th>
                                                <th className="px-6 py-3 font-black text-right">Valor Frete</th>
                                                <th className="px-6 py-3 font-black text-right">Combustível</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {selectedOperacao.viagensVinculadas.map(v => (
                                                <tr key={v.id} className="text-xs">
                                                    <td className="px-6 py-4 font-bold text-text-primary uppercase">#{v.codigoViagem || v.id.slice(0, 5)}</td>
                                                    <td className="px-6 py-4 text-text-muted lowercase">{v.origem} → {v.destino}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-1">
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${v.adiantamentoPago ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>AD</span>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${v.saldoPago ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>SL</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <span className="text-[10px] font-bold text-emerald-500">R$</span>
                                                                <input 
                                                                    type="number"
                                                                    value={editTrips[v.id]?.valorFrete || 0}
                                                                    onChange={(e) => handleTripEdit(v.id, 'valorFrete', e.target.value)}
                                                                    className="w-24 bg-surface border border-border rounded-lg px-2 py-1 text-right text-text-primary font-black focus:border-primary outline-none"
                                                                />
                                                            </div>
                                                            {(() => {
                                                                const total = editTrips[v.id]?.valorFrete || 0;
                                                                const percAdiant = Number(v.percentualAdiantamento) || 0;
                                                                const valAdiant = (total * percAdiant) / 100;
                                                                const valSaldo = total - valAdiant;
                                                                let realizado = 0;
                                                                if (v.adiantamentoPago) realizado += valAdiant;
                                                                if (v.saldoPago) realizado += valSaldo;
                                                                const pendente = total - realizado;
                                                                
                                                                return pendente > 0 ? (
                                                                    <span className="text-[8px] text-orange-400 font-bold uppercase">Realizado: R$ {realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-[10px] font-bold text-orange-500">R$</span>
                                                            <input 
                                                                type="number"
                                                                value={editTrips[v.id]?.valorTotalCombustivel || 0}
                                                                onChange={(e) => handleTripEdit(v.id, 'valorTotalCombustivel', e.target.value)}
                                                                className="w-24 bg-surface border border-border rounded-lg px-2 py-1 text-right text-text-primary font-black focus:border-primary outline-none"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-[9px] text-text-muted italic mt-3 px-2">
                                    * O lucro desta operação considera apenas o <strong>Frete Realizado</strong> (pago pelo cliente). Saldo pendente não entra no cálculo de rentabilidade imediata.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-border flex items-center justify-between gap-4">
                            <button 
                                onClick={() => navigate(`/despesas?nome=${selectedOperacao.motoristaNome}`)}
                                className="px-6 py-3 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                                Ver Acerto Completo
                            </button>
                            
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setSelectedOperacao(null)}
                                    className="px-6 py-3 text-[10px] font-black uppercase text-text-muted hover:text-text-primary"
                                >
                                    Descartar
                                </button>
                                <button 
                                    onClick={handleSaveEdits}
                                    disabled={saving}
                                    className="px-8 py-3 bg-primary text-background-dark rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                                >
                                    {saving ? (
                                        <div className="w-3 h-3 border-2 border-background-dark/20 border-t-background-dark rounded-full animate-spin"></div>
                                    ) : (
                                        <span className="material-symbols-outlined text-[18px]">save</span>
                                    )}
                                    {saving ? 'Gravando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
