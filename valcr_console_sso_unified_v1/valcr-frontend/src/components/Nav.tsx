import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Zap, Shield, Code2 } from 'lucide-react'
import { useAuthStore, hasAccess } from '@/store'
import { NotificationBell } from '@/components/NotificationBell'
import { beginConsoleHandoff } from '@/api/consoleHandoff'
import clsx from 'clsx'

export function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [consoleLoading, setConsoleLoading] = useState(false)
  const location = useLocation()
  const { isAuthenticated, user, token, logout } = useAuthStore()

  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h) }, [])
  useEffect(() => { setOpen(false) }, [location])

  const isAdmin = user?.isAdmin === true
  const showGetPro = !isAuthenticated || (!isAdmin && !hasAccess(user, 'pro'))
  const links = [
    { href: '/calculators', label: 'Calculators' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/benchmarks', label: 'Benchmarks' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  const openConsole = async () => {
    if (!isAuthenticated || !token) {
      window.location.assign('/login?next=console')
      return
    }
    setConsoleLoading(true)
    try { await beginConsoleHandoff(token) }
    catch (error) {
      setConsoleLoading(false)
      console.error(error)
      window.location.assign('https://console.valcr.site')
    }
  }

  return <header className={clsx('fixed top-0 left-0 right-0 z-50 transition-all duration-300', scrolled ? 'bg-ink-950/90 backdrop-blur-xl border-b border-ink-800/80' : 'bg-transparent')}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 group"><div className="w-8 h-8 bg-acid rounded-lg flex items-center justify-center"><span className="font-display font-800 text-ink-950 text-sm">V</span></div><span className="font-display font-700 text-ink-50 text-lg">valcr</span>{isAdmin && <span className="hidden sm:flex items-center gap-1 text-xs font-mono text-acid bg-acid/10 border border-acid/20 rounded-full px-2 py-0.5 ml-1"><Shield className="w-3 h-3" />admin</span>}</Link>
      <nav className="hidden md:flex items-center gap-1">{links.map(link => <Link key={link.href} to={link.href} className={clsx('px-4 py-2 rounded-lg font-body font-500 text-sm transition-all duration-150', link.href === '/admin' ? (location.pathname === '/admin' ? 'text-acid bg-acid/10' : 'text-acid/70 hover:text-acid hover:bg-acid/10') : (location.pathname.startsWith(link.href) ? 'text-acid bg-acid/10' : 'text-ink-200 hover:text-ink-50 hover:bg-ink-800'))}>{link.label}</Link>)}</nav>
      <div className="hidden md:flex items-center gap-2">{isAuthenticated ? <>
        <NotificationBell />
        <button onClick={openConsole} disabled={consoleLoading} className="btn-secondary text-sm py-1.5 px-3"><Code2 className="w-3.5 h-3.5" />{consoleLoading ? 'Opening…' : 'Developer Console'}</button>
        <Link to="/dashboard" className="btn-secondary text-sm py-1.5 px-3">Dashboard</Link>
        <button onClick={logout} className="text-ink-400 hover:text-ink-200 text-sm px-3 py-1.5 rounded-lg hover:bg-ink-800">Sign out</button>
      </> : <><Link to="/login" className="text-ink-300 hover:text-ink-50 text-sm px-3 py-1.5">Log in</Link>{showGetPro && <Link to="/signup" className="btn-primary text-sm py-1.5 px-4"><Zap className="w-3.5 h-3.5" />Get started</Link>}</>}</div>
      <button className="md:hidden p-2 rounded-lg text-ink-300 hover:bg-ink-800" onClick={() => setOpen(v => !v)} aria-label="Menu">{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
    </div>
    {open && <div className="md:hidden bg-ink-950/98 backdrop-blur-xl border-t border-ink-800 px-4 py-4 space-y-1">{links.map(link => <Link key={link.href} to={link.href} className={clsx('block px-3 py-2.5 rounded-lg text-sm font-500', location.pathname.startsWith(link.href) ? 'bg-acid/10 text-acid' : 'text-ink-200 hover:bg-ink-800')}>{link.label}</Link>)}<div className="pt-3 border-t border-ink-800 space-y-2">{isAuthenticated ? <><button onClick={openConsole} disabled={consoleLoading} className="w-full btn-secondary text-sm py-2.5 justify-center"><Code2 className="w-4 h-4" />{consoleLoading ? 'Opening…' : 'Developer Console'}</button><Link to="/dashboard" className="block btn-secondary text-sm text-center py-2.5">Dashboard</Link><button onClick={logout} className="w-full text-ink-400 text-sm py-2">Sign out</button></> : <><Link to="/login?next=console" className="block btn-secondary text-sm text-center py-2.5">Developer Console</Link><Link to="/login" className="block text-center text-ink-300 py-2.5 text-sm">Log in</Link><Link to="/signup" className="block btn-primary text-sm text-center py-2.5">Get started free</Link></>}</div></div>}
  </header>
}
