import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
    AlertTriangle, 
    Truck, 
    MapPin, 
    Package, 
    CalendarClock, 
    CheckCircle2,
    Clock,
    Receipt,
    IdCard,
    CarFront
} from 'lucide-react';

interface Viagem {
    id: string;
    codigoViagem: string;
    motoristaNome: string;
    placaCavalo: string;
    status: string;
    dataSaida?: string;
    rotas?: Rota[];
}

interface Rota {
    id: string;
    origem: string;
    destino: string;
    cliente: string;
    status: string;
    previsaoChegadaRota?: string;
    dataSaidaRota?: string;
    dataDescarregamentoRota?: string;
}

interface Motorista {
    id: string;
    nome: string;
    cnh: string;
    validadeCNH?: string;
    status: string;
}

interface Veiculo {
    id: string;
    placa: string;
    tipo: string;
    validadeTacografo?: string;
    validadeLicenciamento: string;
    status: string;
}

interface Despesa {
    id: string;
    motoristaNome: string;
    placaCavalo: string;
    status: string;
    dataInicio: string;
    dataFim: string;
    valorTotal: number;
    saldoFinal: number;
}

interface EventoDia {
    id: string;
    tipo: 'alerta' | 'chegada' | 'saida' | 'acao' | 'info';
    titulo: string;
    descricao: string;
    motorista: string;
    codigoViagem: string;
    prioridade: number;
    icone: any;
    corBg: string;
    corTexto: string;
    corBorda: string;
    link: string;
}

export default function ResumoDia() {
    const navigate = useNavigate();
    const [viagensAtivas, setViagensAtivas] = useState<Viagem[]>([]);
    const [motoristas, setMotoristas] = useState<Motorista[]>([]);
    const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
    const [despesas, setDespesas] = useState<Despesa[]>([]);
    
    const [loadingViagens, setLoadingViagens] = useState(true);
    const [loadingOutros, setLoadingOutros] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const dateInputRef = useRef<HTMLInputElement>(null);

    const changeDay = (offset: number) => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + offset);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    useEffect(() => {
        // Buscar todas as viagens para permitir ver o histórico
        const qViagens = query(collection(db, 'cargas'));
        const unsubViagens = onSnapshot(qViagens, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Viagem));
            setViagensAtivas(list);
            setLoadingViagens(false);
        });

        // Buscar Motoristas
        const unsubMotoristas = onSnapshot(collection(db, 'motoristas'), (snapshot) => {
            setMotoristas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Motorista)));
        });

        // Buscar Veículos
        const unsubVeiculos = onSnapshot(collection(db, 'veiculos'), (snapshot) => {
            setVeiculos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Veiculo)));
        });

        // Buscar Despesas
        const unsubDespesas = onSnapshot(collection(db, 'despesas_frota'), (snapshot) => {
            setDespesas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Despesa)));
            setLoadingOutros(false);
        });

        return () => {
            unsubViagens();
            unsubMotoristas();
            unsubVeiculos();
            unsubDespesas();
        };
    }, []);

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    const getEventosDoDia = (): EventoDia[] => {
        const eventos: EventoDia[] = [];

        viagensAtivas.forEach(viagem => {
            // 1. Verificar problemas (Prioridade Máxima)
            // Para histórico, só mostramos problema se a viagem ainda estiver com status problema OU se for hoje
            if (viagem.status?.toUpperCase() === 'PROBLEMA' && (isToday || (viagem.dataSaida && viagem.dataSaida <= selectedDate))) {
                eventos.push({
                    id: `${viagem.id}-prob-viagem`,
                    tipo: 'alerta',
                    titulo: 'Problema na Viagem',
                    descricao: `Viagem sinalizada com problema.`,
                    motorista: viagem.motoristaNome,
                    codigoViagem: viagem.codigoViagem,
                    prioridade: 1,
                    icone: AlertTriangle,
                    corBg: 'bg-red-500/10',
                    corTexto: 'text-red-500',
                    corBorda: 'border-red-500/20',
                    link: '/cargas'
                });
            }

            // 2. Viagens saindo na data selecionada
            if (viagem.dataSaida === selectedDate) {
                eventos.push({
                    id: `${viagem.id}-saida`,
                    tipo: 'saida',
                    titulo: 'Início de Viagem',
                    descricao: `Viagem iniciada/programada para esta data.`,
                    motorista: viagem.motoristaNome,
                    codigoViagem: viagem.codigoViagem,
                    prioridade: 3,
                    icone: Truck,
                    corBg: 'bg-blue-500/10',
                    corTexto: 'text-blue-500',
                    corBorda: 'border-blue-500/20',
                    link: '/cargas'
                });
            }

            // 3. Analisar rotas individuais
            if (viagem.rotas && Array.isArray(viagem.rotas)) {
                viagem.rotas.forEach((rota, idx) => {
                    // Previsão de chegada na data selecionada
                    if (rota.previsaoChegadaRota === selectedDate) {
                        eventos.push({
                            id: `${viagem.id}-rota-${idx}-chegada`,
                            tipo: 'chegada',
                            titulo: `Chegada Prevista (Rota ${idx + 1})`,
                            descricao: `Destino: ${rota.destino.split(',')[0]} no cliente ${rota.cliente}`,
                            motorista: viagem.motoristaNome,
                            codigoViagem: viagem.codigoViagem,
                            prioridade: 2,
                            icone: MapPin,
                            corBg: 'bg-emerald-500/10',
                            corTexto: 'text-emerald-500',
                            corBorda: 'border-emerald-500/20',
                            link: '/cargas'
                        });
                    }

                    // Atraso de chegada (Previsão era antes da data selecionada e ainda não finalizou NAQUELA DATA)
                    // Nota: Como não temos um log histórico completo do status em cada dia, 
                    // focamos em atrasos que ainda persistem se a data for HOJE.
                    if (isToday && rota.previsaoChegadaRota && rota.previsaoChegadaRota < selectedDate && !['Descarregando', 'Finalizado', 'Problema'].includes(rota.status)) {
                         eventos.push({
                            id: `${viagem.id}-rota-${idx}-atraso`,
                            tipo: 'alerta',
                            titulo: `Atraso na Chegada (Rota ${idx + 1})`,
                            descricao: `Previsão era ${new Date(rota.previsaoChegadaRota + 'T12:00:00').toLocaleDateString('pt-BR')}. Destino: ${rota.destino.split(',')[0]}`,
                            motorista: viagem.motoristaNome,
                            codigoViagem: viagem.codigoViagem,
                            prioridade: 1.5,
                            icone: Clock,
                            corBg: 'bg-orange-500/10',
                            corTexto: 'text-orange-500',
                            corBorda: 'border-orange-500/20',
                            link: '/cargas'
                        });
                    }

                    // Para datas passadas, podemos ver o que foi descarregado naquele dia
                    if (rota.dataDescarregamentoRota === selectedDate) {
                        eventos.push({
                            id: `${viagem.id}-rota-${idx}-descarregado`,
                            tipo: 'acao',
                            titulo: `Descarregamento (Rota ${idx + 1})`,
                            descricao: `Finalizado em: ${rota.destino.split(',')[0]} - Cliente: ${rota.cliente}`,
                            motorista: viagem.motoristaNome,
                            codigoViagem: viagem.codigoViagem,
                            prioridade: 2,
                            icone: Package,
                            corBg: 'bg-purple-500/10',
                            corTexto: 'text-purple-500',
                            corBorda: 'border-purple-500/20',
                            link: '/cargas'
                        });
                    }
                    
                    // Se for HOJE, mostrar o que está acontecendo AGORA
                    if (isToday) {
                        if (rota.status === 'Carregando') {
                            eventos.push({
                                id: `${viagem.id}-rota-${idx}-carregando`,
                                tipo: 'acao',
                                titulo: `Em Carregamento (Rota ${idx + 1})`,
                                descricao: `Origem: ${rota.origem.split(',')[0]} - Cliente: ${rota.cliente}`,
                                motorista: viagem.motoristaNome,
                                codigoViagem: viagem.codigoViagem,
                                prioridade: 2,
                                icone: Package,
                                corBg: 'bg-amber-500/10',
                                corTexto: 'text-amber-500',
                                corBorda: 'border-amber-500/20',
                                link: '/cargas'
                            });
                        }
                    }
                });
            }
        });

        // Adicionar eventos extras apenas se for hoje
        if (isToday) {
            motoristas.forEach(m => {
                if (m.validadeCNH && m.status === 'ativo') {
                    const expiry = new Date(m.validadeCNH);
                    const today = new Date();
                    const oneMonthFromNow = new Date();
                    oneMonthFromNow.setMonth(today.getMonth() + 1);

                    if (expiry < today) {
                        eventos.push({
                            id: `mot-${m.id}-cnh`,
                            tipo: 'alerta',
                            titulo: 'CNH Vencida',
                            descricao: `A CNH do motorista ${m.nome} está vencida desde ${expiry.toLocaleDateString('pt-BR')}.`,
                            motorista: m.nome,
                            codigoViagem: 'RH / DOCS',
                            prioridade: 0.8,
                            icone: IdCard,
                            corBg: 'bg-red-500/10',
                            corTexto: 'text-red-500',
                            corBorda: 'border-red-500/20',
                            link: '/motoristas'
                        });
                    } else if (expiry <= oneMonthFromNow) {
                        eventos.push({
                            id: `mot-${m.id}-cnh-prox`,
                            tipo: 'alerta',
                            titulo: 'CNH Vencendo',
                            descricao: `A CNH do motorista ${m.nome} vence em ${expiry.toLocaleDateString('pt-BR')}.`,
                            motorista: m.nome,
                            codigoViagem: 'RH / DOCS',
                            prioridade: 1.5,
                            icone: IdCard,
                            corBg: 'bg-orange-500/10',
                            corTexto: 'text-orange-500',
                            corBorda: 'border-orange-500/20',
                            link: '/motoristas'
                        });
                    }
                }
            });

            veiculos.forEach(v => {
                if (v.status === 'ativo') {
                    const checkDoc = (dateStr: string | undefined, docName: string) => {
                        if (!dateStr) return;
                        const expiry = new Date(dateStr);
                        const today = new Date();
                        const oneMonthFromNow = new Date();
                        oneMonthFromNow.setMonth(today.getMonth() + 1);

                        if (expiry < today) {
                            eventos.push({
                                id: `veic-${v.id}-${docName}`,
                                tipo: 'alerta',
                                titulo: `${docName} Vencido`,
                                descricao: `Veículo ${v.placa} (${v.tipo}).`,
                                motorista: v.placa,
                                codigoViagem: 'FROTA / DOCS',
                                prioridade: 0.9,
                                icone: CarFront,
                                corBg: 'bg-red-500/10',
                                corTexto: 'text-red-500',
                                corBorda: 'border-red-500/20',
                                link: '/veiculos'
                            });
                        } else if (expiry <= oneMonthFromNow) {
                            eventos.push({
                                id: `veic-${v.id}-${docName}-prox`,
                                tipo: 'alerta',
                                titulo: `${docName} Vencendo`,
                                descricao: `Vence em ${expiry.toLocaleDateString('pt-BR')} - Veículo ${v.placa}.`,
                                motorista: v.placa,
                                codigoViagem: 'FROTA / DOCS',
                                prioridade: 1.6,
                                icone: CarFront,
                                corBg: 'bg-orange-500/10',
                                corTexto: 'text-orange-500',
                                corBorda: 'border-orange-500/20',
                                link: '/veiculos'
                            });
                        }
                    };

                    checkDoc(v.validadeLicenciamento, 'Licenciamento');
                    if (v.tipo === 'cavalo') {
                        checkDoc(v.validadeTacografo, 'Tacógrafo');
                    }
                }
            });

            despesas.forEach(d => {
                if (d.status === 'pendente') {
                    eventos.push({
                        id: `desp-${d.id}`,
                        tipo: 'info',
                        titulo: 'Acerto Pendente',
                        descricao: `Valor pendente: R$ ${d.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
                        motorista: d.motoristaNome,
                        codigoViagem: d.placaCavalo || 'FINANCEIRO',
                        prioridade: 2.5,
                        icone: Receipt,
                        corBg: 'bg-blue-500/10',
                        corTexto: 'text-blue-500',
                        corBorda: 'border-blue-500/20',
                        link: '/despesas'
                    });
                }
            });
        }

        // Ordenar por prioridade (1 é mais alto)
        return eventos.sort((a, b) => a.prioridade - b.prioridade);
    };

    const eventos = getEventosDoDia();

    const eventosProblema = eventos.filter(e => e.tipo === 'alerta');
    const eventosAcao = eventos.filter(e => e.tipo === 'acao' || e.tipo === 'info');
    const eventosLogistica = eventos.filter(e => e.tipo === 'chegada' || e.tipo === 'saida');

    if (loadingViagens || loadingOutros) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <p className="text-text-muted font-black uppercase tracking-[0.2em] animate-pulse">Carregando resumo...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <CalendarClock size={28} />
                        </div>
                        Resumo do Dia
                    </h1>
                    <p className="text-primary/80 text-sm mt-1">Acompanhamento operacional para a data selecionada.</p>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Prev day */}
                    <button
                        onClick={() => changeDay(-1)}
                        className="size-10 flex items-center justify-center bg-surface border border-border rounded-xl text-text-muted hover:text-primary hover:border-primary/40 transition-all"
                        title="Dia anterior"
                    >
                        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                    </button>

                    {/* Date input hidden, triggered by calendar button */}
                    <div className="relative">
                        <input
                            ref={dateInputRef}
                            type="date"
                            value={selectedDate}
                            onChange={(e) => { setSelectedDate(e.target.value); }}
                            className="absolute opacity-0 w-0 h-0 pointer-events-none"
                        />
                        <button
                            onClick={() => dateInputRef.current?.showPicker()}
                            className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-2 text-xs font-bold text-text-primary hover:border-primary/40 transition-all min-w-[180px] justify-center"
                        >
                            <span className="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </button>
                    </div>

                    {/* Next day */}
                    <button
                        onClick={() => changeDay(1)}
                        className="size-10 flex items-center justify-center bg-surface border border-border rounded-xl text-text-muted hover:text-primary hover:border-primary/40 transition-all"
                        title="Próximo dia"
                    >
                        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </button>

                    {/* Hoje */}
                    {!isToday && (
                        <button
                            onClick={() => { setSelectedDate(new Date().toISOString().split('T')[0]); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-background-dark rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                            <span className="material-symbols-outlined text-[16px]">today</span>
                            Hoje
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 text-primary rounded-lg">
                        <Clock size={16} />
                    </div>
                    <p className="text-xs font-bold text-text-primary">
                        Visualizando: <span className="text-primary uppercase">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </p>
                </div>
                {isToday && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-primary text-background-dark rounded-lg">Hoje</span>
                )}
            </div>

            {/* Dashboard Cards Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface border border-border shadow-sm">
                    <p className="text-primary/80 text-[10px] font-black uppercase tracking-widest">Total de Eventos</p>
                    <p className="text-text-primary text-3xl font-black">{eventos.length}</p>
                 </div>
                 <div className="flex flex-col gap-2 rounded-xl p-6 bg-red-500/5 border border-red-500/20 shadow-sm relative overflow-hidden">
                    <div className="absolute right-[-10px] top-[-10px] opacity-10">
                        <AlertTriangle size={80} className="text-red-500" />
                    </div>
                    <p className="text-red-500 text-[10px] font-black uppercase tracking-widest relative z-10">Problemas / Atrasos</p>
                    <p className="text-red-500 text-3xl font-black relative z-10">{eventosProblema.length}</p>
                 </div>
                 <div className="flex flex-col gap-2 rounded-xl p-6 bg-amber-500/5 border border-amber-500/20 shadow-sm">
                    <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest">Ações e Pendências</p>
                    <p className="text-amber-500 text-3xl font-black">{eventosAcao.length}</p>
                 </div>
                 <div className="flex flex-col gap-2 rounded-xl p-6 bg-emerald-500/5 border border-emerald-500/20 shadow-sm">
                    <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">Logística (Saídas/Chegadas)</p>
                    <p className="text-emerald-500 text-3xl font-black">{eventosLogistica.length}</p>
                 </div>
            </div>

            {eventos.length === 0 ? (
                <div className="bg-surface border border-border rounded-3xl p-12 text-center shadow-sm flex flex-col items-center gap-4">
                    <div className="bg-emerald-500/10 text-emerald-500 p-4 rounded-full">
                        <CheckCircle2 size={48} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-text-primary">Nenhum evento registrado</h2>
                        <p className="text-text-muted mt-2">Não foram encontrados eventos ou movimentações para o dia {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Lista Principal de Eventos */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-lg font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px]">view_timeline</span>
                            Timeline Operacional
                        </h2>
                        
                        <div className="relative border-l-2 border-border ml-4 space-y-8 pl-8 py-2">
                            {eventos.map((evento) => {
                                const Icon = evento.icone;
                                return (
                                    <div
                                        key={evento.id}
                                        className="relative group cursor-pointer transition-all hover:scale-[1.01]"
                                        onClick={() => {
                                            // Determinar o termo de busca para o "foco"
                                            let searchTerm = '';
                                            if (evento.link === '/cargas') searchTerm = evento.codigoViagem;
                                            else if (evento.link === '/motoristas') searchTerm = evento.motorista;
                                            else if (evento.link === '/veiculos') searchTerm = evento.motorista; // motorista aqui é a placa no evento de veiculo
                                            else if (evento.link === '/despesas') searchTerm = evento.motorista;

                                            navigate(evento.link, { state: { searchTerm } });
                                        }}
                                        title="Clique para ir ao registro"
                                    >
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-[41px] size-10 rounded-full border-4 border-background ${evento.corBg} flex items-center justify-center z-10 ring-2 ring-transparent group-hover:ring-primary/30 transition-all`}>
                                            <Icon size={16} className={evento.corTexto} />
                                        </div>

                                        {/* Content Card */}
                                        <div className={`bg-surface border ${evento.corBorda} rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden`}>
                                            <div className={`absolute top-0 left-0 w-1.5 h-full ${evento.corBg.replace('/10', '')} opacity-50`}></div>
                                            
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${evento.corBg} ${evento.corTexto} ${evento.corBorda}`}>
                                                            {evento.tipo === 'alerta' ? 'Atenção' : evento.tipo}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-text-muted bg-background-dark px-2 py-0.5 rounded-md border border-border">
                                                            {evento.codigoViagem}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-base font-black text-text-primary mt-2">{evento.titulo}</h3>
                                                    <p className="text-sm font-medium text-text-secondary mt-1">{evento.descricao}</p>
                                                </div>
                                                
                                                <div className="bg-background-dark border border-border rounded-xl p-3 flex items-center gap-3 md:min-w-[180px]">
                                                    <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">
                                                        {evento.motorista.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">Motorista / Ref.</p>
                                                        <p className="text-sm font-bold text-text-primary truncate max-w-[120px]" title={evento.motorista}>{evento.motorista}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sidebar Resumo */}
                    <div className="space-y-6">
                        <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm sticky top-6">
                            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary mb-1 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">rule</span>
                                Detalhes do Dia
                            </h3>
                            <p className="text-[10px] text-text-muted mb-5">Clique num evento para ir ao registro correspondente.</p>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg shrink-0">
                                        <AlertTriangle size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-text-primary">Atenção e Problemas</p>
                                        <p className="text-[10px] text-text-muted">Atrasos, CNH e documentos vencidos.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                                        <Truck size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-text-primary">Logística</p>
                                        <p className="text-[10px] text-text-muted">Saídas, chegadas e descarregamentos.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">
                                        <Receipt size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-text-primary">Financeiro</p>
                                        <p className="text-[10px] text-text-muted">Acertos pendentes de motoristas.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
                                        <Package size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-text-primary">Operações Ativas</p>
                                        <p className="text-[10px] text-text-muted">Carga/descarga em andamento.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
