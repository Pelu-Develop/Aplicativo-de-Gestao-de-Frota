import { useState, useEffect } from 'react';
import {
    collection,
    onSnapshot,
    query,
    where,
    doc,
    addDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Motorista {
    id: string;
    nome: string;
}

interface DespesaBruta {
    id: string;
    motoristaNomeOriginal: string;
    valor: number;
    data: any;
    descricao?: string;
    categoria?: string;
    tipo?: 'prestacao_contas';
    items?: any[];
    dataInicio?: string;
    dataFim?: string;
    totalDiarias?: number;
    diasDiaria?: number;
    valorDiaria?: number;
    motoristaId?: string;
    motoristaNome?: string;
    placaCavalo?: string;
    placaBau?: string;
    dataRegistro?: any;
    valorTotal?: number;
}

interface Carga {
    id: string;
    codigoViagem: string;
    motoristaNome: string;
    motoristaId?: string;
    status: string;
    origem: string;
    destino: string;
}

export default function Conciliacao() {
    const [despesasBrutas, setDespesasBrutas] = useState<DespesaBruta[]>([]);
    const [motoristas, setMotoristas] = useState<Motorista[]>([]);
    const [cargas, setCargas] = useState<Carga[]>([]);
    const [loading, setLoading] = useState(true);
    const [matchingId, setMatchingId] = useState<string | null>(null);
    const [selectedMotoristaId, setSelectedMotoristaId] = useState('');
    const [viewingItem, setViewingItem] = useState<DespesaBruta | null>(null);
    const [editData, setEditData] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);

    const [submitting, setSubmitting] = useState(false);

    // Fetch Motoristas
    useEffect(() => {
        const q = query(collection(db, 'motoristas'), where('vinculo', '==', 'propria'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                nome: doc.data().nome
            } as Motorista));
            setMotoristas(list);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Raw/Imported Expenses (Simulating a collection 'despesas_brutas')
    useEffect(() => {
        const q = query(collection(db, 'despesas_brutas')); // You can change this collection name as needed
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as DespesaBruta));
            setDespesasBrutas(list);
            setLoading(false);
        }, (error) => {
            console.error("Collection 'despesas_brutas' not found or forbidden:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Trips (to link)
    useEffect(() => {
        const q = query(collection(db, 'cargas'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Carga));
            setCargas(list);
        });
        return () => unsubscribe();
    }, []);

    const handleMatch = async (bruta: DespesaBruta, modifiedData?: any) => {
        if (bruta.tipo !== 'prestacao_contas' && !selectedMotoristaId) return;

        setSubmitting(true);
        try {
            const motorista = motoristas.find(m => m.id === selectedMotoristaId);
            const dataToUse = modifiedData || bruta;
            const finalValor = dataToUse.valor ?? dataToUse.valorTotal ?? 0;

            // 1. Add to official despesas_frota
            const finalPayload = bruta.tipo === 'prestacao_contas' ? {
                motoristaNome: dataToUse.motoristaNome,
                motoristaId: dataToUse.motoristaId,
                motoristaCPF: (dataToUse as any).motoristaCPF || '',
                placaCavalo: dataToUse.placaCavalo || '',
                placaBau: dataToUse.placaBau || '',
                dataInicio: dataToUse.dataInicio || '',
                dataFim: dataToUse.dataFim || '',
                diasDiaria: dataToUse.diasDiaria || 0,
                valorDiaria: dataToUse.valorDiaria || 0,
                totalDiarias: (dataToUse.diasDiaria || 0) * (dataToUse.valorDiaria || 0),
                valorTotal: finalValor,
                saldoFinal: finalValor,
                items: dataToUse.items || [],
                status: 'pendente',
                dataRegistro: serverTimestamp(),
                origem: 'conciliacao_motorista',
                viagensIds: dataToUse.viagensIds || []
            } : {
                motoristaNome: motorista?.nome,
                motoristaId: selectedMotoristaId,
                valorTotal: finalValor,
                dataRegistro: bruta.data || serverTimestamp(),
                items: [{
                    categoria: bruta.categoria || 'Outros',
                    valor: finalValor,
                    descricao: bruta.descricao || `Importado: ${bruta.motoristaNomeOriginal}`,
                    data: new Date().toISOString().split('T')[0]
                }],
                status: 'pendente'
            };

            await addDoc(collection(db, 'despesas_frota'), finalPayload);

            // 2. Remove from raw list
            await deleteDoc(doc(db, 'despesas_brutas', bruta.id));

            setMatchingId(null);
            setSelectedMotoristaId('');
            setViewingItem(null);
            setIsEditing(false);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenView = (b: DespesaBruta) => {
        setViewingItem(b);
        setIsEditing(false);
        setEditData({
            ...b,
            valor: b.valor ?? b.valorTotal ?? 0,
            valorDiaria: b.valorDiaria ?? 0,
            diasDiaria: b.diasDiaria ?? 0,
            items: b.items ? JSON.parse(JSON.stringify(b.items)) : []
        });
    };

    const handleEditChange = (field: string, value: any) => {
        setEditData((prev: any) => {
            const newData = { ...prev, [field]: value };

            // Recalculate totals
            const totalDiarias = (Number(newData.diasDiaria) || 0) * (Number(newData.valorDiaria) || 0);
            const totalItems = (newData.items || []).reduce((acc: number, item: any) => acc + (Number(item.valor) || 0), 0);
            newData.valor = totalDiarias + totalItems;
            newData.totalDiarias = totalDiarias;

            return newData;
        });
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        setEditData((prev: any) => {
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };

            const totalDiarias = (Number(prev.diasDiaria) || 0) * (Number(prev.valorDiaria) || 0);
            const totalItems = newItems.reduce((acc: number, item: any) => acc + (Number(item.valor) || 0), 0);

            return {
                ...prev,
                items: newItems,
                valor: totalDiarias + totalItems
            };
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-text-primary text-2xl lg:text-3xl font-bold">Conciliação de Despesas</h1>
                <p className="text-text-muted text-sm">Vincule despesas importadas do banco de dados aos motoristas cadastrados.</p>
            </div>

            <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border text-[10px] font-black text-text-muted uppercase tracking-widest">
                                <th className="px-6 py-4">Nome no Banco (Original)</th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Valor</th>
                                <th className="px-6 py-4">Descrição</th>
                                <th className="px-6 py-4 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr><td colSpan={5} className="p-20 text-center text-text-muted uppercase text-[10px] font-black tracking-widest">Sincronizando banco de dados...</td></tr>
                            ) : despesasBrutas.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center text-text-muted">
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-4xl opacity-20">database_off</span>
                                            <p>Nenhuma despesa pendente de conciliação.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                despesasBrutas.map((b) => (
                                    <tr key={b.id} className="hover:bg-primary/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-text-primary font-bold text-sm">
                                                    {b.motoristaNomeOriginal}
                                                </span>
                                                {b.tipo === 'prestacao_contas' && (
                                                    <span className="text-[9px] font-black uppercase text-primary bg-primary/10 w-fit px-1.5 rounded mt-1">
                                                        Prestação de Contas
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-text-muted">
                                            {b.data?.toDate ? b.data.toDate().toLocaleDateString('pt-BR') :
                                                b.dataRegistro?.toDate ? b.dataRegistro.toDate().toLocaleDateString('pt-BR') : '---'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-primary font-black">R$ {(b.valor ?? b.valorTotal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-text-muted italic">
                                            {b.tipo === 'prestacao_contas'
                                                ? `${b.items?.length || 0} itens + ${b.diasDiaria} diárias`
                                                : b.descricao || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {b.tipo === 'prestacao_contas' ? (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenView(b)}
                                                        className="bg-background border border-border size-8 rounded-lg flex items-center justify-center text-text-muted hover:text-primary transition-all shadow-sm"
                                                        title="Ver Detalhes"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleMatch(b)}
                                                        disabled={submitting}
                                                        className="bg-primary text-background-dark px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-md flex items-center gap-1.5"
                                                    >
                                                        {submitting ? '...' : (
                                                            <>
                                                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                                                Aprovar
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : matchingId === b.id ? (
                                                <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-2">
                                                    <select
                                                        className="bg-background border border-primary/30 rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-primary"
                                                        value={selectedMotoristaId}
                                                        onChange={(e) => setSelectedMotoristaId(e.target.value)}
                                                    >
                                                        <option value="">Vincular a...</option>
                                                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={() => handleMatch(b)}
                                                        disabled={!selectedMotoristaId || submitting}
                                                        className="bg-primary text-background-dark p-1.5 rounded-lg hover:bg-primary/80 disabled:opacity-50"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">check</span>
                                                    </button>
                                                    <button onClick={() => setMatchingId(null)} className="text-text-muted p-1.5">
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setMatchingId(b.id)}
                                                    className="bg-background border border-border px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-primary hover:border-primary transition-all shadow-sm"
                                                >
                                                    Conciliar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View/Edit Details Modal for Prestação de Contas */}
            {viewingItem && editData && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => setViewingItem(null)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-primary/5">
                            <h3 className="text-lg font-black text-text-primary uppercase tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">{isEditing ? 'edit_document' : 'description'}</span>
                                {isEditing ? 'Editar Prestação' : 'Detalhes da Prestação'}
                            </h3>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${isEditing ? 'bg-primary text-background-dark border-primary' : 'bg-background text-text-muted border-border hover:border-primary hover:text-primary'}`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">{isEditing ? 'close' : 'edit'}</span>
                                    {isEditing ? 'Cancelar Edição' : 'Editar'}
                                </button>
                                <button onClick={() => setViewingItem(null)} className="text-text-muted hover:text-red-500">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                            <div className="bg-background/50 p-4 rounded-2xl border border-border grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-black text-text-muted uppercase mb-1">Motorista</p>
                                    <p className="text-sm font-bold text-text-primary">{editData.motoristaNomeOriginal}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-text-muted uppercase mb-1">Veículo</p>
                                    <p className="text-sm font-bold text-text-primary">{editData.placaCavalo} {editData.placaBau ? `/ ${editData.placaBau}` : ''}</p>
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest pl-1">Vincular Viagens</p>
                                    <div className="flex flex-wrap gap-2">
                                        {cargas
                                            .filter(c => c.motoristaId === editData.motoristaId || c.motoristaNome === editData.motoristaNomeOriginal)
                                            .slice(0, 5) // Show only recent 5 as options or similar
                                            .map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => {
                                                        const current = editData.viagensIds || [];
                                                        const next = current.includes(c.id) 
                                                            ? current.filter((id: string) => id !== c.id) 
                                                            : [...current, c.id];
                                                        handleEditChange('viagensIds', next);
                                                    }}
                                                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all flex flex-col items-start gap-1 ${
                                                        (editData.viagensIds || []).includes(c.id)
                                                            ? 'bg-primary/20 border-primary text-primary'
                                                            : 'bg-background border-border text-text-muted hover:border-primary/50'
                                                    }`}
                                                >
                                                    <span>{c.codigoViagem}</span>
                                                    <span className="opacity-50 lowercase font-medium">{c.origem.split(',')[0]} → {c.destino.split(',')[0]}</span>
                                                </button>
                                            ))}
                                    </div>
                                    <p className="text-[9px] text-text-muted italic">Selecione as viagens que compõem este acerto para cálculo de lucratividade.</p>
                                </div>
                                <div className="col-span-2 h-px bg-border"></div>
                                <div>
                                    <p className="text-[10px] font-black text-text-muted uppercase mb-1">Início Viagem</p>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={editData.dataInicio || ''}
                                            onChange={e => handleEditChange('dataInicio', e.target.value)}
                                            className="bg-surface border border-border text-sm rounded-lg px-2 py-1 outline-none focus:border-primary"
                                        />
                                    ) : (
                                        <p className="text-xs font-bold">{editData.dataInicio ? new Date(editData.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                                    )}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-text-muted uppercase mb-1">Fim Viagem</p>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={editData.dataFim || ''}
                                            onChange={e => handleEditChange('dataFim', e.target.value)}
                                            className="bg-surface border border-border text-sm rounded-lg px-2 py-1 outline-none focus:border-primary"
                                        />
                                    ) : (
                                        <p className="text-xs font-bold">{editData.dataFim ? new Date(editData.dataFim + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest pl-1">Resumo Financeiro</h4>
                                <div className="space-y-3">
                                    <div className="flex flex-col md:flex-row justify-between items-center bg-background p-4 rounded-xl border border-border gap-4">
                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                            <span className="text-xs text-text-muted font-bold">Diárias:</span>
                                            {isEditing ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number" min="0" step="1"
                                                        value={editData.diasDiaria}
                                                        onChange={e => handleEditChange('diasDiaria', Number(e.target.value))}
                                                        className="w-16 bg-surface border border-border text-xs rounded-lg px-2 py-1 outline-none focus:border-primary"
                                                    />
                                                    <span className="text-xs text-text-muted">x R$</span>
                                                    <input
                                                        type="number" min="0" step="0.01"
                                                        value={editData.valorDiaria}
                                                        onChange={e => handleEditChange('valorDiaria', Number(e.target.value))}
                                                        className="w-24 bg-surface border border-border text-xs rounded-lg px-2 py-1 outline-none focus:border-primary"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-xs text-text-muted lowercase">{editData.diasDiaria}x R$ {editData.valorDiaria}</span>
                                            )}
                                        </div>
                                        <span className="text-sm font-black text-right w-full md:w-auto">
                                            R$ {editData.totalDiarias?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    {editData.items?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex flex-col bg-background p-4 rounded-xl border border-border gap-2">
                                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                                                {isEditing ? (
                                                    <select
                                                        value={item.categoria}
                                                        onChange={e => handleItemChange(idx, 'categoria', e.target.value)}
                                                        className="bg-surface border border-border text-xs rounded-lg px-2 py-1.5 outline-none focus:border-primary"
                                                    >
                                                        <option value="Peças">Peças</option>
                                                        <option value="Serviços">Serviços</option>
                                                        <option value="Lavagem">Lavagem</option>
                                                        <option value="Descarga">Descarga</option>
                                                        <option value="Estacionamento">Estacionamento</option>
                                                        <option value="Transporte">Transporte</option>
                                                        <option value="Borracharia">Borracharia</option>
                                                        <option value="Outros">Outros</option>
                                                    </select>
                                                ) : (
                                                    <span className="text-[10px] font-black uppercase text-primary">{item.categoria}</span>
                                                )}

                                                {isEditing ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="date"
                                                            value={item.data || ''}
                                                            onChange={e => handleItemChange(idx, 'data', e.target.value)}
                                                            className="bg-surface border border-border text-[10px] rounded-lg px-2 py-1.5 outline-none focus:border-primary"
                                                        />
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs text-text-muted font-bold">R$</span>
                                                            <input
                                                                type="number" min="0" step="0.01"
                                                                value={item.valor}
                                                                onChange={e => handleItemChange(idx, 'valor', Number(e.target.value))}
                                                                className="w-24 bg-surface border border-border text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-primary"
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        {item.data && (
                                                            <span className="text-[10px] text-text-muted font-medium flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                                                {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                            </span>
                                                        )}
                                                        <span className="text-sm font-black text-text-primary">R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={item.descricao}
                                                    onChange={e => handleItemChange(idx, 'descricao', e.target.value)}
                                                    placeholder="Descrição (opcional)"
                                                    className="w-full bg-surface border border-border text-xs rounded-lg px-2 py-1.5 outline-none focus:border-primary"
                                                />
                                            ) : (
                                                <p className="text-[10px] text-text-muted italic">{item.descricao || 'Sem observação'}</p>
                                            )}
                                        </div>
                                    ))}

                                    <div className="flex justify-between items-center bg-primary/10 p-5 rounded-xl border border-primary/20 mt-6 shadow-inner">
                                        <span className="text-xs font-black text-primary uppercase">Total Geral {isEditing && '(Recalculado)'}</span>
                                        <span className="text-xl font-black text-primary">R$ {(editData.valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border flex gap-3">
                            <button
                                onClick={() => setViewingItem(null)}
                                className="flex-1 py-3 text-[10px] font-black uppercase text-text-muted hover:bg-border/20 rounded-xl transition-all"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={() => { handleMatch(viewingItem, editData); }}
                                disabled={submitting}
                                className="flex-[2] py-3 bg-primary text-background-dark text-[10px] font-black uppercase rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2"
                            >
                                {submitting ? 'Aprovando...' : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        {isEditing ? 'Salvar Edição e Aprovar' : 'Aprovar Agora'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
