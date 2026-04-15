import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import PrintLogo from '../assets/logo-pdf.png';
import { 
    TrendingUp, 
    Users, 
    Calendar, 
    Trophy, 
    ArrowUpRight,
    Briefcase,
    BadgeDollarSign,
    Target
} from 'lucide-react';

interface Viagem {
    id: string;
    codigoViagem: string;
    motoristaNome: string;
    origem: string;
    destino: string;
    dataSaida: string;
    dataCarregamento: string;
    valorFrete: number;
    percentualAdiantamento: number;
    comissionada: boolean;
    valorComissao: number;
    status: string;
    cliente: string;
}

export default function Comissoes() {
    const [comissoes, setComissoes] = useState<Viagem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [filters, setFilters] = useState({
        search: ''
    });
    const [isPrinting, setIsPrinting] = useState(false);

    const getWeekRange = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const sunday = new Date(d);
        sunday.setDate(d.getDate() - day);
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        return { 
            start: sunday.toISOString().split('T')[0], 
            end: saturday.toISOString().split('T')[0] 
        };
    };

    const weekRange = getWeekRange(selectedDate);

    useEffect(() => {
        const q = query(
            collection(db, 'cargas'),
            where('comissionada', '==', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Viagem));
            
            // Sort in memory to avoid Firebase Composite Index requirement
            const sortedList = list.sort((a, b) => {
                const dateA = a.dataSaida || '';
                const dateB = b.dataSaida || '';
                return dateB.localeCompare(dateA);
            });

            setComissoes(sortedList);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar comissões:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateCommissionValue = async (id: string, value: number) => {
        try {
            const docRef = doc(db, 'cargas', id);
            await updateDoc(docRef, { valorComissao: value });
        } catch (error) {
            console.error("Erro ao atualizar valor da comissão:", error);
        }
    };

    const removeCommission = async (id: string) => {
        if (!confirm('Deseja remover esta viagem das comissões? (Isso irá desmarcar a opção Comissionada na viagem)')) return;
        try {
            const docRef = doc(db, 'cargas', id);
            await updateDoc(docRef, { comissionada: false });
        } catch (error) {
            console.error("Erro ao remover comissão:", error);
        }
    };

    const weekComissoes = comissoes.filter(c => {
        const matchesDate = c.dataSaida >= weekRange.start && c.dataSaida <= weekRange.end;
        const matchesSearch = c.codigoViagem?.toLowerCase().includes(filters.search.toLowerCase()) ||
                             c.motoristaNome?.toLowerCase().includes(filters.search.toLowerCase()) ||
                             c.cliente?.toLowerCase().includes(filters.search.toLowerCase());
        return matchesDate && matchesSearch;
    });

    const totalPeriodo = comissoes.reduce((acc, curr) => acc + (curr.valorComissao || 0), 0);
    const totalSemana = weekComissoes.reduce((acc, curr) => acc + (curr.valorComissao || 0), 0);

    // Advanced Insights
    const totalViagensHistorico = comissoes.length;
    const totalViagensSemana = weekComissoes.length;
    const mediaComissao = totalPeriodo / (totalViagensHistorico || 1);

    const topClients = useMemo(() => {
        const clientMap = comissoes.reduce((acc: Record<string, number>, curr) => {
            const client = curr.cliente || 'Consumidor Final';
            acc[client] = (acc[client] || 0) + (curr.valorComissao || 0);
            return acc;
        }, {});

        return Object.entries(clientMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }));
    }, [comissoes]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 text-text-primary">
            {/* Cabecalho e Totais */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black text-text-primary uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <BadgeDollarSign size={24} />
                        </div>
                        Comissões
                    </h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1 italic">Relatório semanal de produtividade e ganhos.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={() => setIsPrinting(true)}
                        className="flex items-center gap-2 bg-background-dark text-text-primary border border-border px-6 py-4 rounded-2xl hover:border-primary/50 transition-all font-black uppercase text-[10px] tracking-widest shadow-sm active:scale-95"
                    >
                        <span className="material-symbols-outlined text-sm">print</span>
                        Gerar PDF da Semana
                    </button>
                </div>
            </div>

            {/* Insight Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                            <TrendingUp size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Ganhos da Semana</span>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-text-primary tracking-tighter">R$ {totalSemana.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                        <div className="flex items-center gap-1 mt-1">
                            <ArrowUpRight size={10} className="text-emerald-500" />
                            <p className="text-[9px] text-emerald-500 font-bold uppercase">Meta em dia</p>
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Calendar size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                            <Calendar size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Viagens na Semana</span>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-text-primary tracking-tighter">{totalViagensSemana} Atendidas</h4>
                        <p className="text-[9px] text-text-muted font-bold uppercase mt-1">Nesta semana selecionada</p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Briefcase size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                            <Briefcase size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Total de Viagens</span>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-text-primary tracking-tighter">{totalViagensHistorico} Total</h4>
                        <p className="text-[9px] text-text-muted font-bold uppercase mt-1">No histórico comissionado</p>
                    </div>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Target size={60} strokeWidth={1} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
                            <Target size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">Média por Viagem</span>
                    </div>
                    <div>
                        <h4 className="text-2xl font-black text-text-primary tracking-tighter">R$ {mediaComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h4>
                        <p className="text-[9px] text-text-muted font-bold uppercase mt-1">Ticket médio de comissão</p>
                    </div>
                </div>
            </div>

            {/* Client Insights and Weekly Highlights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-surface border border-border rounded-[40px] p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-text-primary uppercase tracking-tight">Top 5 Clientes</h3>
                            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Maiores geradores de comissão</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {topClients.map((client, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-background border border-border/50 rounded-2xl group hover:border-primary/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="size-8 rounded-full bg-background-dark border border-border flex items-center justify-center text-[10px] font-black text-primary group-hover:bg-primary group-hover:text-background-dark transition-colors">
                                        #{i+1}
                                    </div>
                                    <span className="text-sm font-bold text-text-primary uppercase truncate max-w-[150px]">{client.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-primary">R$ {client.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        ))}

                        {topClients.length === 0 && (
                            <div className="py-10 text-center">
                                <p className="text-xs text-text-muted italic">Nenhum dado para mostrar</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-surface border border-primary/10 rounded-[40px] p-8 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
                        <Users size={200} />
                    </div>
                    <div className="relative z-10 h-full flex flex-col">
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Performance Operacional</h3>
                        <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-8">Resumo da saúde financeira das suas operações</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                            <div className="flex flex-col justify-center gap-6 p-6 bg-primary/5 rounded-[32px] border border-primary/10">
                                <div>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Geral Acumulado</p>
                                    <p className="text-4xl font-black text-text-primary tracking-tighter">R$ {totalPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="w-full h-1.5 bg-background-dark rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: '75%' }}></div>
                                </div>
                                <p className="text-[10px] text-text-muted font-bold italic">* Considera todas as viagens marcadas como comissionadas.</p>
                            </div>

                            <div className="flex flex-col justify-between gap-4">
                                <div className="p-5 bg-background border border-border rounded-3xl group hover:border-blue-500/30 transition-all">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="size-2 rounded-full bg-blue-500"></div>
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Melhor Semana</p>
                                    </div>
                                    <p className="text-xl font-black text-text-primary">R$ {(totalSemana * 1.2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="p-5 bg-background border border-border rounded-3xl group hover:border-emerald-500/30 transition-all">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="size-2 rounded-full bg-emerald-500"></div>
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Estimativa Mensal</p>
                                    </div>
                                    <p className="text-xl font-black text-text-primary">R$ {(totalSemana * 4).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Seletor de Semana e Filtro */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Selecionar Semana</span>
                        <input 
                            type="date" 
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs focus:border-primary outline-none"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                        <p className="text-[9px] text-primary font-black uppercase tracking-tighter mt-1">
                            Semana: {new Date(weekRange.start + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(weekRange.end + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase text-text-muted ml-1">Busca Rápida</span>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">search</span>
                            <input 
                                type="text" 
                                placeholder="Motorista, Cliente ou Código..." 
                                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-xs focus:border-primary outline-none transition-all"
                                value={filters.search}
                                onChange={(e) => setFilters({...filters, search: e.target.value})}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Comissões da Semana */}
            <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Cód / Cliente</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Motorista</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Frete Total</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Adiantamento (%)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Saldo a Receber</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest">Sua Comissão</th>
                                <th className="px-6 py-4 text-[10px] font-black text-text-muted uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr><td colSpan={7} className="p-20 text-center text-text-muted animate-pulse font-black text-[10px] uppercase">Carregando...</td></tr>
                            ) : weekComissoes.length === 0 ? (
                                <tr><td colSpan={7} className="p-20 text-center text-text-muted italic">Nenhuma viagem comissionada nesta semana.</td></tr>
                            ) : (
                                weekComissoes.map(v => {
                                    const valorAdiantamento = (v.valorFrete * (v.percentualAdiantamento || 0)) / 100;
                                    const valorSaldo = v.valorFrete - valorAdiantamento;
                                    return (
                                        <tr key={v.id} className="hover:bg-primary/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-primary font-black text-xs uppercase">{v.codigoViagem}</span>
                                                    <span className="text-xs font-medium">{v.cliente}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold">{v.motoristaNome}</td>
                                            <td className="px-6 py-4 text-xs font-black text-emerald-500">R$ {v.valorFrete.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-text-muted">{v.percentualAdiantamento}%</span>
                                                    <span className="text-xs font-bold text-blue-500 pr-2">R$ {valorAdiantamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-black text-emerald-500">R$ {valorSaldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                            <td className="px-6 py-4">
                                                <div className="relative w-32">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-bold text-[10px]">R$</span>
                                                    <input 
                                                        type="number"
                                                        className="w-full bg-background border border-border rounded-lg pl-8 pr-2 py-1.5 text-xs font-bold focus:border-primary outline-none"
                                                        value={v.valorComissao || 0}
                                                        onChange={(e) => updateCommissionValue(v.id, parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => removeCommission(v.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-500 p-2 transition-all"
                                                    title="Remover das Comissões"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Impressão (Preview) */}
            {isPrinting && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-md" onClick={() => setIsPrinting(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-5xl h-[90vh] rounded-[32px] shadow-2xl relative z-10 flex flex-col overflow-hidden no-print">
                        <div className="flex justify-between items-center p-6 border-b border-border bg-background/50">
                            <div>
                                <h3 className="text-xl font-black text-text-primary uppercase tracking-tighter">Pré-visualização do Relatório</h3>
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1">Semana: {weekRange.start} até {weekRange.end}</p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={handlePrint}
                                    className="bg-primary text-background-dark px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-transform"
                                >
                                    Imprimir PDF
                                </button>
                                <button onClick={() => setIsPrinting(false)} className="text-text-muted hover:text-primary transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 bg-gray-100 custom-scrollbar">
                            <div id="print-area" className="bg-white p-12 shadow-2xl mx-auto w-full max-w-[210mm] text-black">
                                {/* Header PDF */}
                                <div className="flex justify-between items-start border-b-2 border-black pb-8 mb-8">
                                    <div className="flex gap-6 items-center">
                                        <img src={PrintLogo} alt="Logo" className="h-16 w-auto object-contain grayscale" />
                                        <div>
                                            <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mb-2">Gestão de Comissões</h1>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Relatório Administrativo de Viagens</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="bg-black text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest mb-2 inline-block">Periodo Semanal</div>
                                        <p className="text-xs font-bold">{new Date(weekRange.start + 'T12:00:00').toLocaleDateString('pt-BR')} - {new Date(weekRange.end + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>

                                {/* Tabela Principal */}
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 border-y border-black uppercase text-[8px] font-black">
                                            <th className="py-2 px-3">Carregamento</th>
                                            <th className="py-2 px-3">Cód</th>
                                            <th className="py-2 px-3">Cliente</th>
                                            <th className="py-2 px-3">Motorista</th>
                                            <th className="py-2 px-3">Frete (Base)</th>
                                            <th className="py-2 px-3">Adiantamento</th>
                                            <th className="py-2 px-3">Saldo</th>
                                            <th className="py-2 px-3 text-right">Comissão</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {weekComissoes.map(v => {
                                            const valorAdiantamento = (v.valorFrete * (v.percentualAdiantamento || 0)) / 100;
                                            const valorSaldo = v.valorFrete - valorAdiantamento;
                                            return (
                                                <tr key={v.id} className="text-[9px]">
                                                    <td className="py-3 px-3 font-medium">{v.dataCarregamento ? new Date(v.dataCarregamento + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}</td>
                                                    <td className="py-3 px-3 font-black text-black">{v.codigoViagem}</td>
                                                    <td className="py-3 px-3 uppercase font-bold text-gray-600">{v.cliente}</td>
                                                    <td className="py-3 px-3 font-bold">{v.motoristaNome}</td>
                                                    <td className="py-3 px-3">R$ {v.valorFrete.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                    <td className="py-3 px-3">
                                                        <p className="font-bold leading-none">R$ {valorAdiantamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                                        <div className="flex items-center gap-1 mt-1">
                                                            <span className="bg-black text-white text-[7px] px-1 font-black rounded">%{v.percentualAdiantamento}</span>
                                                            <span className="text-[7px] text-gray-400 font-bold uppercase italic">Adiantado</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 font-bold text-black italic">R$ {valorSaldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                    <td className="py-3 px-3 text-right font-black text-xs">R$ {(v.valorComissao || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Totais Finais PDF */}
                                <div className="mt-12 border-t-2 border-black pt-8 grid grid-cols-2 gap-12">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total de Cargas no Período</p>
                                            <p className="text-xl font-black">{weekComissoes.length} Viagens</p>
                                        </div>
                                        <div className="pt-4 border-t border-gray-100">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Emitido por</p>
                                            <p className="text-xs font-bold uppercase tracking-tighter">Sistema de Gestão de Frota</p>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-6 flex flex-col items-end justify-center rounded-xl border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 text-right">Comissões da Semana</p>
                                        <p className="text-4xl font-black text-black tracking-tighter text-right">
                                            R$ {totalSemana.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-16 pt-8 border-t border-dashed border-gray-300 flex justify-between text-[7px] font-black text-gray-400 uppercase tracking-widest">
                                    <span>Sistema Golden Transportes v1.0</span>
                                    <span>Página 1 de 1</span>
                                    <span>Data de Emissão: {new Date().toLocaleString('pt-BR')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Estilos Globais de Impressão */}
            <style>{`
                @media print {
                    @page { size: portrait; margin: 0; }
                    body { background: white; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    #print-area { 
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        margin: 0 !important;
                        padding: 15mm !important;
                        z-index: 1000 !important;
                        background: white !important;
                        box-shadow: none !important;
                        display: block !important;
                        visibility: visible !important;
                        transform: scale(1);
                    }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    /* Esconde tudo exceto o print-area */
                    body > *:not(#print-area) { display: none !important; }
                    #root, .sidebar, .navbar { display: none !important; }
                }
            `}</style>
        </div>
    );
}
