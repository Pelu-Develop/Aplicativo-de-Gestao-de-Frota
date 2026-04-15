import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    XAxis,
    YAxis,
    CartesianGrid,
    AreaChart,
    Area,
    BarChart,
    Bar
} from 'recharts';
import {
    DollarSign,
    Receipt,
    TrendingUp,
    PieChart as PieIcon,
    Calendar,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    X,
    ChevronDown,
    Search,
    Tag,
    User,
    Truck,
    SlidersHorizontal
} from 'lucide-react';

// Paleta de cores diversas e contrastantes
const COLORS = [
    '#eab308', // amarelo golden
    '#3b82f6', // azul
    '#10b981', // verde
    '#f97316', // laranja
    '#8b5cf6', // roxo
    '#ec4899', // rosa
    '#06b6d4', // ciano
    '#ef4444', // vermelho
    '#84cc16', // verde-lima
    '#f59e0b', // âmbar
];

const CATEGORIAS = ['Combustível', 'Peças', 'Serviços', 'Lavagem', 'Descarga', 'Estacionamento', 'Transporte', 'Borracharia', 'Outros', 'Diárias', 'Comissão Combustível'];

// Helper para converter Timestamp ou string em Date
function toDate(val: any): Date | null {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

export default function ExpensesDashboard() {
    const [despesas, setDespesas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [showFilters, setShowFilters] = useState(false);
    const [filtroMotorista, setFiltroMotorista] = useState('');
    const [filtroPlaca, setFiltroPlaca] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');

    // Período
    const [dataInicio, setDataInicio] = useState(() => {
        const d = new Date();
        d.setDate(1); // primeiro dia do mês atual
        return d.toISOString().split('T')[0];
    });
    const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);
    const [periodoAtivo, setPeriodoAtivo] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'despesas_frota'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDespesas(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Listas únicas para os selects — campo correto no Firestore: placaCavalo / placaBau
    const motoristas = useMemo(() => [...new Set(despesas.map(d => d.motoristaNome).filter(Boolean))].sort(), [despesas]);
    const placas = useMemo(() => {
        const set = new Set<string>();
        despesas.forEach(d => {
            if (d.placaCavalo) set.add(d.placaCavalo);
            if (d.placaBau) set.add(d.placaBau);
        });
        return [...set].sort();
    }, [despesas]);

    // Aplicar filtros
    const despesasFiltradas = useMemo(() => {
        return despesas.filter(d => {
            // Filtro motorista
            if (filtroMotorista && d.motoristaNome !== filtroMotorista) return false;
            // Filtro placa — verifica placaCavalo e placaBau
            if (filtroPlaca && d.placaCavalo !== filtroPlaca && d.placaBau !== filtroPlaca) return false;
            // Filtro status
            if (filtroStatus && d.status !== filtroStatus) return false;
            // Filtro período
            if (periodoAtivo) {
                const dataReg = toDate(d.dataRegistro || d.dataInicio);
                if (dataReg) {
                    const inicio = new Date(dataInicio.includes('T') ? dataInicio : dataInicio + 'T00:00:00');
                    const fim = new Date(dataFim.includes('T') ? dataFim : dataFim + 'T23:59:59');
                    if (dataReg < inicio || dataReg > fim) return false;
                }
            }
            // Filtro categoria — filtra registros que têm ao menos um item nessa categoria
            if (filtroCategoria) {
                const hasCategoria = (d.items || []).some((item: any) => item.categoria === filtroCategoria)
                    || (filtroCategoria === 'Diárias' && (d.totalDiarias || 0) > 0)
                    || (filtroCategoria === 'Comissão Combustível' && (d.comissaoCombustivel || 0) > 0);
                if (!hasCategoria) return false;
            }
            return true;
        });
    }, [despesas, filtroMotorista, filtroPlaca, filtroStatus, filtroCategoria, periodoAtivo, dataInicio, dataFim]);

    // Totais por categoria (dos registros filtrados)
    const categoryTotals: { [key: string]: number } = {};
    despesasFiltradas.forEach(d => {
        if (!filtroCategoria || filtroCategoria === 'Diárias') {
            categoryTotals['Diárias'] = (categoryTotals['Diárias'] || 0) + (d.totalDiarias || 0);
        }
        if (!filtroCategoria || filtroCategoria === 'Comissão Combustível') {
            categoryTotals['Comissão Combustível'] = (categoryTotals['Comissão Combustível'] || 0) + (d.comissaoCombustivel || 0);
        }
        (d.items || []).forEach((item: any) => {
            const cat = item.categoria || 'Outros';
            if (!filtroCategoria || filtroCategoria === cat) {
                categoryTotals[cat] = (categoryTotals[cat] || 0) + (item.valor || 0);
            }
        });
    });

    const pieData = Object.entries(categoryTotals)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const totalExpensesValue = pieData.reduce((acc, curr) => acc + curr.value, 0);
    const totalAdiantamentos = despesasFiltradas.reduce((acc, curr) => acc + (curr.adiantamento || 0), 0);
    const saldoFinal = totalAdiantamentos - totalExpensesValue;

    // Dados por mês (dos registros filtrados)
    const monthlyMap: { [key: string]: number } = {};
    despesasFiltradas.forEach(d => {
        const dataReg = toDate(d.dataRegistro || d.dataInicio);
        if (dataReg) {
            const mesKey = dataReg.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            monthlyMap[mesKey] = (monthlyMap[mesKey] || 0) + (d.valorTotal || 0);
        }
    });

    const monthlyTrendData = Object.entries(monthlyMap)
        .sort((a, b) => {
            const [ma, ya] = a[0].split('/');
            const [mb, yb] = b[0].split('/');
            return new Date(`20${ya}-${ma}-01`).getTime() - new Date(`20${yb}-${mb}-01`).getTime();
        })
        .map(([month, value]) => ({ month, value }));

    // Se não há dados mensais reais, usa mock baseado nos totais
    const chartData = monthlyTrendData.length > 0 ? monthlyTrendData : [
        { month: 'Jan', value: totalExpensesValue * 0.75 },
        { month: 'Fev', value: totalExpensesValue * 0.9 },
        { month: 'Mar', value: totalExpensesValue },
    ];

    const filtersActive = !!(filtroMotorista || filtroPlaca || filtroCategoria || filtroStatus || periodoAtivo);
    const filtersCount = [filtroMotorista, filtroPlaca, filtroCategoria, filtroStatus, periodoAtivo ? '1' : ''].filter(Boolean).length;

    function clearFilters() {
        setFiltroMotorista('');
        setFiltroPlaca('');
        setFiltroCategoria('');
        setFiltroStatus('');
        setPeriodoAtivo(false);
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest italic animate-pulse">Analisando Despesas...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in zoom-in duration-500 pb-10">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Receipt size={24} />
                        </div>
                        Insights Financeiros
                    </h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">
                        Análise profunda de custos e distribuição de capital
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Botão Filtros */}
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all border
                            ${showFilters || filtersActive
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-surface border-border text-text-muted hover:border-primary/50 hover:text-primary'}`}
                    >
                        <SlidersHorizontal size={14} />
                        Filtros
                        {filtersCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-primary text-background-dark text-[8px] font-black flex items-center justify-center">
                                {filtersCount}
                            </span>
                        )}
                    </button>

                    {/* Período */}
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border shadow-sm transition-all
                        ${periodoAtivo ? 'bg-primary text-background-dark border-primary' : 'bg-surface border-border text-text-muted'}`}>
                        <Calendar size={14} />
                        <input
                            type="date"
                            value={dataInicio}
                            onChange={e => { setDataInicio(e.target.value); setPeriodoAtivo(true); }}
                            className="bg-transparent outline-none text-[10px] font-black uppercase cursor-pointer w-28"
                        />
                        <span className="opacity-50">→</span>
                        <input
                            type="date"
                            value={dataFim}
                            onChange={e => { setDataFim(e.target.value); setPeriodoAtivo(true); }}
                            className="bg-transparent outline-none text-[10px] font-black uppercase cursor-pointer w-28"
                        />
                        {periodoAtivo && (
                            <button onClick={() => setPeriodoAtivo(false)} className="ml-1 opacity-70 hover:opacity-100">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Painel de Filtros Expansível */}
            {showFilters && (
                <div className="bg-surface border border-border rounded-[28px] p-6 shadow-sm animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-primary" />
                            <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">Filtros Avançados</h3>
                        </div>
                        {filtersActive && (
                            <button onClick={clearFilters} className="flex items-center gap-1.5 text-[10px] font-black text-red-400 hover:text-red-500 transition-colors uppercase tracking-widest">
                                <X size={12} /> Limpar Tudo
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Motorista */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                                <User size={12} className="text-primary" /> Motorista
                            </label>
                            <div className="relative">
                                <select
                                    value={filtroMotorista}
                                    onChange={e => setFiltroMotorista(e.target.value)}
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="">Todos os motoristas</option>
                                    {motoristas.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            </div>
                        </div>

                        {/* Placa */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                                <Truck size={12} className="text-primary" /> Placa do Veículo
                            </label>
                            <div className="relative">
                                <select
                                    value={filtroPlaca}
                                    onChange={e => setFiltroPlaca(e.target.value)}
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="">Todas as placas</option>
                                    {placas.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            </div>
                        </div>

                        {/* Categoria */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                                <Tag size={12} className="text-primary" /> Categoria
                            </label>
                            <div className="relative">
                                <select
                                    value={filtroCategoria}
                                    onChange={e => setFiltroCategoria(e.target.value)}
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="">Todas as categorias</option>
                                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                                <Search size={12} className="text-primary" /> Status
                            </label>
                            <div className="relative">
                                <select
                                    value={filtroStatus}
                                    onChange={e => setFiltroStatus(e.target.value)}
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-bold text-text-primary outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                                >
                                    <option value="">Todos os status</option>
                                    <option value="pendente">Pendente</option>
                                    <option value="finalizado">Finalizado</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Chips dos filtros ativos */}
                    {filtersActive && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                            <span className="text-[9px] font-black text-text-muted uppercase tracking-widest self-center">Ativos:</span>
                            {filtroMotorista && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary">
                                    <User size={10} /> {filtroMotorista}
                                    <button onClick={() => setFiltroMotorista('')}><X size={10} /></button>
                                </span>
                            )}
                            {filtroPlaca && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400">
                                    <Truck size={10} /> {filtroPlaca}
                                    <button onClick={() => setFiltroPlaca('')}><X size={10} /></button>
                                </span>
                            )}
                            {filtroCategoria && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400">
                                    <Tag size={10} /> {filtroCategoria}
                                    <button onClick={() => setFiltroCategoria('')}><X size={10} /></button>
                                </span>
                            )}
                            {filtroStatus && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-400">
                                    {filtroStatus}
                                    <button onClick={() => setFiltroStatus('')}><X size={10} /></button>
                                </span>
                            )}
                            {periodoAtivo && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-black text-purple-400">
                                    <Calendar size={10} /> {new Date(dataInicio.includes('T') ? dataInicio : dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} → {new Date(dataFim.includes('T') ? dataFim : dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}
                                    <button onClick={() => setPeriodoAtivo(false)}><X size={10} /></button>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Indicador de registros filtrados */}
            {filtersActive && (
                <div className="flex items-center gap-3 py-2 px-5 bg-primary/5 border border-primary/10 rounded-2xl w-fit text-[10px] font-black text-primary uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                    {despesasFiltradas.length} de {despesas.length} registros exibidos
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Custo Total', value: `R$ ${totalExpensesValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', isPositive: false, trend: `${despesasFiltradas.length} registros` },
                    { label: 'Adiantamentos', value: `R$ ${totalAdiantamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10', isPositive: true, trend: 'Total pago' },
                    { label: 'Saldo Final', value: `R$ ${Math.abs(saldoFinal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: PieIcon, color: saldoFinal >= 0 ? 'text-emerald-500' : 'text-red-400', bg: saldoFinal >= 0 ? 'bg-emerald-500/10' : 'bg-red-400/10', isPositive: saldoFinal >= 0, trend: saldoFinal >= 0 ? 'Crédito' : 'Débito a pagar' },
                    { label: 'Média/Registro', value: `R$ ${despesasFiltradas.length > 0 ? (totalExpensesValue / despesasFiltradas.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}`, icon: Receipt, color: 'text-amber-500', bg: 'bg-amber-500/10', isPositive: null, trend: 'Por acerto' },
                ].map((card, i) => (
                    <div key={i} className="bg-surface border border-border rounded-[28px] p-6 shadow-sm flex flex-col gap-3 relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <card.icon size={70} strokeWidth={1} />
                        </div>
                        <div className={`${card.bg} ${card.color} w-fit p-3 rounded-2xl`}>
                            <card.icon size={22} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">{card.label}</p>
                            <h2 className="text-xl font-black text-text-primary tracking-tight leading-none">{card.value}</h2>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {card.isPositive !== null && (
                                card.isPositive ? <ArrowUpRight size={11} className="text-emerald-500" /> : <ArrowDownRight size={11} className="text-red-400" />
                            )}
                            <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">{card.trend}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Distribution Pie */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Distribuição de Gastos</h3>
                        <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Por categoria de despesa</p>
                    </div>

                    {pieData.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-40 py-12">
                            <PieIcon size={48} strokeWidth={1} />
                            <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Sem dados para o filtro selecionado</p>
                        </div>
                    ) : (
                        <>
                            <div className="h-[260px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={110}
                                            paddingAngle={4}
                                            dataKey="value"
                                            strokeWidth={2}
                                            stroke="#121212"
                                            isAnimationActive={false}
                                        >
                                            {pieData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '12px', color: '#f8fafc', fontWeight: 700, fontSize: 12, padding: '8px 14px' }}
                                            itemStyle={{ color: '#eab308' }}
                                            formatter={(value: any, name: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, name]}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-black text-text-primary tracking-tighter">
                                        R$ {totalExpensesValue >= 1000
                                            ? `${(totalExpensesValue / 1000).toFixed(1)}k`
                                            : totalExpensesValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">Total</span>
                                </div>
                            </div>

                            {/* Legenda com cores distintas */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-6 pt-6 border-t border-border/50">
                                {pieData.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-2.5 group cursor-pointer">
                                        <div
                                            className="w-3 h-3 rounded-sm flex-shrink-0 shadow-sm"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        ></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-text-secondary group-hover:text-primary transition-colors truncate uppercase tracking-wide">
                                                {entry.name}
                                            </p>
                                            <div className="flex items-center justify-between gap-1">
                                                <div className="flex-1 h-0.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] + '40' }}>
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            backgroundColor: COLORS[index % COLORS.length],
                                                            width: `${totalExpensesValue > 0 ? (entry.value / totalExpensesValue) * 100 : 0}%`
                                                        }}
                                                    ></div>
                                                </div>
                                                <span className="text-[9px] font-black text-text-muted flex-shrink-0">
                                                    {totalExpensesValue > 0 ? Math.round((entry.value / totalExpensesValue) * 100) : 0}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Tendência por período */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm flex flex-col">
                    <div className="mb-6">
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Evolução por Período</h3>
                        <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">
                            {periodoAtivo
                                ? `${new Date(dataInicio.includes('T') ? dataInicio : dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} → ${new Date(dataFim.includes('T') ? dataFim : dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`
                                : 'Todos os períodos'}
                        </p>
                    </div>

                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                                <Tooltip
                                    wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', color: '#f8fafc', fontWeight: 700, fontSize: 12, padding: '8px 14px' }}
                                    itemStyle={{ color: '#eab308' }}
                                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Despesas']}
                                />
                                <Area type="monotone" dataKey="value" stroke="#eab308" strokeWidth={3} fillOpacity={1} fill="url(#areaColor)" dot={{ fill: '#eab308', r: 4 }} activeDot={{ r: 6 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Comparativo por Categoria — barra (corrigido) */}
            {pieData.length > 0 && (
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Comparativo por Categoria</h3>
                        <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Valor absoluto por tipo de despesa</p>
                    </div>
                    {/* Altura dinâmica: 52px por item, mínimo 160px */}
                    <div style={{ height: Math.max(160, pieData.length * 52) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={pieData}
                                layout="vertical"
                                margin={{ left: 0, right: 60, top: 4, bottom: 4 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#262626" />
                                <XAxis
                                    type="number"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
                                    width={80}
                                />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 700 }}
                                    width={140}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(234,179,8,0.05)' }}
                                    wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', color: '#f8fafc', fontWeight: 700, fontSize: 12, padding: '8px 14px' }}
                                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Total']}
                                />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28} label={{ position: 'right', fill: '#94a3b8', fontSize: 10, fontWeight: 700, formatter: (v: any) => v != null ? `R$ ${Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + 'k' : Number(v).toFixed(0)}` : '' }}>
                                    {pieData.map((_, index) => (
                                        <Cell key={`cell-bar-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ===== GASTOS POR MOTORISTA ===== */}
            {despesasFiltradas.length > 0 && (() => {
                const byDriver: { [name: string]: { total: number; count: number } } = {};
                despesasFiltradas.forEach(d => {
                    const nome = d.motoristaNome || 'Sem nome';
                    if (!byDriver[nome]) byDriver[nome] = { total: 0, count: 0 };
                    byDriver[nome].count += 1;
                    if (filtroCategoria) {
                        if (filtroCategoria === 'Diárias') { byDriver[nome].total += (d.totalDiarias || 0); }
                        else if (filtroCategoria === 'Comissão Combustível') { byDriver[nome].total += (d.comissaoCombustivel || 0); }
                        else { (d.items || []).forEach((item: any) => { if ((item.categoria || 'Outros') === filtroCategoria) byDriver[nome].total += (item.valor || 0); }); }
                    } else { byDriver[nome].total += (d.valorTotal || 0); }
                });
                const driverData = Object.entries(byDriver)
                    .map(([name, { total, count }]) => ({ name, total, count, media: count > 0 ? total / count : 0 }))
                    .filter(d => d.total > 0).sort((a, b) => b.total - a.total);
                if (driverData.length === 0) return null;
                const maxTotal = driverData[0]?.total || 1;
                return (
                    <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-8">
                            <div>
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                                    <User size={20} className="text-primary" /> Gastos por Motorista
                                </h3>
                                <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">
                                    {filtroCategoria ? <><span className="text-primary">{filtroCategoria}</span></> : 'Total consolidado'}
                                    {periodoAtivo ? ` · ${new Date(dataInicio.includes('T') ? dataInicio : dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} → ${new Date(dataFim.includes('T') ? dataFim : dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                                </p>
                            </div>
                            <span className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-[10px] font-black text-primary uppercase tracking-widest">
                                {driverData.length} motorista{driverData.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div style={{ height: Math.max(160, driverData.length * 52) }} className="mb-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={driverData} layout="vertical" margin={{ left: 0, right: 70, top: 4, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#262626" />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `R$ ${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 700 }} width={150} />
                                    <Tooltip cursor={{ fill: 'rgba(234,179,8,0.05)' }}
                                        wrapperStyle={{ pointerEvents: 'none', zIndex: 50 }}
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', color: '#f8fafc', fontWeight: 700, fontSize: 12, padding: '8px 14px' }}
                                        formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, filtroCategoria || 'Total']} />
                                    <Bar dataKey="total" radius={[0, 8, 8, 0]} barSize={28}
                                        label={{ position: 'right', fill: '#94a3b8', fontSize: 10, fontWeight: 700, formatter: (v: any) => v != null ? `R$ ${Number(v) >= 1000 ? (Number(v) / 1000).toFixed(1) + 'k' : Number(v).toFixed(0)}` : '' }}>
                                        {driverData.map((_, index) => (<Cell key={`drv-bar-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border border-border/50">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-background/60 text-[10px] font-black uppercase tracking-widest text-text-muted border-b border-border">
                                        <th className="px-5 py-3">#</th>
                                        <th className="px-5 py-3">Motorista</th>
                                        <th className="px-5 py-3 text-center">Registros</th>
                                        <th className="px-5 py-3 text-right">Média / Viagem</th>
                                        <th className="px-5 py-3 text-right">Total {filtroCategoria || 'Geral'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {driverData.map((d, i) => (
                                        <tr key={i} className="hover:bg-primary/5 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="size-6 rounded-md flex items-center justify-center text-[9px] font-black"
                                                    style={{ backgroundColor: COLORS[i % COLORS.length] + '25', color: COLORS[i % COLORS.length] }}>#{i + 1}</div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-xl flex items-center justify-center text-xs font-black"
                                                        style={{ backgroundColor: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length] }}>
                                                        {String(d.name || '').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-black text-text-primary">{d.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-center"><span className="text-xs font-bold text-text-muted">{d.count}</span></td>
                                            <td className="px-5 py-3.5 text-right">
                                                <span className="text-xs font-bold text-text-secondary">R$ {d.media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-sm font-black" style={{ color: COLORS[i % COLORS.length] }}>R$ {d.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${(d.total / maxTotal) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}

            {/* Insight box */}

            <div className="p-6 bg-primary/5 border border-primary/10 rounded-3xl">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl flex-shrink-0">
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-text-primary uppercase tracking-tight">Insight Automático</p>
                        <p className="text-xs text-text-muted mt-1 leading-relaxed">
                            {pieData.length > 0
                                ? <>A maior categoria de gasto é <span className="text-primary font-bold">{pieData[0].name}</span>, representando {totalExpensesValue > 0 ? Math.round((pieData[0].value / totalExpensesValue) * 100) : 0}% do total. {saldoFinal < 0 ? `Há um débito de R$ ${Math.abs(saldoFinal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a ser quitado.` : `Há um crédito de R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em caixa.`}</>
                                : 'Nenhuma despesa encontrada para os filtros selecionados.'
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
