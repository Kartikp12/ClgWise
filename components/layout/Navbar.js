
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BrainCircuit,
  Menu,
  X,
} from "lucide-react";

const navigation = [
  { label: "Home", href: "#home" },
  { label: "Find Colleges", href: "#find-colleges" },
  { label: "Explore Colleges", href: "#explore-colleges" },
  { label: "Compare", href: "#college-comparison" },
  { label: "AI Guidance", href: "#ai-guidance" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-10"
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/10 bg-[#111c27]/90 px-5 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl sm:px-7">
        <Link
          href="/"
          onClick={closeMenu}
          className="group flex items-center gap-3"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d6f36a] text-[#101820] transition-transform duration-300 group-hover:rotate-6">
            <BrainCircuit size={23} strokeWidth={2.2} />
          </span>

          <span className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white">
              Clg<span className="text-[#d6f36a]">Wise</span>
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Academic Intelligence
            </span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-[13px] font-medium text-slate-300 transition-colors duration-200 hover:text-[#d6f36a]"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden lg:block">
          <a
            href="#find-colleges"
            className="group flex items-center gap-2 rounded-xl bg-[#4D8DFF] hover:bg-[#3678E8] px-5 py-3 text-sm font-bold text-[#101820] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#e4ff86]"
          >
            Find My College
            <ArrowUpRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>

        <button
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white transition-colors hover:bg-white/10 lg:hidden"
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-2 max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-[#111c27] p-4 shadow-2xl lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {navigation.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={closeMenu}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-[#d6f36a]"
                >
                  {item.label}
                </a>
              ))}

              <a
                href="#find-colleges"
                onClick={closeMenu}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#4D8DFF] hover:bg-[#3678E8] px-4 py-3 text-sm font-bold text-[#101820]"
              >
                Find My College
                <ArrowUpRight size={16} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
