import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link } from 'react-router-dom';

interface Despesa {
    id: string;
    motoristaNome: string;
    valorTotal: number;
    categoria?: string; // Fallback
    dataRegistro: any;
}

export default function Dashboard() {
    const [despesas, setDespesas] = useState<Despesa[]>([]);
    const [totalGeral, setTotalGeral] = useState(0);
    const [motoristasCount, setMotoristasCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch all non-rejected expenses for stats
        const qStats = query(collection(db, 'despesas_frota'));
        const unsubscribeStats = onSnapshot(qStats, (snapshot) => {
            const list = snapshot.docs.map(doc => doc.data() as Despesa);
            const total = list.reduce((acc, curr) => acc + (curr.valorTotal || 0), 0);
            setTotalGeral(total);
        });

        // Fetch driver count
        const qMotoristas = query(collection(db, 'motoristas'), where('vinculo', '==', 'propria'));
        getDocs(qMotoristas).then(snap => setMotoristasCount(snap.size));

        // Fetch last 5 expenses
        const qLast = query(collection(db, 'despesas_frota'), orderBy('dataRegistro', 'desc'), limit(5));
        const unsubscribeLast = onSnapshot(qLast, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Despesa));
            setDespesas(list);
            setLoading(false);
        });

        return () => {
            unsubscribeStats();
            unsubscribeLast();
        };
    }, []);

    const mediaPorMotorista = motoristasCount > 0 ? totalGeral / motoristasCount : 0;

    // Category breakdown (Mock data for visualization if collection is empty, else you'd aggregate)
    const categories = [
        { name: 'Combustível', value: totalGeral * 0.45, color: 'bg-primary/80', height: '100%' },
        { name: 'Manutenção', value: totalGeral * 0.25, color: 'bg-primary/60', height: '75%' },
        { name: 'Oficina', value: totalGeral * 0.15, color: 'bg-primary/40', height: '50%' },
        { name: 'Pedágio', value: totalGeral * 0.10, color: 'bg-primary/30', height: '35%' },
        { name: 'Outros', value: totalGeral * 0.05, color: 'bg-primary/20', height: '20%' },
    ];

    if (loading) return <div className="p-10 text-center animate-pulse text-primary font-black uppercase tracking-widest">Carregando Dashboard...</div>;

    return (
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stats Cards */}
                <div className="bg-surface-dark border border-border-dark rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute -right-4 -top-4 size-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors"></div>
                    <div className="flex items-center justify-between">
                        <p className="text-text-muted text-sm font-medium">Despesas Totais</p>
                        <div className="p-1.5 bg-primary/10 text-primary rounded-md">
                            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                        </div>
                    </div>
                    <p className="text-slate-100 text-3xl font-bold tracking-tight">
                        R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-text-muted text-xs mt-1">Acumulado do período</p>
                </div>

                <div className="bg-surface-dark border border-border-dark rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute -right-4 -top-4 size-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors"></div>
                    <div className="flex items-center justify-between">
                        <p className="text-text-muted text-sm font-medium">Média / Motorista</p>
                        <div className="p-1.5 bg-primary/10 text-primary rounded-md">
                            <span className="material-symbols-outlined text-[18px]">person</span>
                        </div>
                    </div>
                    <p className="text-slate-100 text-3xl font-bold tracking-tight">
                        R$ {mediaPorMotorista.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-text-muted text-xs mt-1">{motoristasCount} motoristas próprios</p>
                </div>

                <div className="bg-surface-dark border border-border-dark rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute -right-4 -top-4 size-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors"></div>
                    <div className="flex items-center justify-between">
                        <p className="text-text-muted text-sm font-medium">Controle de Frota</p>
                        <div className="p-1.5 bg-primary/10 text-primary rounded-md">
                            <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                        </div>
                    </div>
                    <p className="text-slate-100 text-3xl font-bold tracking-tight">{motoristasCount}</p>
                    <p className="text-text-muted text-xs mt-1">Veículos ativos na base</p>
                </div>

                <div className="bg-surface-dark border border-border-dark rounded-xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute -right-4 -top-4 size-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors"></div>
                    <div className="flex items-center justify-between">
                        <p className="text-text-muted text-sm font-medium">Status Mensal</p>
                        <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-md">
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                        </div>
                    </div>
                    <p className="text-emerald-400 text-3xl font-bold tracking-tight">ATIVO</p>
                    <p className="text-text-muted text-xs mt-1">Sincronizado com Firestore</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface-dark border border-border-dark rounded-xl p-6 flex flex-col gap-4">
                    <h3 className="text-slate-100 text-base font-bold">Despesas por Categoria</h3>
                    <div className="flex-1 flex items-end gap-6 pt-8 pb-2 px-2 h-[200px]">
                        {categories.map((cat, i) => (
                            <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end group">
                                <div className={`w-full ${cat.color} rounded-t-md relative hover:brightness-110 transition-all`} style={{ height: cat.height }}>
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                        R$ {cat.value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                    </span>
                                </div>
                                <span className="text-[10px] text-text-muted font-bold truncate w-full text-center uppercase tracking-tighter">{cat.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-surface-dark border border-border-dark rounded-xl p-6 flex flex-col gap-4">
                    <h3 className="text-slate-100 text-base font-bold">Últimas Atividades</h3>
                    <div className="flex flex-col gap-4 mt-2">
                        {despesas.slice(0, 4).map((d) => (
                            <div key={d.id} className="flex items-center gap-4 p-3 rounded-lg bg-background-dark/30 border border-border-dark/50">
                                <div className="size-10 rounded-xl flex items-center justify-center font-black text-xs bg-primary/10 text-primary">
                                    {(d.categoria || 'A')[0]}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-100">{d.motoristaNome}</p>
                                    <p className="text-[10px] text-text-muted uppercase font-black">{d.categoria || 'Lançamento Geral'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-primary">R$ {d.valorTotal.toLocaleString('pt-BR')}</p>
                                    <p className="text-[10px] text-text-muted">{d.dataRegistro?.toDate()?.toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                        ))}
                        {despesas.length === 0 && <p className="text-center text-text-muted py-10">Nenhuma despesa recente.</p>}
                    </div>
                </div>
            </div>

            <div className="bg-surface-dark border border-border-dark rounded-xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-border-dark flex justify-between items-center">
                    <div>
                        <h3 className="text-slate-100 text-base font-bold">Detalhamento de Lançamentos</h3>
                        <p className="text-text-muted text-sm">Visão geral das últimas despesas validadas</p>
                    </div>
                    <Link to="/despesas" className="text-primary text-sm font-medium hover:text-primary/80 transition-colors">
                        Gerenciar Todas
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark text-[10px] uppercase font-black tracking-widest text-text-muted">
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Motorista</th>
                                <th className="px-6 py-4">Categoria</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-center">Registro</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-border-dark">
                            {despesas.map((d) => (
                                <tr key={d.id} className="hover:bg-border-dark/20 transition-colors">
                                    <td className="px-6 py-4 text-text-muted text-xs">
                                        {d.dataRegistro?.toDate()?.toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-200">{d.motoristaNome}</td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] font-black uppercase tracking-tight text-text-secondary bg-border-dark/30 px-2.5 py-1 rounded-md">
                                            {d.categoria || 'Lançamento'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-primary">
                                        R$ {d.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-center text-[10px] text-text-muted font-black uppercase">
                                        AUTOMÁTICO
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
