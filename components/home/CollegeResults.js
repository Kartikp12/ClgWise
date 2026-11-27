
import { useState } from "react";
import {
  Search,
  Building2,
  TrendingUp,
  ChevronDown,
} from "lucide-react";

const PAGE_SIZE = 12;

const chanceStyles = {
  safe: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  moderate: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  ambitious: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

function StatCard({ label, value, color = "text-white" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#172430] p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>
        {Number(value || 0).toLocaleString("en-IN")}
      </p>
    </div>
  );
}

function CollegeCard({ college, index }) {
  const difference = Number(college.percentileDifference);
  const chance = college.chance || "unknown";

  return (
    <article className="rounded-2xl border border-white/10 bg-[#172430] p-5 transition hover:border-[#4D8DFF]/40 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#4D8DFF]/10 text-[#7DA5FF]">
            <Building2 size={21} />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              College match #{index}
            </p>

            <h3 className="mt-1 font-bold leading-6 text-white">
              {college.collegeName || "College name unavailable"}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Institute Code: {college.collegeCode || "N/A"}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${
            chanceStyles[chance] ||
            "border-white/10 bg-white/5 text-slate-300"
          }`}
        >
          {chance}
        </span>
      </div>

      <div className="mt-5 rounded-xl bg-[#101820] p-4">
        <p className="text-sm font-semibold text-slate-200">
          {college.branch || "Branch unavailable"}
        </p>

        <p className="mt-2 text-xs text-slate-500">
          Course Code: {college.courseCode || "N/A"}
          {college.courseStatus ? ` · ${college.courseStatus}` : ""}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/5 bg-[#101820]/70 p-3">
          <p className="text-xs text-slate-500">
            Historical cutoff
          </p>

          <p className="mt-1 text-lg font-bold text-white tabular-nums">
            {Number(college.historicalCutoffPercentile).toFixed(4)}
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#101820]/70 p-3">
          <p className="text-xs text-slate-500">
            Your percentile
          </p>

          <p className="mt-1 text-lg font-bold text-white tabular-nums">
            {Number(college.studentPercentile).toFixed(4)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#4D8DFF]/10 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <TrendingUp size={15} className="text-[#7DA5FF]" />
          Percentile difference
        </div>

        <span
          className={`text-sm font-bold tabular-nums ${
            difference >= 0
              ? "text-emerald-300"
              : "text-rose-300"
          }`}
        >
          {difference > 0 ? "+" : ""}
          {Number.isFinite(difference)
            ? difference.toFixed(4)
            : "N/A"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <div>
          <p className="text-xs text-slate-500">
            Cutoff category
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-200">
            {college.cutoffCategoryLabel ||
              college.cutoffCategory ||
              "N/A"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Source: {college.cutoffCategory || "N/A"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500">
            Data confidence
          </p>

          <p className="mt-1 font-bold text-[#D6F36A]">
            {Number.isFinite(Number(college.confidence?.score))
              ? `${college.confidence.score}%`
              : "N/A"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-400">
        {college.recommendationExplanation ||
          college.chanceExplanation}
      </p>
    </article>
  );
}

export default function CollegeResults({ result }) {
  const [search, setSearch] = useState("");
  const [chance, setChance] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const predictions = Array.isArray(result?.predictions)
    ? result.predictions
    : [];

  const query = search.trim().toLowerCase();

  const filtered = predictions.filter((item) => {
    const matchesSearch =
      !query ||
      [
        item.collegeName,
        item.collegeCode,
        item.branch,
        item.courseCode,
        item.cutoffCategory,
      ].some((value) =>
        String(value || "").toLowerCase().includes(query)
      );

    return (
      matchesSearch &&
      (chance === "all" || item.chance === chance)
    );
  });

  if (result?.status !== "completed") {
    return null;
  }

  const summary = result.summary || {};
  const visible = filtered.slice(0, visibleCount);

  return (
    <section
      id="matching-results"
      className="mx-auto mt-16 max-w-7xl scroll-mt-24"
    >
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7DA5FF]">
          Your admission overview
        </p>

        <h2 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
          Matching Colleges
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          {predictions.length.toLocaleString("en-IN")} historical
          college-course matches received.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total matches"
          value={summary.total ?? predictions.length}
        />

        <StatCard
          label="Safe"
          value={summary.safe}
          color="text-emerald-300"
        />

        <StatCard
          label="Moderate"
          value={summary.moderate}
          color="text-amber-300"
        />

        <StatCard
          label="Ambitious"
          value={summary.ambitious}
          color="text-rose-300"
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          />

          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Search college, code or branch..."
            className="w-full rounded-xl border border-white/10 bg-[#172430] py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#4D8DFF]"
          />
        </div>

        <div className="relative">
          <select
            value={chance}
            onChange={(event) => {
              setChance(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="w-full appearance-none rounded-xl border border-white/10 bg-[#172430] px-4 py-3.5 pr-10 text-sm text-white outline-none focus:border-[#4D8DFF]"
          >
            <option value="all">All categories</option>
            <option value="safe">Safe</option>
            <option value="moderate">Moderate</option>
            <option value="ambitious">Ambitious</option>
          </select>

          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
          />
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Showing {visible.length} of {filtered.length} matches
        </p>

        <p className="text-xs text-slate-500">
          Sorted by matching engine
        </p>
      </div>

      {visible.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {visible.map((college, index) => (
            <CollegeCard
              key={`${college.collegeCode}-${college.courseCode}-${college.cutoffCategory}-${index}`}
              college={college}
              index={index + 1}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#172430] p-10 text-center">
          <Search
            className="mx-auto text-slate-500"
            size={28}
          />

          <h3 className="mt-4 font-semibold text-white">
            No matching results
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            Try another college name, branch or chance filter.
          </p>
        </div>
      )}

      {visibleCount < filtered.length && (
        <button
          type="button"
          onClick={() =>
            setVisibleCount((count) => count + PAGE_SIZE)
          }
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#172430] px-5 py-4 text-sm font-semibold text-white transition hover:border-[#4D8DFF]/50"
        >
          Load more colleges
          <ChevronDown size={17} />
        </button>
      )}

      <p className="mt-8 rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-xs leading-6 text-slate-400">
        Historical 2026–27 CAP Round I cutoff comparison only.
        These results are not confirmed 2027–28 admission eligibility,
        a complete seat-allocation simulation or a guarantee of admission.
        Data confidence represents data completeness, not admission probability.
      </p>
    </section>
  );
}
