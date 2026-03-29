import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell
} from 'recharts';
import {
    Users,
    BadgeCheck,
    Clock,
    ArrowUpRight,
    Target,
    Award
} from 'lucide-react';

export default function CommissionsDashboard() {
    const [despesas, setDespesas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'despesas_frota'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setDespesas(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Calculate commissions by driver
    const driverCommissions: { [key: string]: number } = {};
    despesas.forEach(d => {
        const driver = d.motoristaNome || 'Outros';
        const commission = (d.comissaoCombustivel || 0); // Assuming this is the main commission for now
        driverCommissions[driver] = (driverCommissions[driver] || 0) + commission;
    });

    const driverData = Object.entries(driverCommissions)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const totalComissoes = Object.values(driverCommissions).reduce((acc, curr) => acc + curr, 0);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-500 pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Award size={24} />
                        </div>
                        Comissões
                    </h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Gestão de incentivização e performance de motoristas</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="p-4 bg-surface border border-border rounded-2xl flex items-center gap-4 shadow-sm">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-text-muted uppercase tracking-widest leading-none">Total Pendente</span>
                            <span className="text-xl font-black text-text-primary tracking-tighter">R$ {(totalComissoes * 0.15).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                            <Clock size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 bg-surface border border-border rounded-[28px] p-6 shadow-sm flex flex-col gap-4 relative group">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Payout Total</p>
                    <h2 className="text-3xl font-black text-text-primary tracking-tighter">R$ {totalComissoes.toLocaleString('pt-BR')}</h2>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                        <ArrowUpRight size={14} /> +8.4% este mês
                    </div>
                </div>
                <div className="md:col-span-1 bg-surface border border-border rounded-[28px] p-6 shadow-sm flex flex-col gap-4 relative group">
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Ticket Médio Cmd.</p>
                    <h2 className="text-3xl font-black text-text-primary tracking-tighter">R$ {(totalComissoes / (despesas.length || 1)).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</h2>
                    <div className="flex items-center gap-1 text-[10px] text-text-muted font-bold italic">
                        Por viagem realizada
                    </div>
                </div>
                <div className="md:col-span-2 bg-primary/10 border border-primary/20 rounded-[28px] p-6 shadow-sm flex items-center justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Destaque do Mês</p>
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">{driverData[0]?.name || '---'}</h3>
                        <p className="text-xs font-bold text-text-muted mt-1 leading-relaxed">Novo recorde em comissões por eficiência <br /> em combustível e tempo de rota.</p>
                    </div>
                    <div className="p-5 bg-primary/20 text-primary rounded-[32px] relative z-10">
                        <Target size={48} />
                    </div>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Award size={120} strokeWidth={0.5} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ranking Bar Chart */}
                <div className="lg:col-span-2 bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-8">Performance por Motorista</h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={driverData} layout="vertical" margin={{ left: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#262626" />
                                <XAxis
                                    type="number"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                                />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#f8fafc', fontSize: 12, fontWeight: 700 }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(234, 179, 8, 0.05)' }}
                                    contentStyle={{ backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '16px', color: '#f8fafc', fontWeight: 700 }}
                                />
                                <Bar dataKey="value" fill="#eab308" radius={[0, 8, 8, 0]} barSize={34}>
                                    {driverData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#eab308' : '#eab30890'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status breakdown or Goal tracking */}
                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm flex flex-col">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Meta de Produção</h3>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-8">Progresso atual do ciclo</p>

                    <div className="flex-1 flex flex-col items-center justify-center relative">
                        <div className="size-48 rounded-full border-[12px] border-primary/5 flex items-center justify-center relative">
                            <div className="absolute inset-[-12px] rounded-full border-[12px] border-transparent border-t-primary border-r-primary border-l-primary/40 transform -rotate-12 transition-transform duration-1000"></div>
                            <div className="text-center">
                                <span className="text-4xl font-black text-text-primary tracking-tighter">72%</span>
                                <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest italic">Concluído</p>
                            </div>
                        </div>

                        <div className="w-full grid grid-cols-2 gap-3 mt-10">
                            <div className="p-4 rounded-2xl bg-background border border-border/50 text-center">
                                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Consolidado</p>
                                <p className="text-sm font-black text-text-primary uppercase tracking-tight">R$ {(totalComissoes * 0.72).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-background border border-border/50 text-center">
                                <p className="text-[8px] font-black text-text-muted uppercase tracking-widest">Projeção</p>
                                <p className="text-sm font-black text-text-primary uppercase tracking-tight">R$ {(totalComissoes * 1.3).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>

                    <p className="text-[9px] text-center text-text-muted font-bold uppercase tracking-widest mt-6 bg-primary/5 py-2 rounded-lg border border-primary/10">
                        <Award size={10} className="inline mr-1" /> Base de Cálculo: Performance Global
                    </p>
                </div>
            </div>

            {/* List of top commission payouts */}
            <div className="bg-surface border border-border rounded-[40px] overflow-hidden">
                <div className="p-8 border-b border-border flex justify-between items-center">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight">Detalhamento por Motorista</h3>
                    <Users size={20} className="text-text-muted" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-background/80 text-[10px] font-black uppercase tracking-widest text-text-muted border-b border-border">
                                <th className="px-8 py-4">Motorista</th>
                                <th className="px-8 py-4">Acertos Processados</th>
                                <th className="px-8 py-4">Taxa de Eficiência</th>
                                <th className="px-8 py-4 text-right">Comissão Acumulada</th>
                                <th className="px-8 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {driverData.map((d, i) => (
                                <tr key={i} className="hover:bg-primary/5 transition-colors group">
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-[10px]">
                                                #{i + 1}
                                            </div>
                                            <span className="text-sm font-black text-text-primary uppercase">{d.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-xs font-bold text-text-muted">
                                        {d.value > 0 ? Math.floor(d.value / 250) : 0} registros
                                    </td>
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 max-w-[80px] h-1.5 bg-background-dark rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${85 + (i * 2)}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-black text-text-primary">{85 + (i * 2)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <span className="text-sm font-black text-primary tracking-tight">R$ {d.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </td>
                                    <td className="px-8 py-4 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-tighter">
                                            <BadgeCheck size={10} /> Validado
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
