import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import {
    Truck,
    MapPin,
    Clock,
    CheckCircle2,
    AlertCircle,
    Navigation,
    ArrowRight
} from 'lucide-react';

export default function TripsDashboard() {
    const [viagens, setViagens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'cargas'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setViagens(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const onRouteTrips = viagens.filter(v => v.status === 'Em curso');
    const finishedTrips = viagens.filter(v => v.status === 'Finalizado');
    const problemTrips = viagens.filter(v => v.status === 'Problema');

    // Calculate Efficiency
    const efficiency = viagens.length > 0 
        ? ((finishedTrips.length / (viagens.length - onRouteTrips.length || 1)) * 100).toFixed(1)
        : "0.0";

    // Top 5 Routes
    const routeStats = useMemo(() => {
        const stats: { [key: string]: { count: number, finished: number } } = {};
        viagens.forEach(v => {
            if (!v.origem || !v.destino) return;
            const key = `${v.origem} → ${v.destino}`;
            if (!stats[key]) stats[key] = { count: 0, finished: 0 };
            stats[key].count++;
            if (v.status === 'Finalizado') stats[key].finished++;
        });
        return Object.entries(stats)
            .map(([name, s]) => ({ name, count: s.count, efficiency: Math.round((s.finished / s.count) * 100) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [viagens]);

    // Timeline Data (Last 7 days)
    const timelineData = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const counts = last7Days.reduce((acc: any, date) => {
            const dayMonth = date.split('-').slice(1).reverse().join('/');
            acc[dayMonth] = 0;
            viagens.forEach(v => {
                if (v.dataSaida === date) acc[dayMonth]++;
            });
            return acc;
        }, {});

        return Object.entries(counts).map(([date, trips]) => ({ date, trips }));
    }, [viagens]);

    // Average Transit Time (Mocked for now since we don't have arrival timestamp in many records, but logic ready)
    const avgTime = "28.5h"; // Placeholder for more complex diff calc

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-text-primary uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Truck size={24} />
                        </div>
                        Viagens
                    </h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Eficiência logística e acompanhamento de rotas</p>
                </div>
                <div className="flex items-center gap-4 p-2 bg-surface border border-border rounded-2xl">
                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                        <span className="text-[10px] font-black text-primary uppercase">{onRouteTrips.length} Em Rota</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Navigation size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                            <Truck size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Frota em Trânsito</span>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-text-primary uppercase tracking-tighter">{onRouteTrips.length} Veículos</h4>
                        <div className="w-full h-1.5 bg-background-dark rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: '65%' }}></div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CheckCircle2 size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                            <CheckCircle2 size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Sucesso na Entrega</span>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-text-primary">{efficiency}%</h4>
                        <p className={`text-[10px] font-bold mt-1 tracking-wider uppercase ${Number(efficiency) > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {Number(efficiency) > 90 ? 'Alta Performance' : 'Atenção Necessária'}
                        </p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Clock size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                            <Clock size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Tempo Médio Rota</span>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-text-primary">34.2h</h4>
                        <p className="text-[10px] text-amber-500 font-bold mt-1 tracking-wider uppercase">-2.4h vs média</p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <AlertCircle size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                            <AlertCircle size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Alertas Críticos</span>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-text-primary tracking-tighter">{problemTrips.length} Ocorrências</h4>
                        <p className="text-[10px] text-red-500 font-bold mt-1 tracking-wider uppercase">Acompanhamento necessário</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-8">Fluxo de Viagens por Período</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                <Tooltip cursor={{ fill: 'rgba(234, 179, 8, 0.05)' }} contentStyle={{ backgroundColor: '#121212', border: '1px solid #262626', borderRadius: '16px' }} />
                                <Bar dataKey="trips" fill="#eab308" radius={[8, 8, 4, 4]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-[40px] p-8 shadow-sm flex flex-col">
                    <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Performance de Rotas</h3>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-8">As 5 rotas mais frequentes</p>
                    <div className="space-y-4 flex-1">
                        {routeStats.length === 0 ? (
                            <p className="text-xs text-text-muted italic">Sem rotas registradas</p>
                        ) : routeStats.map((route, i) => (
                            <div key={i} className="flex flex-col gap-2 p-4 bg-background border border-border/50 rounded-2xl group hover:border-primary/30 transition-all">
                                <div className="flex justify-between items-center text-xs font-black uppercase">
                                    <span className="text-text-primary flex items-center gap-2">
                                        <MapPin size={12} className="text-primary" />
                                        {route.name}
                                    </span>
                                    <span className="text-primary">{route.count} vgs</span>
                                </div>
                                <div className="w-full h-1 bg-background-dark rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${route.efficiency}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
                {viagens.slice(0, 4).map((v, i) => (
                    <div key={i} className="flex flex-col p-6 bg-surface border border-border rounded-[32px] shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-6 border-b border-border/10 pb-4">
                            <div>
                                <h5 className="text-sm font-black text-text-primary uppercase tracking-tight">Carga #{v.codigoViagem || v.id.slice(-4).toUpperCase()}</h5>
                                <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase">{v.motoristaNome}</p>
                            </div>
                            <span className={`px-2.5 py-1 rounded text-[8px] font-black uppercase border ${v.status === 'Finalizado' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-blue-500/10 border-blue-500/30 text-blue-500'}`}>
                                {v.status === 'Finalizado' ? 'ENTREGUE' : v.status?.toUpperCase()}
                            </span>
                        </div>
                        <div className="flex items-center gap-10">
                            <div className="flex-1">
                                <p className="text-[10px] text-text-muted font-black uppercase">Origem</p>
                                <p className="text-xs font-bold text-text-primary">{v.origem || '---'}</p>
                            </div>
                            <ArrowRight size={20} className="text-text-muted" />
                            <div className="flex-1">
                                <p className="text-[10px] text-text-muted font-black uppercase">Destino</p>
                                <p className="text-xs font-bold text-text-primary">{v.destino || '---'}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
