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

    const finishedTrips = despesas.filter(d => d.status === 'finalizado');
    const onRouteTrips = despesas.filter(d => d.status === 'pendente');

    const routeData = [
        { name: 'SP → RJ', count: 12, efficiency: 95 },
        { name: 'MG → ES', count: 8, efficiency: 88 },
        { name: 'PR → SC', count: 15, efficiency: 92 },
        { name: 'RS → MS', count: 5, efficiency: 85 },
        { name: 'GO → DF', count: 10, efficiency: 94 },
    ];

    const timelineData = [
        { date: '01/03', trips: 4 },
        { date: '02/03', trips: 7 },
        { date: '03/03', trips: 5 },
        { date: '04/03', trips: 9 },
        { date: '05/03', trips: 6 },
    ];

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
                        <h4 className="text-2xl font-black text-text-primary">99.4%</h4>
                        <p className="text-[10px] text-emerald-500 font-bold mt-1 tracking-wider uppercase">Alta Performance</p>
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
                        <h4 className="text-2xl font-black text-text-primary tracking-tighter">03 Ocorrências</h4>
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
                        {routeData.map((route, i) => (
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
                {despesas.slice(0, 4).map((d, i) => (
                    <div key={i} className="flex flex-col p-6 bg-surface border border-border rounded-[32px] shadow-sm relative overflow-hidden group">
                        <div className="flex justify-between items-start mb-6 border-b border-border/10 pb-4">
                            <div>
                                <h5 className="text-sm font-black text-text-primary uppercase tracking-tight">Carga #{d.id.slice(-4).toUpperCase()}</h5>
                                <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase">{d.motoristaNome}</p>
                            </div>
                            <span className={`px-2.5 py-1 rounded text-[8px] font-black uppercase border ${d.status === 'finalizado' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-blue-500/10 border-blue-500/30 text-blue-500'}`}>
                                {d.status === 'finalizado' ? 'ENTREGUE' : 'EM ROTA'}
                            </span>
                        </div>
                        <div className="flex items-center gap-10">
                            <div className="flex-1">
                                <p className="text-[10px] text-text-muted font-black uppercase">Origem</p>
                                <p className="text-xs font-bold text-text-primary">São Paulo, SP</p>
                            </div>
                            <ArrowRight size={20} className="text-text-muted" />
                            <div className="flex-1">
                                <p className="text-[10px] text-text-muted font-black uppercase">Destino</p>
                                <p className="text-xs font-bold text-text-primary">Vitória, ES</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
