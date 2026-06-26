import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDocs, updateDoc, limit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import CompanyLogo from '../assets/logo-golden.png';
import { maskCPF, unmaskCPF } from '../utils/masks';

interface motoristaData {
    id: string;
    nome: string;
    cpf: string;
    cavaloPlaca: string;
    bauPlaca?: string;
}

interface ItemGasto {
    id?: string;
    categoria: string;
    valor: number;
    data: string;
    observacao?: string;
    anexos?: string[];
}

interface Carga {
    id: string;
    codigoViagem: string;
    origem: string;
    destino: string;
    status: string;
    rotas?: any[];
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
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [rotaAnexos, setRotaAnexos] = useState<{[key: string]: string[]}>({}); // `${cargaId}_${rotaIndex}` -> array of URLs
    const [uploadingFiles, setUploadingFiles] = useState<{[key: string]: boolean}>({});
    const [existingDocId, setExistingDocId] = useState<string | null>(null);
    const draftDocIdRef = useRef<string | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
        observacao: '',
        anexos: []
    });

    // Fetch Global Daily Rate and Available Trips
    useEffect(() => {
        const unsubscribeDiaria = onSnapshot(doc(db, 'config', 'diaria'), (snapshot) => {
            if (snapshot.exists() && snapshot.data().valor !== undefined && snapshot.data().valor !== null) {
                setValorDiaria(Number(snapshot.data().valor));
            }
        }, (err) => {
            console.error("Erro ao carregar diária:", err);
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
                
                const emCurso = list.filter(c => c.status === 'EM_CURSO' || c.status === 'Em Viagem' || c.status === 'Em curso').map(c => c.id);
                if (emCurso.length > 0) {
                    setSelectedViagens(emCurso);
                }
                
                setCargas(list);
            }, (err) => {
                console.error("Erro ao carregar cargas:", err);
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

    const getRotaCardColor = (status: string) => {
        switch (status) {
            case 'Finalizado': return 'bg-emerald-500/10 border-emerald-500/50 shadow-emerald-500/10';
            case 'Carregando':
            case 'Viagem':
            case 'Descarregando': return 'bg-amber-500/10 border-amber-500/50 shadow-amber-500/10';
            case 'Indo para o cliente': return 'bg-blue-500/10 border-blue-500/50 shadow-blue-500/10';
            case 'Problema': return 'bg-red-500/20 border-red-500/70 shadow-red-500/20';
            default: return 'bg-background/50 border-primary/10';
        }
    };

    const handleIdentification = async (e: React.FormEvent) => {
        e.preventDefault();
        const cpfLimpo = unmaskCPF(cpfInput);
        if (cpfLimpo.length !== 11) {
            showToast('Digite um CPF completo (11 dígitos)', 'error');
            return;
        }
        setLoading(true);
        const cpfFormatado = maskCPF(cpfLimpo);
        
        try {
            // Busca com CPF formatado (como é salvo no banco)
            let snapshot = await getDocs(query(collection(db, 'motoristas'), where('cpf', '==', cpfFormatado)));
            
            // Fallback: tentar com CPF sem formatação
            if (snapshot.empty) {
                snapshot = await getDocs(query(collection(db, 'motoristas'), where('cpf', '==', cpfLimpo)));
            }
            
            let motoristaDoc: { id: string; data: motoristaData } | null = null;
            
            if (!snapshot.empty) {
                motoristaDoc = { id: snapshot.docs[0].id, data: snapshot.docs[0].data() as motoristaData };
            } else {
                const allDrivers = await getDocs(query(collection(db, 'motoristas'), limit(2000)));
                const match = allDrivers.docs.find(d => {
                    const raw = String((d.data() as any).cpf ?? '').trim();
                    return raw === cpfFormatado || raw === cpfLimpo;
                });
                if (match) {
                    motoristaDoc = { id: match.id, data: match.data() as motoristaData };
                }
            }
            
            if (motoristaDoc) {
                const { id, data: docData } = motoristaDoc;
                setMotorista({ ...docData, id });
                setPlacaCavalo(docData.cavaloPlaca || '');
                setPlacaBau(docData.bauPlaca || '');

                // Buscar se existe algum formulário devolvido ou pendente para este motorista
                try {
                    // Buscar todas as despesas do motorista
                    const qDespesas = query(collection(db, 'despesas_frota'), where('motoristaId', '==', id));
                    const snapDespesas = await getDocs(qDespesas);
                    const devolvidoDoc = snapDespesas.docs.find(d => d.data().status === 'devolvido' || d.data().status === 'rascunho');
                    
                    if (devolvidoDoc) {
                        const data = devolvidoDoc.data();
                        setExistingDocId(devolvidoDoc.id);
                        draftDocIdRef.current = devolvidoDoc.id;
                        
                        if (data.items) setGastos(data.items);
                        if (data.rotaAnexos) setRotaAnexos(data.rotaAnexos);
                        if (data.viagensIds) setSelectedViagens(data.viagensIds);
                        if (data.dataInicioCompleta) setDataInicioViagem(data.dataInicioCompleta);
                        if (data.dataFimCompleta) setDataFimViagem(data.dataFimCompleta);
                        
                        
                        if (data.status === 'devolvido') {
                            showToast('Encontramos um acerto devolvido para correção.', 'success');
                        } else {
                            showToast('Rascunho recuperado. Continue de onde parou.', 'success');
                        }
                    } else {
                        setExistingDocId(null);
                        draftDocIdRef.current = null;
                    }
                } catch (draftError) {
                    console.error("Erro ao buscar rascunho:", draftError);
                    setExistingDocId(null);
                    draftDocIdRef.current = null;
                }

                setStep('form');
            } else {
                showToast('CPF não localizado. Verifique ou contate administração.', 'error');
            }
        } catch (error) {
            console.error("Erro na busca:", error);
            showToast('Erro ao buscar motorista. Tente novamente.', 'error');
        } finally {
            setLoading(false);
        }
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
        
        // Auto-save when a new expense is added
        setTimeout(() => saveDraft(rotaAnexos, [...gastos, currentItem]), 100);
    };

    const removeGasto = (index: number) => {
        const newGastos = gastos.filter((_, i: number) => i !== index);
        setGastos(newGastos);
        setTimeout(() => saveDraft(rotaAnexos, newGastos), 100);
    };

    const editGasto = (index: number) => {
        const itemToEdit = gastos[index];
        setCurrentItem(itemToEdit);
        setGastos(gastos.filter((_, i: number) => i !== index));
        // Scroll slightly down to make the form visible on mobile
        window.scrollTo({ top: document.body.scrollHeight / 3, behavior: 'smooth' });
    };

    const handleFirebaseUpload = async (file: File, path: string): Promise<string> => {
        const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
        const uploadTask = await uploadBytesResumable(fileRef, file);
        return await getDownloadURL(uploadTask.ref);
    };

    const uploadRotaAnexo = async (cargaId: string, rotaIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        const key = `${cargaId}_${rotaIndex}`;
        setUploadingFiles(prev => ({...prev, [key]: true}));
        
        try {
            const urls = await Promise.all(files.map(f => handleFirebaseUpload(f, 'comprovantes')));
            setRotaAnexos(prev => {
                const next = { ...prev };
                next[key] = [...(next[key] || []), ...urls];
                setTimeout(() => saveDraft(next, gastos), 100);
                return next;
            });
            showToast('Imagens salvas com sucesso!');
        } catch (err) {
            console.error(err);
            showToast('Erro ao enviar imagens', 'error');
        } finally {
            setUploadingFiles(prev => ({...prev, [key]: false}));
        }
    };

    const removeRotaAnexo = (cargaId: string, rotaIndex: number, imgIndex: number) => {
        const key = `${cargaId}_${rotaIndex}`;
        setRotaAnexos(prev => {
            const next = { ...prev };
            if (next[key]) {
                next[key] = next[key].filter((_, i) => i !== imgIndex);
            }
            setTimeout(() => saveDraft(next, gastos), 100);
            return next;
        });
    };

    const uploadDespesaAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        setUploadingFiles(prev => ({...prev, 'despesa_atual': true}));
        
        try {
            const urls = await Promise.all(files.map(f => handleFirebaseUpload(f, 'despesas')));
            setCurrentItem(prev => ({
                ...prev,
                anexos: [...(prev.anexos || []), ...urls]
            }));
            showToast('Fotos anexadas!');
        } catch (err) {
            console.error(err);
            showToast('Erro ao anexar fotos', 'error');
        } finally {
            setUploadingFiles(prev => ({...prev, 'despesa_atual': false}));
        }
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

    const saveDraft = async (anexosToSave = rotaAnexos, gastosToSave = gastos) => {
        if (!motorista || submitting) return;
        
        try {
            const payload: any = {
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
                totalDiarias: calculateDays() * valorDiaria,
                valorTotal: (calculateDays() * valorDiaria) + gastosToSave.reduce((acc: number, curr: ItemGasto) => acc + curr.valor, 0),
                saldoFinal: (calculateDays() * valorDiaria) + gastosToSave.reduce((acc: number, curr: ItemGasto) => acc + curr.valor, 0),
                items: gastosToSave.map(g => ({
                    categoria: g.categoria,
                    valor: g.valor,
                    descricao: g.observacao || '',
                    data: g.data,
                    anexos: g.anexos || []
                })),
                rotaAnexos: anexosToSave,
                dataAtualizacao: serverTimestamp(),
                origem: 'motorista_mobile',
                tipo: 'prestacao_contas',
                viagensIds: selectedViagens
            };

            const currentDraftId = draftDocIdRef.current || existingDocId;

            if (currentDraftId) {
                await updateDoc(doc(db, 'despesas_frota', currentDraftId), payload);
            } else {
                payload.status = 'rascunho';
                payload.data = serverTimestamp();
                payload.dataRegistro = serverTimestamp();
                const docRef = await addDoc(collection(db, 'despesas_frota'), payload);
                setExistingDocId(docRef.id);
                draftDocIdRef.current = docRef.id;
            }
        } catch (error) {
            console.error("Erro ao salvar rascunho:", error);
        }
    };

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
                    data: g.data,
                    anexos: g.anexos || []
                })),
                rotaAnexos: rotaAnexos,
                status: 'pendente',
                data: serverTimestamp(),
                dataRegistro: serverTimestamp(),
                origem: 'motorista_mobile',
                tipo: 'prestacao_contas',
                viagensIds: selectedViagens
            };

            if (existingDocId) {
                await updateDoc(doc(db, 'despesas_frota', existingDocId), {
                    ...payload,
                    status: 'pendente', // Volta para pendente após correção
                    dataAtualizacao: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'despesas_frota'), payload);
            }
            
            // Atualizar as Viagens com as fotos
            const cargasToUpdate = new Set(Object.keys(rotaAnexos).map(k => k.split('_')[0]));
            for (const cId of cargasToUpdate) {
                const cargaAtual = cargas.find(c => c.id === cId);
                if (cargaAtual && cargaAtual.rotas) {
                    const rotasAtualizadas = [...cargaAtual.rotas];
                    let hasUpdates = false;
                    Object.keys(rotaAnexos).forEach(key => {
                        const [keyCId, keyRi] = key.split('_');
                        if (keyCId === cId) {
                            const index = parseInt(keyRi);
                            if (rotasAtualizadas[index]) {
                                // Remove duplicatas de URLs caso a pessoa edite
                                const existentes = rotasAtualizadas[index].anexosEntregas || [];
                                const novos = rotaAnexos[key] || [];
                                rotasAtualizadas[index].anexosEntregas = Array.from(new Set([...existentes, ...novos]));
                                hasUpdates = true;
                            }
                        }
                    });
                    if (hasUpdates) {
                        await updateDoc(doc(db, 'cargas', cId), { rotas: rotasAtualizadas });
                    }
                }
            }

            showToast('Prestação de contas enviada com sucesso!');

            setTimeout(() => {
                setStep('identification');
                setGastos([]);
                setSelectedViagens([]);
                setCpfInput('');
                setExistingDocId(null);
                draftDocIdRef.current = null;
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
                        <p className="text-primary/80 text-xs font-bold uppercase tracking-widest">Identifique-se para continuar</p>
                    </div>

                    <form onSubmit={handleIdentification} className="w-full space-y-5">
                        <label className="flex flex-col gap-3">
                            <span className="text-sm font-black text-primary/80 uppercase tracking-widest ml-1">CPF do Motorista</span>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary material-symbols-outlined">fingerprint</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full bg-surface border-2 border-border rounded-2xl pl-12 pr-4 py-4 text-base font-bold outline-none focus:border-primary shadow-xl h-14"
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
                            className="w-full bg-primary text-background-dark py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 h-14"
                        >
                            {loading ? <span className="material-symbols-outlined animate-spin">refresh</span> : 'Entrar'}
                        </button>
                    </form>
                </div>
                {toast && (
                    <div className="fixed bottom-8 px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500 text-red-500 shadow-2xl animate-bounce max-w-xs">
                        <span className="text-sm font-black uppercase">{toast.message}</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-text-primary p-4 pb-60 flex flex-col items-center relative overflow-x-hidden">
            <TimbradoBackground />

            <div className="relative z-10 w-full max-w-lg">
                {/* Header */}
                <div className="flex flex-col items-center mb-6">
                    <img src={CompanyLogo} alt="Golden" className="h-14 mb-4" />
                    <h1 className="text-xl font-black uppercase tracking-tight text-center">Prestação de Contas</h1>
                    <p className="text-primary/80 text-[10px] font-black uppercase tracking-widest mt-1">Identificado: {motorista?.nome}</p>
                </div>

                <div className="space-y-6">
                    {/* Editable Vehicle Info */}
                    <div className="bg-surface/80 backdrop-blur-sm border border-border p-5 rounded-3xl shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-primary">local_shipping</span>
                            <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest">Informações da Viagem</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex flex-col gap-1.5 opacity-80">
                                <span className="text-[9px] font-black text-primary/80 uppercase tracking-widest ml-1">Placa Cavalo</span>
                                <input
                                    type="text"
                                    className="bg-background-dark border border-border rounded-xl px-3 py-2 text-sm font-black uppercase outline-none cursor-not-allowed"
                                    value={placaCavalo}
                                    disabled
                                    readOnly
                                />
                            </label>
                            <label className="flex flex-col gap-1.5 opacity-80">
                                <span className="text-[9px] font-black text-primary/80 uppercase tracking-widest ml-1">Placa Baú</span>
                                <input
                                    type="text"
                                    className="bg-background-dark border border-border rounded-xl px-3 py-2 text-sm font-black uppercase outline-none cursor-not-allowed"
                                    value={placaBau}
                                    disabled
                                    readOnly
                                />
                            </label>
                        </div>

                        
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-primary">hub</span>
                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest">Viagens do Ciclo Atual</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {cargas.length === 0 ? (
                                    <p className="text-[10px] text-primary/80 italic px-2">Nenhuma viagem ativa encontrada no seu nome.</p>
                                ) : (
                                    cargas.filter(c => selectedViagens.includes(c.id)).map(c => (
                                        <div
                                            key={c.id}
                                            className="p-4 rounded-2xl border bg-primary/10 border-primary shadow-lg shadow-primary/5 space-y-3"
                                        >
                                            <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                                                <span className="text-xs font-black uppercase text-primary">Ciclo: {c.codigoViagem}</span>
                                                <span className="bg-primary text-background-dark text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Ativo</span>
                                            </div>
                                            <div className="space-y-2">
                                                {c.rotas && Array.isArray(c.rotas) ? c.rotas.map((r, ri) => (
                                                    <div key={ri} className={`flex flex-col p-2 rounded-xl border gap-2 transition-all duration-300 ${getRotaCardColor(r.status)}`}>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[8px] font-black text-primary uppercase">Rota {ri + 1}</span>
                                                            <span className="text-[8px] font-bold text-primary/80 uppercase">{r.status}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <span className="text-[10px] font-black text-text-primary uppercase tracking-tighter leading-tight flex-1">
                                                                {r.origem} → {r.destino}
                                                            </span>
                                                            {r.cliente && (
                                                                <span className="text-[8px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm uppercase ml-2 max-w-[100px] truncate" title={r.cliente}>
                                                                    {r.cliente}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-center opacity-70">
                                                            <span className="text-[8px] font-black text-primary uppercase">Previsão Chegada:</span>
                                                            <span className="text-[8px] font-bold text-primary uppercase">{r.previsaoChegadaRota || r.previsaoDescarregamentoRota || c.dataPrevistaDescarregamento || '-'}</span>
                                                        </div>
                                                        
                                                        {/* Route Attachment UI */}
                                                        <div className="mt-1 border-t border-primary/10 pt-2">
                                                            {rotaAnexos[`${c.id}_${ri}`] && rotaAnexos[`${c.id}_${ri}`].length > 0 ? (
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                                                        {rotaAnexos[`${c.id}_${ri}`].map((url, imgIndex) => (
                                                                            <div key={imgIndex} className="relative group shrink-0">
                                                                                {url.includes('.pdf') ? (
                                                                                    <div className="w-20 h-20 bg-surface border border-primary/20 rounded-lg flex items-center justify-center">
                                                                                        <span className="material-symbols-outlined text-red-500 text-3xl">picture_as_pdf</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <img src={url} alt="Comprovante" onClick={() => setLightboxUrl(url)} className="w-20 h-20 object-cover rounded-lg border border-primary/20 cursor-pointer active:scale-95 transition-transform" />
                                                                                )}
                                                                                <button 
                                                                                    onClick={() => removeRotaAnexo(c.id, ri, imgIndex)}
                                                                                    className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full shadow-lg"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[12px]">delete</span>
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <label className="flex items-center gap-2 text-primary cursor-pointer hover:underline text-[10px] font-black uppercase">
                                                                        <span className="material-symbols-outlined text-sm">add_a_photo</span> Adicionar mais
                                                                        <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => uploadRotaAnexo(c.id, ri, e)} />
                                                                    </label>
                                                                </div>
                                                            ) : (
                                                                <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-primary/20 rounded-xl bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors relative">
                                                                    {uploadingFiles[`${c.id}_${ri}`] ? (
                                                                        <span className="material-symbols-outlined animate-spin text-primary text-xl">sync</span>
                                                                    ) : (
                                                                        <>
                                                                            <span className="material-symbols-outlined text-primary text-lg">add_a_photo</span>
                                                                            <span className="text-[8px] font-black text-primary uppercase mt-1 flex items-center gap-1">Anexar Comprovantes <span className="text-red-500 material-symbols-outlined text-[10px]">close</span></span>
                                                                        </>
                                                                    )}
                                                                    <input 
                                                                        type="file" 
                                                                        multiple
                                                                        accept="image/*,application/pdf" 
                                                                        className="hidden" 
                                                                        disabled={uploadingFiles[`${c.id}_${ri}`]}
                                                                        onChange={(e) => uploadRotaAnexo(c.id, ri, e)}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="flex flex-col bg-background/50 p-2 rounded-xl border border-primary/10">
                                                        <span className="text-[10px] font-black text-text-primary uppercase tracking-tighter leading-tight">
                                                            {c.origem} → {c.destino}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">flight_takeoff</span>
                                    Saída da Viagem
                                </span>
                                <input
                                    type="date"
                                    className="w-full bg-background border border-border rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:border-primary shadow-inner"
                                    value={dataInicioViagem.split('T')[0]}
                                    onChange={(e) => setDataInicioViagem(e.target.value)}
                                />
                            </label>
                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest ml-1 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">flight_land</span>
                                    Chegada da Viagem
                                </span>
                                <input
                                    type="date"
                                    className="w-full bg-background border border-border rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:border-primary shadow-inner"
                                    value={dataFimViagem.split('T')[0]}
                                    onChange={(e) => setDataFimViagem(e.target.value)}
                                />
                            </label>
                        </div>
                        <div className="bg-background-dark/50 p-3 rounded-2xl border border-border flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] items-center gap-1 font-black text-primary/80 uppercase flex">
                                    <span className="material-symbols-outlined text-[14px]">event_repeat</span>
                                    Total de {calculateDays()} Diárias
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-primary/80">Valor: R$</span>
                                    <span className="text-xs font-black text-primary px-1">{valorDiaria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-[8px] font-bold text-primary/80 uppercase italic bg-border/30 px-1.5 py-0.5 rounded ml-1">Fixo</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-primary/80 uppercase tracking-widest">Total Diárias</span>
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
                            <div className="grid grid-cols-1 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-sm font-black text-primary/80 uppercase tracking-widest ml-1">Categoria</span>
                                    <select
                                        className="w-full bg-background border-2 border-border rounded-2xl px-4 py-4 text-base font-bold outline-none h-14"
                                        value={currentItem.categoria}
                                        onChange={(e) => setCurrentItem({ ...currentItem, categoria: e.target.value })}
                                    >
                                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-sm font-black text-primary/80 uppercase tracking-widest ml-1">Data Gasto</span>
                                    <input
                                        type="date"
                                        className="w-full bg-background border-2 border-border rounded-2xl px-4 py-4 text-base font-bold outline-none h-14"
                                        value={currentItem.data}
                                        onChange={(e) => setCurrentItem({ ...currentItem, data: e.target.value })}
                                    />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-sm font-black text-primary/80 uppercase tracking-widest">Valor da Despesa</span>
                                        <button
                                            type="button"
                                            disabled={uploadingFiles['despesa_atual']}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                document.getElementById('despesa-foto-input')?.click();
                                            }}
                                            className="flex items-center gap-2 text-primary cursor-pointer"
                                        >
                                            {uploadingFiles['despesa_atual'] ? (
                                                <span className="material-symbols-outlined text-base animate-spin">sync</span>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-base">add_a_photo</span>
                                                    <span className="text-sm font-black uppercase">Anexar Fotos</span>
                                                </>
                                            )}
                                        </button>
                                        <input
                                            id="despesa-foto-input"
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
                                            disabled={uploadingFiles['despesa_atual']}
                                            onChange={uploadDespesaAnexo}
                                        />
                                    </div>
                                    {currentItem.anexos && currentItem.anexos.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {currentItem.anexos.map((url, i) => (
                                                <div key={i} className="relative shrink-0">
                                                    {url.includes('.pdf') ? (
                                                        <div className="w-12 h-12 bg-surface rounded-lg flex items-center justify-center border border-primary/20"><span className="material-symbols-outlined text-red-500 text-lg">picture_as_pdf</span></div>
                                                    ) : (
                                                        <img src={url} alt="Comprovante" onClick={() => setLightboxUrl(url)} className="w-12 h-12 object-cover rounded-lg border border-primary/20 cursor-pointer active:scale-95 transition-transform" />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setCurrentItem({...currentItem, anexos: (currentItem.anexos || []).filter((_, idx) => idx !== i)});
                                                        }}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md"
                                                    >
                                                        <span className="material-symbols-outlined text-xs">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-black">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            inputMode="decimal"
                                            className="w-full bg-background border-2 border-border rounded-2xl pl-12 pr-4 py-4 text-base font-bold outline-none focus:border-primary shadow-inner h-14"
                                            placeholder="0,00"
                                            value={currentItem.valor || ''}
                                            onChange={(e) => setCurrentItem({ ...currentItem, valor: parseFloat(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>

                                <label className="flex flex-col gap-2">
                                    <span className="text-sm font-black text-primary/80 uppercase tracking-widest">Observação (Opcional)</span>
                                    <input
                                        className="w-full bg-background border-2 border-border rounded-2xl px-4 py-4 text-base font-bold outline-none focus:border-primary transition-all shadow-inner h-14"
                                        placeholder="Ex: Borracharia na Rodovia BR-116..."
                                        value={currentItem.observacao}
                                        onChange={(e) => setCurrentItem({ ...currentItem, observacao: e.target.value })}
                                    />
                                </label>
                            </div>

                            <button
                                type="button"
                                onClick={addGasto}
                                className="w-full bg-primary/10 border-2 border-primary/30 text-primary py-4 rounded-2xl font-black uppercase tracking-widest text-base active:scale-95 transition-all mt-2 h-14"
                            >
                                Adicionar à Lista
                            </button>
                        </div>
                    </div>

                    {/* Expenses List */}
                    {gastos.length > 0 && (
                        <div className="space-y-2">
                            {gastos.map((g, i) => (
                                <div key={i} className="bg-surface border border-border p-4 rounded-2xl flex items-center justify-between group shadow-sm">
                                    <div className="flex flex-col gap-1 flex-1">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] font-black text-primary uppercase tracking-tighter bg-primary/10 px-2 py-0.5 rounded">{g.categoria}</span>
                                            <span className="text-sm font-black text-text-primary">R$ {g.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            <div className="flex items-center gap-1.5 text-primary/80">
                                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                                <span className="text-[10px] font-bold">{new Date(g.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            {g.anexos && g.anexos.length > 0 && (
                                                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                                    {g.anexos.map((url, imgIdx) => (
                                                        <div key={imgIdx} className="relative shrink-0 mt-2">
                                                            {url.includes('.pdf') ? (
                                                                <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center border border-primary/10"><span className="material-symbols-outlined text-red-500 text-2xl">picture_as_pdf</span></div>
                                                            ) : (
                                                                <img src={url} alt="Comprovante" onClick={() => setLightboxUrl(url)} className="w-16 h-16 object-cover rounded-lg border border-primary/10 cursor-pointer active:scale-95 transition-transform" />
                                                            )}
                                                            <button 
                                                                type="button" 
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    const updatedGastos = [...gastos];
                                                                    updatedGastos[i].anexos = (updatedGastos[i].anexos || []).filter((_, idx) => idx !== imgIdx);
                                                                    setGastos(updatedGastos);
                                                                }}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md flex items-center justify-center"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px]">close</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {g.observacao && (
                                                <div className="flex items-start gap-1.5 text-text-secondary bg-background-dark/50 p-2 rounded-xl border border-border/50 mt-1">
                                                    <span className="material-symbols-outlined text-[14px] mt-0.5">sticky_note_2</span>
                                                    <p className="text-[10px] font-medium leading-relaxed italic">{g.observacao}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button onClick={() => editGasto(i)} className="size-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center active:scale-90 transition-transform">
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                        <button onClick={() => removeGasto(i)} className="size-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90 transition-transform">
                                            <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Final Total Summary */}
                    <div className="bg-background-dark/95 backdrop-blur-md border-2 border-primary/30 p-5 rounded-3xl shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-border/50">
                            <span className="text-sm font-black text-primary/80 uppercase tracking-widest">Diárias ({calculateDays()}x)</span>
                            <span className="text-xl font-black text-text-primary">R$ {totalDiarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-border/50">
                            <span className="text-sm font-black text-primary/80 uppercase tracking-widest">Total Despesas</span>
                            <span className="text-xl font-black text-text-primary">R$ {totalDespesasItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-base font-black text-primary uppercase tracking-widest">Total Geral Acerto</span>
                            <span className="text-3xl font-black text-primary">
                                R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Fixed Submit Button for Mobile */}
                    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border p-4 z-50">
                        <div className="max-w-lg mx-auto">
                            <p className="text-xs font-bold text-primary/80 mb-3 text-center px-4">
                                Ao enviar, confirmo a veracidade de todas as diárias e gastos.
                            </p>
                            <button
                                onClick={() => setIsConfirmModalOpen(true)}
                                disabled={submitting}
                                className="w-full bg-primary text-background-dark py-4 rounded-2xl text-base font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2 h-14"
                            >
                                {submitting ? (
                                    <span className="material-symbols-outlined animate-spin">sync</span>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-xl">check_circle</span>
                                        Enviar Acerto
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lightbox Modal */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                    onClick={() => setLightboxUrl(null)}
                >
                    <button
                        onClick={() => setLightboxUrl(null)}
                        className="absolute top-5 right-5 size-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                    <img
                        src={lightboxUrl}
                        alt="Comprovante"
                        className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Confirmation Modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-sm" onClick={() => setIsConfirmModalOpen(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 shadow-2xl text-center">
                        <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-primary text-4xl">contact_support</span>
                        </div>
                        <h3 className="text-xl font-black text-text-primary uppercase tracking-tight mb-2">Deseja Finalizar?</h3>
                        <p className="text-primary/80 text-xs font-bold leading-relaxed mb-8 uppercase tracking-widest">
                            Confirme se todas as rotas foram concluídas e as despesas anexadas. Após o envio, os dados serão processados pela administração.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => {
                                    setIsConfirmModalOpen(false);
                                    handleSubmit();
                                }}
                                className="w-full bg-primary text-background-dark py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl"
                            >
                                Sim, Finalizar Agora
                            </button>
                            <button 
                                onClick={() => setIsConfirmModalOpen(false)}
                                className="w-full bg-background border border-border text-primary/80 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                            >
                                Revisar Informações
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
