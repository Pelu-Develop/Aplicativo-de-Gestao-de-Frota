export default function Comissoes() {
    return (
        <>
            <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
                <div className="flex min-w-72 flex-col gap-2">
                    <p className="text-slate-100 text-[28px] md:text-[32px] font-bold leading-tight tracking-[-0.033em]">Gestão de Comissões</p>
                    <p className="text-slate-400 text-sm font-normal leading-normal">Gestão financeira de comissões de motoristas.</p>
                </div>
                <button className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 border border-primary text-primary hover:bg-primary/10 transition-colors text-sm font-bold leading-normal tracking-[0.015em]">
                    <span className="material-symbols-outlined mr-2 text-[20px]">add</span>
                    <span className="truncate">Adicionar Comissão Manual</span>
                </button>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl p-6 bg-surface-dark border border-border-dark shadow-sm group hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
                        <p className="text-slate-400 text-sm font-medium leading-normal uppercase tracking-wider">Total Geral</p>
                    </div>
                    <p className="text-primary tracking-tight text-3xl font-bold leading-tight">R$ 150.000,00</p>
                    <p className="text-green-400 text-sm font-medium leading-normal flex items-center mt-1">
                        <span className="material-symbols-outlined text-[16px] mr-1">trending_up</span> +15% vs mês anterior
                    </p>
                </div>
                <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl p-6 bg-surface-dark border border-border-dark shadow-sm group hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-xl">calendar_month</span>
                        <p className="text-slate-400 text-sm font-medium leading-normal uppercase tracking-wider">Total Mensal</p>
                    </div>
                    <p className="text-primary tracking-tight text-3xl font-bold leading-tight">R$ 45.000,00</p>
                    <p className="text-green-400 text-sm font-medium leading-normal flex items-center mt-1">
                        <span className="material-symbols-outlined text-[16px] mr-1">trending_up</span> +5% vs mês anterior
                    </p>
                </div>
                <div className="flex min-w-[158px] flex-1 flex-col gap-2 rounded-xl p-6 bg-surface-dark border border-border-dark shadow-sm group hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-xl">view_week</span>
                        <p className="text-slate-400 text-sm font-medium leading-normal uppercase tracking-wider">Total Semanal</p>
                    </div>
                    <p className="text-primary tracking-tight text-3xl font-bold leading-tight">R$ 10.000,00</p>
                    <p className="text-red-400 text-sm font-medium leading-normal flex items-center mt-1">
                        <span className="material-symbols-outlined text-[16px] mr-1">trending_down</span> -2% vs semana anterior
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex min-w-72 flex-1 flex-col gap-4 rounded-xl border border-border-dark p-6 bg-surface-dark shadow-sm">
                    <h3 className="text-slate-100 text-lg font-bold leading-normal">Distribuição por Status</h3>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
                        <div className="relative w-48 h-48 flex items-center justify-center rounded-full border-[16px] border-background-dark">
                            <div className="absolute inset-0 rounded-full border-[16px] border-transparent border-t-primary border-r-primary border-b-primary/60 transform rotate-45"></div>
                            <div className="text-center z-10">
                                <p className="text-slate-400 text-xs uppercase font-medium">Total</p>
                                <p className="text-slate-100 text-xl font-bold">45k</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 min-w-[200px]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                                    <span className="text-slate-300 text-sm font-medium">Recebida</span>
                                </div>
                                <span className="text-slate-100 font-bold">R$ 28.500</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-primary/60"></div>
                                    <span className="text-slate-300 text-sm font-medium">Parcial</span>
                                </div>
                                <span className="text-slate-100 font-bold">R$ 10.200</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-border-dark"></div>
                                    <span className="text-slate-300 text-sm font-medium">Pendente</span>
                                </div>
                                <span className="text-slate-100 font-bold">R$ 6.300</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pb-3 pt-5 flex justify-between items-center mb-4">
                <h2 className="text-slate-100 text-[22px] font-bold leading-tight tracking-[-0.015em]">Lista de Comissões</h2>
                <div className="flex gap-2">
                    <button className="flex items-center justify-center p-2 rounded-lg bg-surface-dark border border-border-dark text-slate-300 hover:border-primary/50 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">filter_list</span>
                    </button>
                    <button className="flex items-center justify-center p-2 rounded-lg bg-surface-dark border border-border-dark text-slate-300 hover:border-primary/50 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">sort</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-3 pb-10">
                {/* List Item 1 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-surface-dark border border-border-dark hover:border-primary/50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">local_shipping</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <p className="text-slate-100 font-bold">Carga #8492</p>
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-900/30 text-green-400 border border-green-800/50 uppercase tracking-wide">Recebida</span>
                            </div>
                            <p className="text-slate-400 text-sm truncate max-w-xs md:max-w-md">São Paulo, SP → Rio de Janeiro, RJ • 12 Out 2023</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-border-dark pt-3 md:pt-0">
                        <div className="flex flex-col md:items-end">
                            <p className="text-slate-400 text-xs uppercase font-medium mb-1">Valor da Comissão</p>
                            <p className="text-primary text-xl font-bold group-hover:scale-105 transition-transform origin-right">R$ 1.250,00</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">chevron_right</span>
                    </div>
                </div>

                {/* List Item 2 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-surface-dark border border-border-dark hover:border-primary/50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">local_shipping</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <p className="text-slate-100 font-bold">Carga #8491</p>
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-900/30 text-amber-400 border border-amber-800/50 uppercase tracking-wide">Pendente</span>
                            </div>
                            <p className="text-slate-400 text-sm truncate max-w-xs md:max-w-md">Curitiba, PR → Belo Horizonte, MG • 10 Out 2023</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-border-dark pt-3 md:pt-0">
                        <div className="flex flex-col md:items-end">
                            <p className="text-slate-400 text-xs uppercase font-medium mb-1">Valor da Comissão</p>
                            <p className="text-primary text-xl font-bold group-hover:scale-105 transition-transform origin-right">R$ 2.400,00</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">chevron_right</span>
                    </div>
                </div>

                {/* List Item 3 */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-surface-dark border border-border-dark hover:border-primary/50 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined">local_shipping</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <p className="text-slate-100 font-bold">Carga #8488</p>
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-900/30 text-blue-400 border border-blue-800/50 uppercase tracking-wide">Parcial</span>
                            </div>
                            <p className="text-slate-400 text-sm truncate max-w-xs md:max-w-md">Porto Alegre, RS → Salvador, BA • 08 Out 2023</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-border-dark pt-3 md:pt-0">
                        <div className="flex flex-col md:items-end">
                            <p className="text-slate-400 text-xs uppercase font-medium mb-1">Valor da Comissão</p>
                            <p className="text-primary text-xl font-bold group-hover:scale-105 transition-transform origin-right">R$ 3.800,00</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">chevron_right</span>
                    </div>
                </div>

                <button className="w-full py-4 mt-2 rounded-xl text-center text-sm font-medium text-slate-400 hover:text-primary bg-background-dark/50 hover:bg-surface-dark border border-dashed border-border-dark hover:border-primary/30 transition-colors">
                    Carregar mais comissões
                </button>
            </div>
        </>
    );
}
