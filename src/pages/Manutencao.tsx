import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
    Construction, 
    History, 
    Timer, 
    Wrench,
    Plus,
    Search,
    Truck,
    Receipt
} from 'lucide-react';

interface ManutencaoRecord {
    id: string;
    veiculoId: string;
    placa: string;
    tipo: 'preventiva' | 'corretiva';
    data: string;
    kmAtual: number;
    descricao: string;
    oficina: string;
    valorTotal: number;
    status: 'pendente' | 'em_execucao' | 'concluida';
    proximaRevisaoKM?: number;
    itens?: any[];
    anexoUrl?: string;
    criadoEm: any;
}

interface Veiculo {
    id: string;
    placa: string;
}

function Manutencao() {
    const [records, setRecords] = useState<ManutencaoRecord[]>([]);
    const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'todos' | 'preventiva' | 'corretiva'>('todos');
    
    const [formData, setFormData] = useState({
        veiculoId: '',
        placa: '',
        tipo: 'corretiva' as 'preventiva' | 'corretiva',
        data: new Date().toISOString().split('T')[0],
        kmAtual: 0,
        descricao: '',
        oficina: '',
        valorTotal: 0,
        status: 'concluida' as 'pendente' | 'em_execucao' | 'concluida',
        proximaRevisaoKM: 0
    });

    useEffect(() => {
        const q = query(collection(db, 'manutencoes'), orderBy('criadoEm', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManutencaoRecord));
            setRecords(list);
            setLoading(false);
        });

        const unsubVeic = onSnapshot(collection(db, 'veiculos'), (snapshot) => {
            setVeiculos(snapshot.docs.map(doc => ({ id: doc.id, placa: doc.data().placa })));
        });

        return () => {
            unsubscribe();
            unsubVeic();
        };
    }, []);

    const handleVehicleChange = (veiculoId: string) => {
        const v = veiculos.find(x => x.id === veiculoId);
        setFormData({ ...formData, veiculoId, placa: v?.placa || '' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addDoc(collection(db, 'manutencoes'), {
                ...formData,
                criadoEm: serverTimestamp()
            });
            setIsFormOpen(false);
            setFormData({
                veiculoId: '',
                placa: '',
                tipo: 'corretiva',
                data: new Date().toISOString().split('T')[0],
                kmAtual: 0,
                descricao: '',
                oficina: '',
                valorTotal: 0,
                status: 'concluida',
                proximaRevisaoKM: 0
            });
        } catch (error) {
            console.error("Erro ao salvar manutenção:", error);
            alert("Erro ao salvar manutenção");
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = records.filter(r => {
        const matchSearch = r.placa.toLowerCase().includes(searchTerm.toLowerCase()) || r.descricao.toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = filterType === 'todos' || r.tipo === filterType;
        return matchSearch && matchType;
    });

    const stats = {
        totalGasto: records.reduce((acc, curr) => acc + (Number(curr.valorTotal) || 0), 0),
        preventivas: records.filter(r => r.tipo === 'preventiva').length,
        corretivas: records.filter(r => r.tipo === 'corretiva').length,
        veiculosNaOficina: records.filter(r => r.status === 'em_execucao').length
    };

    return (
        <div className="space-y-8 pb-10 animate-fade-in text-text-primary">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Wrench size={24} />
                        </div>
                        Gestão de Manutenção
                    </h1>
                    <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-1">Controle de Saúde e Custos da Frota</p>
                </div>

                <button 
                    onClick={() => setIsFormOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-background-dark font-black h-12 px-8 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 uppercase text-xs tracking-widest"
                >
                    <Plus size={18} />
                    Nova Manutenção
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                            <Receipt size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-tight">Gasto Total<br/>(Histórico)</span>
                    </div>
                    <h4 className="text-3xl font-black text-text-primary tracking-tighter">R$ {stats.totalGasto.toLocaleString('pt-BR')}</h4>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                            <History size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-tight">Revisões<br/>Preventivas</span>
                    </div>
                    <h4 className="text-3xl font-black text-text-primary tracking-tighter">{stats.preventivas}</h4>
                </div>

                <div className="bg-surface border border-border p-6 rounded-[28px] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
                            <Construction size={18} />
                        </div>
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-tight">Manutenções<br/>Corretivas</span>
                    </div>
                    <h4 className="text-3xl font-black text-text-primary tracking-tighter">{stats.corretivas}</h4>
                </div>

                <div className="bg-primary/10 border border-primary/20 p-6 rounded-[28px] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Truck size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/20 text-primary rounded-xl">
                                <Timer size={18} />
                            </div>
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-tight">Veículos na<br/>Oficina</span>
                        </div>
                        <h4 className="text-3xl font-black text-text-primary tracking-tighter">{stats.veiculosNaOficina}</h4>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface border border-border rounded-[32px] p-6 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar por placa ou descrição..."
                        className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-3 text-xs focus:border-primary outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 bg-background-dark p-1.5 rounded-2xl border border-border">
                    <button 
                        onClick={() => setFilterType('todos')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'todos' ? 'bg-primary text-background-dark shadow-lg' : 'text-text-muted hover:text-text-primary'}`}
                    >
                        Todos
                    </button>
                    <button 
                        onClick={() => setFilterType('preventiva')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'preventiva' ? 'bg-blue-500 text-white shadow-lg' : 'text-text-muted hover:text-text-primary'}`}
                    >
                        Preventiva
                    </button>
                    <button 
                        onClick={() => setFilterType('corretiva')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'corretiva' ? 'bg-orange-500 text-white shadow-lg' : 'text-text-muted hover:text-text-primary'}`}
                    >
                        Corretiva
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-surface border border-border rounded-[40px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-background-dark/50 text-[10px] font-black uppercase tracking-widest text-text-muted border-b border-border">
                                <th className="px-8 py-5">Veículo / Placa</th>
                                <th className="px-8 py-5">Data / KM</th>
                                <th className="px-8 py-5">Tipo e Descrição</th>
                                <th className="px-8 py-5">Oficina</th>
                                <th className="px-8 py-5 text-right">Valor Total</th>
                                <th className="px-8 py-5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center text-text-muted text-xs uppercase tracking-widest font-black">
                                        Nenhum registro de manutenção encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((r) => (
                                    <tr key={r.id} className="hover:bg-primary/5 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-primary uppercase tracking-tighter">{r.placa}</span>
                                                <span className="text-[10px] text-text-muted font-bold">ID: {r.id.slice(0,8)}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-text-primary">{new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                                <span className="text-[10px] text-text-muted font-bold tracking-widest">{r.kmAtual.toLocaleString()} KM</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col max-w-xs">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${r.tipo === 'preventiva' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                                                        {r.tipo}
                                                    </span>
                                                    {r.proximaRevisaoKM && <span className="text-[8px] font-black uppercase text-emerald-500">Prox: {r.proximaRevisaoKM.toLocaleString()} KM</span>}
                                                </div>
                                                <p className="text-xs font-medium text-text-secondary truncate" title={r.descricao}>{r.descricao}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-xs font-bold text-text-secondary">{r.oficina}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className="text-sm font-black text-text-primary">R$ {r.valorTotal.toLocaleString('pt-BR')}</span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                r.status === 'concluida' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                r.status === 'em_execucao' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                            }`}>
                                                {r.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Form */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-md" onClick={() => setIsFormOpen(false)}></div>
                    <div className="bg-surface border border-primary/20 w-full max-w-2xl rounded-[40px] shadow-2xl relative z-10 p-8 flex flex-col max-h-[90vh]">
                        <h3 className="text-2xl font-black text-text-primary uppercase tracking-tight mb-8">Novo Registro de Manutenção</h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Veículo</span>
                                    <select 
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none"
                                        value={formData.veiculoId}
                                        onChange={(e) => handleVehicleChange(e.target.value)}
                                        required
                                    >
                                        <option value="">Selecione um veículo</option>
                                        {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Tipo</span>
                                    <select 
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none"
                                        value={formData.tipo}
                                        onChange={(e) => setFormData({...formData, tipo: e.target.value as any})}
                                        required
                                    >
                                        <option value="corretiva">Corretiva</option>
                                        <option value="preventiva">Preventiva (Revisão)</option>
                                    </select>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Data</span>
                                    <input 
                                        type="date"
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none"
                                        value={formData.data}
                                        onChange={(e) => setFormData({...formData, data: e.target.value})}
                                        required
                                    />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">KM Atual</span>
                                    <input 
                                        type="number"
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none"
                                        value={formData.kmAtual || ''}
                                        onChange={(e) => setFormData({...formData, kmAtual: Number(e.target.value)})}
                                        required
                                    />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Valor Total</span>
                                    <input 
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none"
                                        value={formData.valorTotal || ''}
                                        onChange={(e) => setFormData({...formData, valorTotal: Number(e.target.value)})}
                                        required
                                    />
                                </label>
                            </div>

                            <label className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Descrição do Serviço</span>
                                <textarea 
                                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none min-h-[100px] resize-none"
                                    placeholder="Ex: Troca de óleo, filtros e revisão dos freios..."
                                    value={formData.descricao}
                                    onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                                    required
                                />
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Oficina / Estabelecimento</span>
                                    <input 
                                        type="text"
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none"
                                        value={formData.oficina}
                                        onChange={(e) => setFormData({...formData, oficina: e.target.value})}
                                        required
                                    />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black text-text-muted uppercase tracking-widest ml-1">Status</span>
                                    <select 
                                        className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm focus:border-primary outline-none"
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                                    >
                                        <option value="concluida">Concluída</option>
                                        <option value="em_execucao">Em Execução (Oficina)</option>
                                        <option value="pendente">Pendente / Agendada</option>
                                    </select>
                                </label>
                            </div>

                            {formData.tipo === 'preventiva' && (
                                <label className="flex flex-col gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/20 animate-in slide-in-from-top-4">
                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Timer size={14} /> Alerta de Próxima Revisão (KM)
                                    </span>
                                    <input 
                                        type="number"
                                        placeholder="Ex: 150000 (Avisar quando atingir este KM)"
                                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
                                        value={formData.proximaRevisaoKM || ''}
                                        onChange={(e) => setFormData({...formData, proximaRevisaoKM: Number(e.target.value)})}
                                    />
                                </label>
                            )}

                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsFormOpen(false)}
                                    className="flex-1 h-14 bg-background border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] h-14 bg-primary text-background-dark rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'Salvando...' : 'Salvar Manutenção'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Manutencao;
