import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import CompanyLogo from '../assets/logo-golden.png';
import { maskCPF } from '../utils/masks';

interface motoristaData {
    id: string;
    nome: string;
    cpf: string;
    placaCavalo: string;
    placaCarreta?: string;
}

interface ItemGasto {
    categoria: string;
    valor: number;
    data: string;
    observacao?: string;
}

interface Carga {
    id: string;
    codigoViagem: string;
    origem: string;
    destino: string;
    status: string;
}

const CATEGORIAS = ['Peças', 'Serviços', 'Lavagem', 'Descarga', 'Estacionamento', 'Transporte', 'Borracharia', 'Outros'];

export default function PrestacaoContas() {
    const [step, setStep] = useState<'identification' | 'form'>('identification');
    const [cpfInput, setCpfInput] = useState('');
    const [motorista, setMotorista] = useState<motoristaData | null>(null);
    const [cargas, setCargas] = useState<Carga[]>([]);
    const [selectedViagens, setSelectedViagens] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const getLocalDatetime = () => {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        return new Date(Date.now() - tzOffset).toISOString().slice(0, 16);
    };

    // Form State
    const [dataInicioViagem, setDataInicioViagem] = useState(getLocalDatetime());
    const [dataFimViagem, setDataFimViagem] = useState(getLocalDatetime());
    const [valorDiaria, setValorDiaria] = useState<number>(110);
    const [placaCavalo, setPlacaCavalo] = useState('');
    const [placaBau, setPlacaBau] = useState('');
    const [gastos, setGastos] = useState<ItemGasto[]>([]);
    const [currentItem, setCurrentItem] = useState<ItemGasto>({
        categoria: 'Peças',
        valor: 0,
        data: new Date().toISOString().split('T')[0],
        observacao: ''
    });

    // Fetch Global Daily Rate and Available Trips
    useEffect(() => {
        const unsubscribeDiaria = onSnapshot(doc(db, 'config', 'diaria'), (snapshot) => {
            if (snapshot.exists() && snapshot.data().valor !== undefined && snapshot.data().valor !== null) {
                setValorDiaria(Number(snapshot.data().valor));
            }
        });

        let unsubscribeCargas = () => {};
        if (motorista) {
            const q = query(
                collection(db, 'cargas'), 
                where('motoristaNome', '==', motorista.nome)
            );
            unsubscribeCargas = onSnapshot(q, (snapshot) => {
                const list = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Carga));
                setCargas(list);
            });
        }

        return () => {
            unsubscribeDiaria();
            unsubscribeCargas();
        };
    }, [motorista]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleIdentification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cpfInput) return;
        setLoading(true);

        const q = query(collection(db, 'motoristas'), where('cpf', '==', cpfInput));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const docData = snapshot.docs[0].data() as motoristaData;
                const id = snapshot.docs[0].id;
                setMotorista({ ...docData, id });
                setPlacaCavalo(docData.placaCavalo || '');
                setPlacaBau(docData.placaCarreta || '');
                setStep('form');
            } else {
                showToast('CPF não encontrado ou motorista não cadastrado', 'error');
            }
            setLoading(false);
            unsubscribe();
        });
    };

    const addGasto = () => {
        if (currentItem.valor <= 0) {
            showToast('Informe um valor válido', 'error');
            return;
        }
        setGastos([...gastos, currentItem]);
        setCurrentItem({
            categoria: 'Peças',
            valor: 0,
            data: new Date().toISOString().split('T')[0],
            observacao: ''
        });
    };

    const removeGasto = (index: number) => {
        setGastos(gastos.filter((_, i: number) => i !== index));
    };

    const editGasto = (index: number) => {
        const itemToEdit = gastos[index];
        setCurrentItem(itemToEdit);
        setGastos(gastos.filter((_, i: number) => i !== index));
        // Scroll slightly down to make the form visible on mobile
        window.scrollTo({ top: document.body.scrollHeight / 3, behavior: 'smooth' });
    };

    const calculateDays = () => {
        const start = new Date(dataInicioViagem);
        const end = new Date(dataFimViagem);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return isNaN(diffDays) ? 0 : diffDays;
    };

    const totalDiarias = calculateDays() * valorDiaria;
    const totalDespesasItens = gastos.reduce((acc: number, curr: ItemGasto) => acc + curr.valor, 0);
    const totalGeral = totalDiarias + totalDespesasItens;

    const handleSubmit = async () => {
        if (!motorista) return;
        setSubmitting(true);
        try {
            const payload = {
                motoristaNomeOriginal: motorista.nome,
                motoristaNome: motorista.nome,
                motoristaId: motorista.id,
                motoristaCPF: motorista.cpf,
                placaCavalo: placaCavalo.toUpperCase(),
                placaBau: placaBau.toUpperCase(),
                dataInicio: dataInicioViagem.split('T')[0],
                dataFim: dataFimViagem.split('T')[0],
                dataInicioCompleta: dataInicioViagem,
                dataFimCompleta: dataFimViagem,
                diasDiaria: calculateDays(),
                valorDiaria: valorDiaria,
                totalDiarias: totalDiarias,
                valorTotal: totalGeral,
                saldoFinal: totalGeral,
                items: gastos.map(g => ({
                    categoria: g.categoria,
                    valor: g.valor,
                    descricao: g.observacao || '',
                    data: g.data
                })),
                status: 'pendente',
                data: serverTimestamp(),
                dataRegistro: serverTimestamp(),
                origem: 'motorista_mobile',
                tipo: 'prestacao_contas',
                viagensIds: selectedViagens
            };

            await addDoc(collection(db, 'despesas_brutas'), payload);
            showToast('Prestação de contas enviada com sucesso!');

            setTimeout(() => {
                setStep('identification');
                setGastos([]);
                setSelectedViagens([]);
                setCpfInput('');
            }, 2000);
        } catch (error) {
            console.error(error);
            showToast('Erro ao enviar dados', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const TimbradoBackground = () => (
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] rotate-[-15deg] overflow-hidden flex flex-wrap gap-20 p-10 select-none">
            {Array.from({ length: 48 }).map((_, i) => (
                <img key={i} src={CompanyLogo} alt="" className="w-24 opacity-[0.05]" />
            ))}
        </div>
    );

    if (step === 'identification') {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden relative">
                <TimbradoBackground />
                <div className="w-full max-w-sm flex flex-col items-center gap-8 relative z-10">
                    <img src={CompanyLogo} alt="Golden" className="h-20" />
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-black uppercase tracking-tight text-text-primary">Acesso ao Acerto</h2>
                        <p className="text-text-muted text-xs font-bold uppercase tracking-widest">Identifique-se para continuar</p>
                    </div>

                    <form onSubmit={handleIdentification} className="w-full space-y-4">
                        <label className="flex flex-col gap-2">
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">CPF do Motorista</span>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary material-symbols-outlined">fingerprint</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full bg-surface border border-border rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:border-primary transition-all shadow-xl"
                                    placeholder="000.000.000-00"
                                    value={cpfInput}
                                    onChange={(e) => setCpfInput(maskCPF(e.target.value))}
                                    required
                                />
                            </div>
                        </label>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'Entrar'}
                        </button>
                    </form>
                </div>
                {toast && (
                    <div className="fixed bottom-8 px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500 text-red-500 shadow-2xl animate-bounce">
                        <span className="text-xs font-black uppercase">{toast.message}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-text-primary p-4 pb-20 flex flex-col items-center relative overflow-x-hidden">
            <TimbradoBackground />

            <div className="relative z-10 w-full max-w-lg">
                {/* Header */}
                <div className="flex flex-col items-center mb-6">
                    <img src={CompanyLogo} alt="Golden" className="h-14 mb-4" />
                    <h1 className="text-xl font-black uppercase tracking-tight text-center">Prestação de Contas</h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Identificado: {motorista?.nome}</p>
                </div>

                <div className="space-y-6">
                    {/* Editable Vehicle Info */}
                    <div className="bg-surface/80 backdrop-blur-sm border border-border p-5 rounded-3xl shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary">local_shipping</span>
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Informações da Viagem</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Placa Cavalo</span>
                                <input
                                    type="text"
                                    className="bg-background border border-border rounded-xl px-3 py-2 text-sm font-black uppercase outline-none focus:border-primary"
                                    value={placaCavalo}
                                    onChange={(e) => setPlacaCavalo(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-1.5">
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest ml-1">Placa Baú</span>
                                <input
                                    type="text"
                                    className="bg-background border border-border rounded-xl px-3 py-2 text-sm font-black uppercase outline-none focus:border-primary"
                                    value={placaBau}
                                    onChange={(e) => setPlacaBau(e.target.value)}
                                />
                            </label>
                        </div>

                        
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-primary">hub</span>
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Vincular às Viagens</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {cargas.length === 0 ? (
                                    <p className="text-[10px] text-text-muted italic px-2">Nenhuma viagem ativa encontrada no seu nome.</p>
                                ) : (
                                    cargas.slice(0, 4).map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedViagens(prev => 
                                                    prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                                                );
                                            }}
                                            className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                                                selectedViagens.includes(c.id) 
                                                    ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10' 
                                                    : 'bg-background border-border opacity-70'
                                            }`}
                                        >
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="text-xs font-black uppercase text-text-primary">{c.codigoViagem}</span>
                                                <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">
                                                    {c.origem.split(',')[0]} → {c.destino.split(',')[0]}
                                                </span>
                                            </div>
                                            <div className={`size-5 rounded-full border-2 flex items-center justify-center ${selectedViagens.includes(c.id) ? 'bg-primary border-primary text-background-dark' : 'border-border'}`}>
                                                {selectedViagens.includes(c.id) && <span className="material-symbols-outlined text-[14px] font-black">check</span>}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                            <p className="text-[9px] text-text-muted leading-relaxed px-1">Selecione para qual viagem você está enviando estas despesas.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">flight_takeoff</span>
                                    Saída da Viagem
                                </span>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-background border border-border rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:border-primary shadow-inner"
                                    value={dataInicioViagem}
                                    onChange={(e) => setDataInicioViagem(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">flight_land</span>
                                    Chegada da Viagem
                                </span>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-background border border-border rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:border-primary shadow-inner"
                                    value={dataFimViagem}
                                    onChange={(e) => setDataFimViagem(e.target.value)}
                                />
                            </label>
                        </div>
                        <div className="bg-background-dark/50 p-3 rounded-2xl border border-border flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] items-center gap-1 font-black text-text-muted uppercase flex">
                                    <span className="material-symbols-outlined text-[14px]">event_repeat</span>
                                    Total de {calculateDays()} Diárias
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-text-muted">Valor: R$</span>
                                    <span className="text-xs font-black text-primary px-1">{valorDiaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-[8px] font-bold text-text-muted uppercase italic bg-border/30 px-1.5 py-0.5 rounded ml-1">Fixo</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total Diárias</span>
                                <p className="text-lg font-black text-primary">R$ {totalDiarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>

                    {/* Add Expense Form */}
                    <div className="bg-surface/80 backdrop-blur-sm border border-border p-6 rounded-[2.5rem] shadow-xl border-t-primary/20">
                        <h2 className="text-sm font-black uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                            Outras Despesas
                        </h2>

                        <div className="grid gap-5">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Categoria</span>
                                    <select
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm font-bold outline-none"
                                        value={currentItem.categoria}
                                        onChange={(e) => setCurrentItem({ ...currentItem, categoria: e.target.value })}
                                    >
                                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Data Gasto</span>
                                    <input
                                        type="date"
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm font-bold outline-none"
                                        value={currentItem.data}
                                        onChange={(e) => setCurrentItem({ ...currentItem, data: e.target.value })}
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Valor da Despesa</span>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black">R$</span>
                                        <input
                                            type="number"
                                            className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-4 text-xl font-black text-primary outline-none focus:border-primary transition-all shadow-inner"
                                            value={currentItem.valor === 0 ? '' : currentItem.valor}
                                            onChange={(e) => setCurrentItem({ ...currentItem, valor: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                            placeholder="0,00"
                                        />
                                    </div>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Observação</span>
                                        <span className="text-[9px] font-bold text-text-muted/60 uppercase italic">(Opcional)</span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 material-symbols-outlined text-[18px]">edit_note</span>
                                        <input
                                            className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:border-primary transition-all shadow-inner"
                                            placeholder="Ex: Borracharia na Rodovia BR-116..."
                                            value={currentItem.observacao}
                                            onChange={(e) => setCurrentItem({ ...currentItem, observacao: e.target.value })}
                                        />
                                    </div>
                                </label>
                            </div>

                            <button
                                type="button"
                                onClick={addGasto}
                                className="w-full bg-primary/10 border border-primary/30 text-primary py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] active:scale-95 transition-all mt-2"
                            >
                                Adicionar à Lista
                            </button>
                        </div>
                    </div>

                    {/* Expenses List */}
                    {gastos.length > 0 && (
                        <div className="space-y-2">
                            {gastos.map((g, idx) => (
                                <div key={idx} className="bg-surface border border-border p-4 rounded-2xl flex items-center justify-between group shadow-sm">
                                    <div className="flex flex-col gap-1 flex-1">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-black text-primary uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded">{g.categoria}</span>
                                            <span className="text-sm font-black text-text-primary">R$ {g.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            <div className="flex items-center gap-1.5 text-text-muted">
                                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                                <span className="text-[10px] font-bold">{new Date(g.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            {g.observacao && (
                                                <div className="flex items-start gap-1.5 text-text-secondary bg-background-dark/50 p-2 rounded-xl border border-border/50 mt-1">
                                                    <span className="material-symbols-outlined text-[14px] mt-0.5">sticky_note_2</span>
                                                    <p className="text-[10px] font-medium leading-relaxed italic">{g.observacao}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button onClick={() => editGasto(idx)} className="size-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center active:scale-90 transition-transform">
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                        <button onClick={() => removeGasto(idx)} className="size-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90 transition-transform">
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Final Total Summary */}
                    <div className="bg-background-dark/95 backdrop-blur-md border-2 border-primary/30 p-6 rounded-[2.5rem] shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-border/50">
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Diárias ({calculateDays()}x)</span>
                            <span className="text-lg font-black text-text-primary">R$ {totalDiarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center pb-4 border-b border-border/50">
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total Despesas</span>
                            <span className="text-lg font-black text-text-primary">R$ {totalDespesasItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-xs font-black text-primary uppercase tracking-widest">Total Geral Acerto</span>
                            <span className="text-3xl font-black text-primary">
                                R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div className="pt-6">
                            <div className="bg-background p-4 rounded-2xl border border-border mb-6">
                                <p className="text-[10px] font-bold text-text-muted leading-relaxed text-center italic">
                                    Ao clicar em enviar, confirmo a veracidade de todas as diárias e gastos aqui relacionados para esta viagem.
                                </p>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full bg-primary text-background-dark py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-[0_10px_30px_rgba(245,165,36,0.3)] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {submitting ? 'Processando...' : 'Enviar Acerto'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-[200] border transition-all animate-bounce ${toast.type === 'error' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-green-500/10 border-green-500 text-green-500'}`}>
                    <span className="material-symbols-outlined">{toast.type === 'error' ? 'error' : 'check_circle'}</span>
                    <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
                </div>
            )}
        </div>
    );
}
