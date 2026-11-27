
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  GraduationCap,
  Network,
  Sparkles,
} from "lucide-react";

const networkNodes = [
  { x: "16%", y: "22%", delay: 0 },
  { x: "78%", y: "13%", delay: 0.5 },
  { x: "88%", y: "68%", delay: 0.9 },
  { x: "19%", y: "79%", delay: 1.2 },
  { x: "52%", y: "8%", delay: 0.7 },
  { x: "53%", y: "91%", delay: 1.5 },
];

function IntelligenceVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[470px]">
      <div className="absolute inset-[10%] rounded-full border border-white/[0.08]" />
      <div className="absolute inset-[20%] rounded-full border border-dashed border-white/[0.12]" />
      <div className="absolute inset-[30%] rounded-full border border-white/[0.08]" />

      <svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden="true"
      >
        <motion.path
          d="M64 88 L200 155 L312 52 M200 155 L350 270 M200 155 L75 310 M75 310 L210 360 M210 360 L350 270 M312 52 L350 270"
          stroke="#6D8AA3"
          strokeWidth="1"
          strokeOpacity="0.45"
          strokeDasharray="5 7"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        <motion.circle
          cx="200"
          cy="155"
          r="93"
          stroke="#D6F36A"
          strokeOpacity="0.2"
          strokeWidth="1"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2 }}
        />
      </svg>

      {networkNodes.map((node, index) => (
        <motion.div
          key={index}
          className="absolute h-2.5 w-2.5 rounded-full bg-[#7DA5FF] shadow-[0_0_18px_rgba(125,165,255,0.7)]"
          style={{ left: node.x, top: node.y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0.45, 1, 0.45],
            scale: [0.8, 1.25, 0.8],
          }}
          transition={{
            duration: 3,
            delay: node.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <motion.div
        className="absolute left-1/2 top-1/2 z-10 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[2rem] border border-[#D6F36A]/30 bg-[#1b2a36] shadow-[0_0_70px_rgba(214,243,106,0.12)]"
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <BrainCircuit
          size={43}
          className="text-[#D6F36A]"
          strokeWidth={1.5}
        />
        <span className="mt-3 text-xs font-bold tracking-widest text-white">
          CLGWISE AI
        </span>
        <span className="mt-1 text-[9px] text-slate-400">
          Intelligence engine
        </span>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-0 top-[27%] z-20 rounded-xl border border-white/10 bg-[#1b2a36]/95 p-3 shadow-xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2">
          <GraduationCap size={17} className="text-[#D6F36A]" />
          <span className="text-[10px] font-semibold text-white">
            College Discovery
          </span>
        </div>
        <p className="mt-1 text-[9px] text-slate-400">
          387 institutes indexed
        </p>
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[18%] right-0 z-20 rounded-xl border border-white/10 bg-[#1b2a36]/95 p-3 shadow-xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-2">
          <Network size={16} className="text-[#7DA5FF]" />
          <span className="text-[10px] font-semibold text-white">
            Data Intelligence
          </span>
        </div>
        <p className="mt-1 text-[9px] text-slate-400">
          Historical CAP insights
        </p>
      </motion.div>

      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        className="absolute inset-[5%] rounded-full border border-dashed border-[#D6F36A]/15"
      />
    </div>
  );
}

export default function Hero({ stats }) {
  const statistics = [
    {
      value: stats.totalInstitutes,
      label: "Official Institutes",
    },
    {
      value: stats.totalCourses,
      label: "Courses Indexed",
    },
    {
      value: stats.totalCutoffRecords,
      label: "CAP Cutoff Records",
    },
    {
      value: stats.institutesWithCutoffData,
      label: "Institutes with Cutoff Data",
  },
  ];

  return (
    <section
      id="home"
      className="relative isolate flex min-h-[850px] items-center overflow-hidden bg-[#101820] px-5 pb-20 pt-36 sm:px-8 lg:px-12"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:58px_58px]" />

      <div className="pointer-events-none absolute -left-40 top-20 -z-10 h-[420px] w-[420px] rounded-full bg-[#234d69]/20 blur-[120px]" />

      <div className="pointer-events-none absolute -right-40 bottom-0 -z-10 h-[420px] w-[420px] rounded-full bg-[#d6f36a]/[0.07] blur-[130px]" />

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#D6F36A]/20 bg-[#D6F36A]/[0.07] px-4 py-2">
            <Sparkles size={14} className="text-[#D6F36A]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#D6F36A] sm:text-xs">
              Maharashtra Engineering Admissions
            </span>
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-6xl lg:text-[72px]">
            Your next chapter starts with the{" "}
            <span className="relative inline-block text-[#D6F36A]">
              right choice.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
            Explore engineering colleges, understand admission trends, and
            discover the possibilities ahead with data-driven insights and
            AI-powered guidance.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#find-colleges"
              className="group inline-flex items-center justify-center gap-3 rounded-xl bg-[#4D8DFF] px-6 py-4 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-[#3678E8]"
            >
              Discover My Colleges
              <ArrowUpRight
                size={18}
                className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
              />
            </a>

            <a
              href="#explore-colleges"
              className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white transition-all duration-300 hover:border-[#D6F36A]/50 hover:bg-white/[0.08]"
            >
              Explore Colleges
              <ArrowRight size={17} />
            </a>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-white/10 pt-7 sm:grid-cols-4 sm:gap-x-4">
            {statistics.map((statistic) => (
              <div key={statistic.label}>
                <p className="text-2xl font-bold text-white">
                  {statistic.value.toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {statistic.label}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-[10px] leading-5 text-slate-500">
            Based on Maharashtra CET Cell 2026–27 CAP Round 1 data.
            Historical data is indicative, not an admission guarantee.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative mx-auto w-full max-w-[520px]"
        >
          <IntelligenceVisual />
        </motion.div>
      </div>
    </section>
  );
}
