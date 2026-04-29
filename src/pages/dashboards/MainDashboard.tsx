import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import {
    TrendingUp,
    DollarSign,
    Truck,
    Users,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Calendar,
    ChevronRight,
    LayoutDashboard
} from 'lucide-react';

export default function MainDashboard() {
    const [despesas, setDespesas] = useState<any[]>([]);
    const [viagens, setViagens] = useState<any[]>([]);
    const [motoristasCount, setMotoristasCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const qDespesas = query(collection(db, 'despesas_frota'));
        const unsubDespesas = onSnapshot(qDespesas, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDespesas(list);
        });

        const qViagens = query(collection(db, 'cargas'));
        const unsubViagens = onSnapshot(qViagens, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setViagens(list);
            setLoading(false);
        });

        const qMotoristas = query(collection(db, 'motoristas'), where('vinculo', '==', 'propria'));
        getDocs(qMotoristas).then(snap => setMotoristasCount(snap.size));

        return () => {
            unsubDespesas();
            unsubViagens();
        };
    }, []);

    // Process data for charts
    const totalDespesas = despesas.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
    const totalReceita = viagens.reduce((acc, curr) => acc + (Number(curr.valorFrete) || 0), 0);
    const pendingCount = despesas.filter(d => d.status === 'pendente').length;
    
    const finishedViagens = viagens.filter(v => v.status === 'Finalizado');
    const eficienciaGlobal = viagens.length > 0 ? ((finishedViagens.length / viagens.length) * 100).toFixed(1) : "0.0";

    // Monthly data aggregation (Revenue vs Costs)
    const monthlyData = useMemo(() => {
        const months: { [key: string]: { name: string, revenue: number, costs: number } } = {};
        
        // Use last 6 months
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = d.toISOString().substring(0, 7); // YYYY-MM
            const name = d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
            months[key] = { name, revenue: 0, costs: 0 };
        }

        viagens.forEach(v => {
            const date = v.dataSaida || '';
            const key = date.substring(0, 7);
            if (months[key]) {
                months[key].revenue += (Number(v.valorFrete) || 0);
            }
        });

        despesas.forEach(d => {
            const dateObj = d.dataRegistro?.toDate ? d.dataRegistro.toDate() : new Date(d.dataRegistro || d.dataInicio);
            const key = dateObj.toISOString().substring(0, 7);
            if (months[key]) {
                months[key].costs += (Number(d.valorTotal) || 0);
            }
        });

        return Object.values(months);
    }, [viagens, despesas]);

    // Status distribution for Pie Chart
    const statusData = [
        { name: 'Finalizado', value: despesas.filter(d => d.status === 'finalizado').length, color: '#eab308' },
        { name: 'Pendente', value: pendingCount, color: '#64748b' },
    ];

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-text-muted font-black uppercase tracking-[0.2em] animate-pulse">Sincronizando Dados...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header / Search */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <LayoutDashboard size={24} />
                        </div>
                        Geral
                    </h1>
                    <p className="text-text-muted text-xs font-bold uppercase tracking-widest mt-1">Visão 360º da Frota Golden Transportes</p>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar no sistema..."
                            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2 text-sm focus:border-primary outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Receita Total', value: `R$ ${totalReceita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', trend: 'Acumulado', isUp: true },
                    { label: 'Custos da Frota', value: `R$ ${totalDespesas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', trend: 'Total Despesas', isUp: false },
                    { label: 'Viagens Ativas', value: viagens.filter(v => v.status === 'Em curso').length.toString(), icon: Truck, color: 'text-blue-500', bg: 'bg-blue-500/10', trend: 'Em curso', isUp: null },
                    { label: 'Eficiência Frota', value: `${eficienciaGlobal}%`, icon: Users, color: 'text-amber-500', bg: 'bg-amber-500/10', trend: 'Finalizadas', isUp: true },
                ].map((stat, i) => (
                    <div key={i} className="bg-surface border border-border rounded-[32px] p-6 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all cursor-pointer group overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <stat.icon size={80} strokeWidth={1} />
                        </div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl`}>
                                <stat.icon size={20} />
                            </div>
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <div className="flex items-end justify-between">
                            <h2 className="text-2xl font-black text-text-primary tracking-tight">{stat.value}</h2>
                            {stat.trend && (
                                <div className={`flex items-center text-[10px] font-bold px-2 py-1 rounded-lg ${stat.isUp ? 'bg-emerald-500/10 text-emerald-500' : stat.isUp === false ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-500'}`}>
                                    {stat.isUp ? <ArrowUpRight size={12} className="mr-1" /> : stat.isUp === false ? <ArrowDownRight size={12} className="mr-1" /> : null}
                                    {stat.trend}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Performance Chart */}
                <div className="lg:col-span-2 bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Custos vs Receita</h3>
                            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Comparativo mensal consolidado</p>
                        </div>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 rounded-lg bg-surface border border-border text-[10px] font-black text-text-muted hover:text-primary transition-colors uppercase tracking-widest">30 Dias</button>
                            <button className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest">90 Dias</button>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                                    tickFormatter={(v) => `R$ ${v / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '16px', color: '#f8fafc', fontWeight: 700 }}
                                    itemStyle={{ color: '#eab308' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#10b981"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                    name="Receita"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="costs"
                                    stroke="#eab308"
                                    strokeWidth={4}
                                    fillOpacity={0.1}
                                    name="Custos"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Allocation */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm flex flex-col">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Status dos Acertos</h3>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-8">Processamento de despesas</p>

                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-[200px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-3xl font-black text-text-primary">{despesas.length}</span>
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total</span>
                            </div>
                        </div>

                        <div className="w-full space-y-3 mt-6">
                            {statusData.map((s, i) => (
                                <div key={i} className="flex items-center justify-between text-xs p-3 rounded-2xl bg-background border border-border/50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                                        <span className="font-bold text-text-secondary">{s.name}</span>
                                    </div>
                                    <span className="font-black text-text-primary">{s.value} ({despesas.length > 0 ? Math.round((s.value / despesas.length) * 100) : 0}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Driver Leaderboard or Active List */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Atividade Recente</h3>
                        <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-1">
                            Ver Tudo <ChevronRight size={14} />
                        </button>
                    </div>
                    <div className="space-y-4">
                        {despesas.slice(0, 5).map((d, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-3xl bg-background border border-border/50 hover:border-primary/30 transition-all group">
                                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                                    {String(d.motoristaNome || '').charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-black text-text-primary">{d.motoristaNome}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-text-muted font-bold uppercase tracking-wider">
                                        <Clock size={12} /> {(() => {
                                            if (!d.dataRegistro) return 'Pendente';
                                            try {
                                                const date = typeof d.dataRegistro.toDate === 'function' ? d.dataRegistro.toDate() : new Date(d.dataRegistro);
                                                return isNaN(date.getTime()) ? 'Data Inválida' : date.toLocaleDateString('pt-BR');
                                            } catch (e) {
                                                return 'Data Inválida';
                                            }
                                        })()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-primary">R$ {(d.valorTotal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${d.status === 'finalizado' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-slate-500/10 border-slate-500/30 text-slate-500'} uppercase`}>
                                        {d.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Integration Status / System Info */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-20 -bottom-20 size-80 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-8">Status do Ecossistema</h3>

                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="p-6 bg-background border border-border rounded-3xl flex flex-col gap-2">
                            <Truck className="text-primary mb-2" size={24} />
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Base de Dados</p>
                            <p className="text-lg font-black text-text-primary uppercase">Firestore Online</p>
                            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                Operacional
                            </div>
                        </div>
                        <div className="p-6 bg-background border border-border rounded-3xl flex flex-col gap-2">
                            <Users className="text-primary mb-2" size={24} />
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Motoristas Ativos</p>
                            <p className="text-lg font-black text-text-primary">{motoristasCount}</p>
                            <div className="flex items-center gap-1 text-[10px] text-primary font-bold">
                                100% Sincronizado
                            </div>
                        </div>
                        <div className="p-6 bg-background border border-border rounded-3xl flex flex-col gap-2">
                            <Calendar className="text-primary mb-2" size={24} />
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Ciclo Atual</p>
                            <p className="text-lg font-black text-text-primary uppercase">{new Date().toLocaleDateString('pt-BR', { month: 'long' })}</p>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted font-bold">
                                {new Date().getFullYear()}
                            </div>
                        </div>
                        <div className="p-6 bg-primary text-background-dark rounded-3xl flex flex-col gap-2 shadow-lg shadow-primary/20">
                            <TrendingUp className="text-background-dark/80 mb-2" size={24} />
                            <p className="text-[10px] font-black text-background-dark/60 uppercase tracking-widest">Viagens Totais</p>
                            <p className="text-lg font-black">{viagens.length} viagens</p>
                            <p className="text-[10px] font-bold">Base Golden</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
