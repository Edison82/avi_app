'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { Truck, Package, Boxes } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home, FileText, FolderOpen, Settings,
  LogOut, Menu, X, Camera, Building2,
} from 'lucide-react';

// ── Logo Upload ────────────────────────────────────────────────
function LogoUpload({ granjaId }: { granjaId: string }) {
  const storageKey = `logo_granja_${granjaId}`;
  const [logo, setLogo] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(storageKey);
  });
  const [hovering, setHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setLogo(url);
      localStorage.setItem(storageKey, url);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogo(null);
    localStorage.removeItem(storageKey);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      className="relative group cursor-pointer"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setHovering(true); }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        e.preventDefault(); setHovering(false);
        const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

      <div className={`w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center
        transition-all duration-200 overflow-hidden
        ${hovering ? 'border-amber-400 bg-amber-50 scale-105'
          : logo ? 'border-transparent bg-white shadow-md'
          : 'border-amber-200 bg-amber-50/60 hover:border-amber-400 hover:bg-amber-50'}`}>
        {logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logo} alt="Logo empresa" className="w-full h-full object-contain p-1" />
          : <div className="flex flex-col items-center gap-1 text-amber-400">
              <Building2 size={20} />
              <span className="text-[9px] font-medium text-center leading-tight px-1">Logo</span>
            </div>
        }
      </div>

      <div className={`absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center
        transition-opacity duration-200 ${logo ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`}>
        <Camera size={16} className="text-white" />
      </div>

      {logo && (
        <button onClick={handleRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs
                     flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 shadow-sm">
          ×
        </button>
      )}

      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs
                      rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100
                      pointer-events-none transition-opacity z-50 hidden lg:block">
        {logo ? 'Cambiar logo' : 'Subir logo de empresa'}
      </div>
    </div>
  );
}

// ── Layout ─────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/login');
  }, [status, router]);

  const nombreGranja = session?.user?.nombreGranja ?? 'Mi Granja';
  const granjaId     = session?.user?.granjaId     ?? 'default';
  const isAdmin      = session?.user?.rol === 'ADMIN';

  const menuItems = useMemo(() => {
    const rol = session?.user?.rol;

    if (rol === 'OPERARIO') {
      return [
        { href: '/dashboard/registros',  label: 'Registros',  icon: FileText },
        { href: '/dashboard/inventario', label: 'Inventario', icon: Boxes    },
      ];
    }

    if (rol === 'CONDUCTOR') {
      return [
        { href: '/dashboard/entregas', label: 'Mis Entregas', icon: Truck   },
        { href: '/dashboard/carga',    label: 'Carga',        icon: Package },
      ];
    }

    // ADMIN
    return [
      { href: '/dashboard',               label: 'Dashboard',    icon: Home      },
      { href: '/dashboard/registros',     label: 'Registros',    icon: FileText  },
      { href: '/dashboard/inventario',    label: 'Inventario',   icon: Boxes     },
      { href: '/dashboard/categorias',    label: 'Categorías',   icon: FolderOpen},
      { href: '/dashboard/configuracion', label: 'Configuración',icon: Settings  },
    ];
  }, [session?.user?.rol]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto" />
          <p className="mt-4 text-gray-600 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Mobile bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-20 px-4 py-3
                      flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold text-amber-600">🐔 AviControl</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-gray-100">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r shadow-lg z-30
        transform transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Logo + granja */}
        <div className="p-5 border-b bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="flex items-center gap-3">
            {isAdmin 
              ? <LogoUpload granjaId={granjaId} />
              : <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-2xl">🐔</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500 mb-0.5">
                Granja
              </p>
              <h2 className="text-sm font-bold text-gray-900 leading-tight truncate" title={nombreGranja}>
                {nombreGranja}
              </h2>
            </div>
          </div>
        </div>

        {/* Info usuario */}
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-amber-700">
                {(session.user.nombre ?? session.user.email ?? '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{session.user.nombre}</p>
              <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            </div>
          </div>
          <span className="inline-block mt-2 px-2 py-0.5 text-xs font-semibold
                           bg-amber-100 text-amber-700 rounded-full border border-amber-200">
            {session.user.rol === 'ADMIN'     && '👑 Administrador'}
            {session.user.rol === 'OPERARIO'  && '🔧 Operario'}
            {session.user.rol === 'CONDUCTOR' && '🚛 Conductor'}
          </span>
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon     = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-150
                  ${isActive
                    ? 'bg-amber-400 text-white font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                  }`}>
                <Icon size={18} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <button
            onClick={async () => { await signOut({ redirect: false }); router.push('/auth/login'); }}
            className="w-full flex items-center space-x-3 px-4 py-2.5 text-red-500
                       hover:bg-red-50 rounded-xl transition-colors duration-150 group"
          >
            <LogOut size={18} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium cursor-pointer">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}