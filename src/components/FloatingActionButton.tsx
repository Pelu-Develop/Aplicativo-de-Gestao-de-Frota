import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Truck, Receipt, Landmark, X } from 'lucide-react';

export default function FloatingActionButton() {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const actions = [
        {
            icon: <Truck size={20} />,
            label: 'Nova Viagem',
            color: 'bg-primary text-background-dark',
            onClick: () => {
                navigate('/cargas?action=new');
                setIsOpen(false);
            }
        },
        {
            icon: <Receipt size={20} />,
            label: 'Nova Despesa',
            color: 'bg-emerald-500 text-white',
            onClick: () => {
                navigate('/despesas?action=new');
                setIsOpen(false);
            }
        },
        {
            icon: <Landmark size={20} />,
            label: 'Nova Comissão',
            color: 'bg-blue-500 text-white',
            onClick: () => {
                navigate('/cargas?action=new&commission=true');
                setIsOpen(false);
            }
        }
    ];

    return (
        <div className="fixed bottom-24 right-6 md:bottom-8 md:right-8 z-[100] flex flex-col items-end gap-3">
            {/* Action Buttons */}
            {isOpen && (
                <div className="flex flex-col items-end gap-3 mb-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
                    {actions.map((action, index) => (
                        <div key={index} className="flex items-center gap-3 group">
                            <span className="bg-surface border border-border px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-primary shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {action.label}
                            </span>
                            <button
                                onClick={action.onClick}
                                className={`${action.color} p-4 rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center`}
                            >
                                {action.icon}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`${isOpen ? 'bg-surface border border-border text-text-primary' : 'bg-primary text-background-dark'} p-5 rounded-[24px] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center group`}
            >
                {isOpen ? (
                    <X size={28} className="animate-in fade-in zoom-in duration-300" />
                ) : (
                    <Plus size={28} className="animate-in fade-in zoom-in duration-300" />
                )}
                
                {!isOpen && (
                    <span className="absolute right-full mr-4 bg-primary text-background-dark px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Acesso Rápido
                    </span>
                )}
            </button>
        </div>
    );
}
