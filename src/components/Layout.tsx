import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
    return (
        <div className="flex h-screen overflow-hidden w-full bg-background text-text-primary transition-colors duration-300">
            <Sidebar />
            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-32 custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto w-full">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
