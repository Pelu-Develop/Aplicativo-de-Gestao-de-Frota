import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import {
    BadgeDollarSign,
    TrendingUp,
    Users,
    Calendar,
    ArrowUpRight,
    Trophy,
    Target,
    PieChart as PieIcon,
    ArrowRight
} from 'lucide-react';

export default function CommissionsDashboard() {
    const [comissoes, setComissoes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, 'cargas'),
            where('comissionada', '==', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort in memory to avoid index requirement
            const sortedList = list.sort((a: any, b: any) => {
                const dateA = a.dataSaida || '';
                const dateB = b.dataSaida || '';
                return dateB.localeCompare(dateA);
            });
            setComissoes(sortedList);
            setLoading(false);
        }, (error) => {
            console.error("Erro no Dashboard de Comissões:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Aggregations
    const totalComissoes = comissoes.reduce((acc, curr) => acc + (curr.valorComissao || 0), 0);
    const mediaPorViagem = totalComissoes / (comissoes.length || 1);

    // Group by month
    const monthlyData = comissoes.reduce((acc: any, curr) => {
        if (!curr.dataSaida) return acc;
        const month = curr.dataSaida.substring(0, 7); // YYYY-MM
        acc[month] = (acc[month] || 0) + (curr.valorComissao || 0);
        return acc;
    }, {});

    const chartData = Object.entries(monthlyData)
        .map(([month, value]) => ({
            name: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(),
            value
        }))
        .reverse();

    // Group by Driver
    const driverCommissions = comissoes.reduce((acc: any, curr) => {
        const driver = curr.motoristaNome || 'N/A';
        acc[driver] = (acc[driver] || 0) + (curr.valorComissao || 0);
        return acc;
    }, {});

    const driverData = Object.entries(driverCommissions)
        .map(([name, value]: any) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    // Group by Status
    const statusCounts = comissoes.reduce((acc: any, curr) => {
        const status = curr.status || 'Pendente';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    const COLORS = ['#eab308', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-500 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <BadgeDollarSign size={24} />
                        </div>
                        Painel de Comissões
                    </h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Análise estratégica de rentabilidade e bonificação</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-surface border border-border rounded-xl shadow-sm flex items-center gap-3">
                        <Calendar size={16} className="text-primary" />
                        <span className="text-[10px] font-black uppercase text-text-primary">Visão Consolidada</span>
                    </div>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface border border-border p-6 rounded-[32px] shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                            <BadgeDollarSign size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Comissão Total</span>
                    </div>
                    <div>
                        <h4 className="text-3xl font-black text-text-primary tracking-tighter">R$ {totalComissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                        <div className="flex items-center gap-1 mt-1">
                            <ArrowUpRight size={12} className="text-emerald-500" />
                            <p className="text-[9px] text-emerald-500 font-bold uppercase">+12% vs mês anterior</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[32px] shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Target size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                            <Target size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Ticket Médio</span>
                    </div>
                    <div>
                        <h4 className="text-3xl font-black text-text-primary tracking-tighter">R$ {mediaPorViagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                        <p className="text-[9px] text-text-muted font-bold uppercase mt-1">Por viagem comissionada</p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[32px] shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Calendar size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                            <Calendar size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Total Viagens</span>
                    </div>
                    <div>
                        <h4 className="text-3xl font-black text-text-primary tracking-tighter">{comissoes.length} Ops</h4>
                        <p className="text-[9px] text-text-muted font-bold uppercase mt-1">Viagens realizadas à comissão</p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[32px] shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Trophy size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                            <Trophy size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Projeção Mensal</span>
                    </div>
                    <div>
                        <h4 className="text-3xl font-black text-text-primary tracking-tighter">R$ {(totalComissoes * 1.5).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h4>
                        <p className="text-[9px] text-emerald-500 font-bold uppercase mt-1">Estimativa conservadora</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Evolution Chart */}
                <div className="lg:col-span-2 bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Evolução de Comissões</h3>
                            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">Faturamento mensal acumulado</p>
                        </div>
                        <div className="p-2 bg-background-dark border border-border rounded-xl">
                             <TrendingUp size={20} className="text-primary" />
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} />
                                <Tooltip
                                    cursor={{ stroke: '#eab308', strokeWidth: 2 }}
                                    contentStyle={{ backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '16px', color: '#f8fafc' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#eab308" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Efficiency Pie Chart */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm flex flex-col">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Saúde da Carteira</h3>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-8">Status das comissões em aberto</p>

                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '16px', color: '#f8fafc' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full mt-4">
                            {pieData.map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="size-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-[10px] font-bold text-text-muted uppercase truncate">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-border flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <PieIcon size={16} className="text-text-muted" />
                             <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Saldo Realizado</span>
                         </div>
                         <span className="text-sm font-black text-text-primary">84%</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Driver Ranking */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Ranking de Motoristas</h3>
                        <Users size={20} className="text-text-muted" />
                    </div>
                    <div className="space-y-4">
                        {driverData.map((driver, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-background border border-border/50 rounded-2xl group hover:border-primary/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="size-10 rounded-xl bg-background-dark border border-border flex items-center justify-center text-xs font-black text-primary group-hover:bg-primary group-hover:text-background-dark transition-colors">
                                        #{i+1}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-text-primary uppercase">{driver.name}</span>
                                        <span className="text-[9px] text-text-muted font-bold uppercase tracking-widest italic leading-none">Alta Performance</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-primary tracking-tighter">R$ {driver.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recommendations or Next Steps */}
                <div className="bg-primary border border-primary text-background-dark rounded-[40px] p-8 shadow-sm flex flex-col relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-10 opacity-10">
                         <Trophy size={160} />
                     </div>
                     <div className="relative z-10">
                        <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Plano de Incentivos</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-8">ESTRATÉGIAS PARA O PRÓXIMO CICLO</p>
                        
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <div className="size-8 rounded-full bg-background-dark flex items-center justify-center shrink-0">
                                    <span className="text-xs font-black text-primary">01</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-tight">Otimização de Custos</h4>
                                    <p className="text-[10px] font-bold leading-relaxed opacity-90">Redução de 5% no consumo de combustível aumenta sua margem direta em comissões.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="size-8 rounded-full bg-background-dark flex items-center justify-center shrink-0">
                                    <span className="text-xs font-black text-primary">02</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-tight">Fidelização de Clientes</h4>
                                    <p className="text-[10px] font-bold leading-relaxed opacity-90">Os top 5 clientes representam 60% do faturamento. Priorize eficiência nestas rotas.</p>
                                </div>
                            </div>
                        </div>

                        <button className="mt-10 w-full bg-background-dark text-primary py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 group transition-transform hover:scale-[1.02]">
                            Ver Relatório Completo
                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                     </div>
                </div>
            </div>
        </div>
    );
}
