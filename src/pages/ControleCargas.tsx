export default function ControleCargas() {
    return (
        <>
            <div className="flex flex-wrap flex-col gap-3 mb-6">
                <p className="text-slate-100 text-[28px] md:text-[32px] font-bold leading-tight tracking-[-0.033em]">Controle de Viagens</p>
            </div>
            <div className="flex gap-3 mb-6 flex-wrap">
                <button className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-surface-dark border border-border-dark hover:border-primary/50 text-slate-300 transition-colors px-4">
                    <span className="material-symbols-outlined text-lg text-primary/70">calendar_month</span>
                    <p className="text-sm font-medium leading-normal">Datas</p>
                    <span className="material-symbols-outlined text-lg text-primary/70">expand_more</span>
                </button>
                <button className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-surface-dark border border-border-dark hover:border-primary/50 text-slate-300 transition-colors px-4">
                    <span className="material-symbols-outlined text-lg text-primary/70">person</span>
                    <p className="text-sm font-medium leading-normal">Motoristas</p>
                    <span className="material-symbols-outlined text-lg text-primary/70">expand_more</span>
                </button>
                <button className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-surface-dark border border-border-dark hover:border-primary/50 text-slate-300 transition-colors px-4">
                    <span className="material-symbols-outlined text-lg text-primary/70">flag</span>
                    <p className="text-sm font-medium leading-normal">Status</p>
                    <span className="material-symbols-outlined text-lg text-primary/70">expand_more</span>
                </button>
                <button className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-surface-dark border border-border-dark hover:border-primary/50 text-slate-300 transition-colors px-4">
                    <span className="material-symbols-outlined text-lg text-primary/70">category</span>
                    <p className="text-sm font-medium leading-normal">Tipo</p>
                    <span className="material-symbols-outlined text-lg text-primary/70">expand_more</span>
                </button>
                <div className="flex-1"></div>
                <button className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-surface-dark border border-border-dark hover:border-primary/50 text-slate-300 transition-colors px-4">
                    <span className="material-symbols-outlined text-lg text-primary/70">download</span>
                    <p className="text-sm font-medium leading-normal">Exportar</p>
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface-dark border border-border-dark shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-primary">local_shipping</span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium leading-normal uppercase tracking-wider">Viagens Totais</p>
                    <p className="text-slate-100 tracking-tight text-3xl font-bold leading-tight">145</p>
                    <p className="text-xs text-green-400 font-medium flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">trending_up</span> +12% neste mês
                    </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface-dark border border-border-dark shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-primary">scale</span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium leading-normal uppercase tracking-wider">Peso Entregue</p>
                    <p className="text-slate-100 tracking-tight text-3xl font-bold leading-tight">1.250t</p>
                    <p className="text-xs text-green-400 font-medium flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">trending_up</span> +5% neste mês
                    </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface-dark border border-border-dark shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-primary">account_balance_wallet</span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium leading-normal uppercase tracking-wider">A Receber</p>
                    <p className="text-slate-100 tracking-tight text-3xl font-bold leading-tight">R$ 45.000</p>
                    <p className="text-xs text-red-400 font-medium flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">trending_down</span> -2% neste mês
                    </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl p-6 bg-surface-dark border border-border-dark shadow-sm relative overflow-hidden group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-6xl text-primary">payments</span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium leading-normal uppercase tracking-wider">Adiantamentos</p>
                    <p className="text-slate-100 tracking-tight text-3xl font-bold leading-tight">R$ 12.000</p>
                    <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">horizontal_rule</span> Estável
                    </p>
                </div>
            </div>

            <div className="w-full overflow-x-auto pb-4">
                <div className="rounded-xl border border-border-dark bg-surface-dark shadow-sm min-w-[900px] overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-background-dark/50 border-b border-border-dark">
                                <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Origem</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Destino</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Peso</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Valor do Frete</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Adiantamento %</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {/* Row 1 */}
                            <tr className="hover:bg-border-dark/20 transition-colors group cursor-pointer">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background-dark/50 p-2 rounded-lg text-primary/70">
                                            <span className="material-symbols-outlined text-sm">my_location</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">São Paulo, SP</p>
                                            <p className="text-xs text-slate-400">Coleta: 12/Out</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background-dark/50 p-2 rounded-lg text-primary/70">
                                            <span className="material-symbols-outlined text-sm">location_on</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">Rio de Janeiro, RJ</p>
                                            <p className="text-xs text-slate-400">Prev: 14/Out</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300">25t</td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-semibold text-primary">R$ 3.500</p>
                                    <p className="text-xs text-slate-400">Pago: R$ 1.400</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-2 bg-background-dark/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: '40%' }}></div>
                                        </div>
                                        <span className="text-xs text-slate-400">40%</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300 border border-blue-800/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span> Em Trânsito
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-primary transition-colors p-1">
                                        <span className="material-symbols-outlined text-xl">more_vert</span>
                                    </button>
                                </td>
                            </tr>

                            {/* Row 2 */}
                            <tr className="hover:bg-border-dark/20 transition-colors group cursor-pointer">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background-dark/50 p-2 rounded-lg text-primary/70">
                                            <span className="material-symbols-outlined text-sm">my_location</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">Curitiba, PR</p>
                                            <p className="text-xs text-slate-400">Coleta: 10/Out</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background-dark/50 p-2 rounded-lg text-primary/70">
                                            <span className="material-symbols-outlined text-sm">location_on</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">Porto Alegre, RS</p>
                                            <p className="text-xs text-slate-400">Prev: 12/Out</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300">18t</td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-semibold text-primary">R$ 2.100</p>
                                    <p className="text-xs text-slate-400">Pago: R$ 1.050</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-2 bg-background-dark/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: '50%' }}></div>
                                        </div>
                                        <span className="text-xs text-slate-400">50%</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-300 border border-green-800/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span> Entregue
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-primary transition-colors p-1">
                                        <span className="material-symbols-outlined text-xl">more_vert</span>
                                    </button>
                                </td>
                            </tr>

                            {/* Expanded details row example */}
                            <tr className="bg-border-dark/10 border-l-2 border-l-primary">
                                <td className="px-0 py-0" colSpan={7}>
                                    <div className="p-6 border-b border-border-dark flex gap-6">
                                        <div className="flex-1 bg-background-dark/50 rounded-lg p-4 border border-border-dark">
                                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-200"><span className="material-symbols-outlined text-lg text-primary">description</span> Documentos Relacionados</h4>
                                            <div className="flex gap-4">
                                                <div className="w-24 h-32 bg-background-dark rounded border border-border-dark flex flex-col items-center justify-center p-2 cursor-pointer hover:border-primary/50 transition-colors relative group/doc">
                                                    <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">request_quote</span>
                                                    <span className="text-[10px] text-center text-slate-400">CTe-3492.pdf</span>
                                                    <div className="absolute inset-0 bg-primary/10 hidden group-hover/doc:flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-primary">visibility</span>
                                                    </div>
                                                </div>
                                                <div className="w-24 h-32 bg-background-dark rounded border border-border-dark flex flex-col items-center justify-center p-2 cursor-pointer hover:border-primary/50 transition-colors relative group/doc">
                                                    <span className="material-symbols-outlined text-3xl text-slate-400 mb-2">inventory_2</span>
                                                    <span className="text-[10px] text-center text-slate-400">MDFe-112.pdf</span>
                                                    <div className="absolute inset-0 bg-primary/10 hidden group-hover/doc:flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-primary">visibility</span>
                                                    </div>
                                                </div>
                                                <div className="w-24 h-32 border-2 border-dashed border-border-dark rounded flex flex-col items-center justify-center p-2 cursor-pointer hover:border-primary/50 hover:bg-border-dark/20 transition-colors text-slate-400 hover:text-primary">
                                                    <span className="material-symbols-outlined text-2xl mb-1 mt-auto">add</span>
                                                    <span className="text-[10px] text-center mt-auto pb-2">Novo Doc</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-1/3 bg-background-dark/50 rounded-lg p-4 border border-border-dark">
                                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-200"><span className="material-symbols-outlined text-lg text-primary">local_shipping</span> Veículo e Motorista</h4>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-400">Motorista:</span>
                                                    <span className="font-medium text-slate-200">Carlos Silva</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-400">Placa Cavalo:</span>
                                                    <span className="font-medium bg-background-dark px-2 py-0.5 rounded border border-border-dark text-slate-200">ABC-1234</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-400">Placa Carreta:</span>
                                                    <span className="font-medium bg-background-dark px-2 py-0.5 rounded border border-border-dark text-slate-200">XYZ-9876</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>

                            {/* Row 3 */}
                            <tr className="hover:bg-border-dark/20 transition-colors group cursor-pointer">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background-dark/50 p-2 rounded-lg text-primary/70">
                                            <span className="material-symbols-outlined text-sm">my_location</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">Belo Horizonte, MG</p>
                                            <p className="text-xs text-slate-400">Coleta: 15/Out</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background-dark/50 p-2 rounded-lg text-primary/70">
                                            <span className="material-symbols-outlined text-sm">location_on</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">Vitória, ES</p>
                                            <p className="text-xs text-slate-400">Prev: 17/Out</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-300">30t</td>
                                <td className="px-6 py-4">
                                    <p className="text-sm font-semibold text-primary">R$ 4.200</p>
                                    <p className="text-xs text-slate-400">Pago: R$ 1.260</p>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-2 bg-background-dark/50 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: '30%' }}></div>
                                        </div>
                                        <span className="text-xs text-slate-400">30%</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-900/30 text-amber-300 border border-amber-800/30">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span> Pendente
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-primary transition-colors p-1">
                                        <span className="material-symbols-outlined text-xl">more_vert</span>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary hover:bg-primary/90 text-background-dark rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-2 border-primary/50 shadow-primary/20 z-10">
                <span className="material-symbols-outlined text-3xl">add</span>
            </button>
        </>
    );
}
