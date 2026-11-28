import { useEffect, useState } from "react";
import {
  Search,
  GitCompareArrows,
  X,
  Plus,
  LoaderCircle,
  Building2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const MAX_SELECTION = 3;

function CollegeChip({ college, onRemove }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#4D8DFF]/20 bg-[#4D8DFF]/10 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Building2 size={17} className="shrink-0 text-[#7DA5FF]" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {college.instituteName}
          </p>
          <p className="text-xs text-slate-500">
            Code: {college.instituteCode}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(college.instituteCode)}
        aria-label={`Remove ${college.instituteName}`}
        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        <X size={17} />
      </button>
    </div>
  );
}

function CollegeOverviewCard({ college }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#172430] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4D8DFF]/10 text-[#7DA5FF]">
          <Building2 size={20} />
        </div>

        <div className="min-w-0">
          <h4 className="font-semibold leading-6 text-white">
            {college.instituteName}
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Institute Code: {college.instituteCode}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#101820] p-3">
          <p className="text-xs text-slate-500">Total branches</p>
          <p className="mt-1 text-xl font-bold text-white">
            {college.totalBranches}
          </p>
        </div>

        <div className="rounded-xl bg-[#101820] p-3">
          <p className="text-xs text-slate-500">Cutoff data</p>
          <p className={`mt-1 text-sm font-bold ${
            college.cutoffAvailable
              ? "text-emerald-300"
              : "text-amber-300"
          }`}>
            {college.cutoffAvailable ? "Available" : "Not available"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Branches offered
        </p>
        <div className="flex flex-wrap gap-2">
          {college.branches.slice(0, 8).map((item) => (
            <span
              key={`${college.instituteCode}-${item.courseCode}`}
              className="rounded-lg border border-white/10 bg-[#101820] px-2.5 py-1.5 text-xs text-slate-300"
            >
              {item.branch}
            </span>
          ))}
          {college.branches.length > 8 && (
            <span className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-slate-400">
              +{college.branches.length - 8} more
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function CutoffComparison({ data }) {
  if (!data?.branches?.length) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">
          GOPENS Cutoff Comparison
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {data.academicYear} · {data.admissionRound} · {data.category}
        </p>
      </div>

      {data.branches.map((branch) => (
        <div
          key={branch.branch}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#172430]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
            <h4 className="font-semibold text-white">
              {branch.branch}
            </h4>

            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              branch.status === "comparable"
                ? "bg-emerald-400/10 text-emerald-300"
                : branch.status === "partially_available"
                  ? "bg-amber-400/10 text-amber-300"
                  : "bg-white/5 text-slate-400"
            }`}>
              {branch.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {branch.colleges.map((college) => (
              <div
                key={college.instituteCode}
                className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {college.instituteName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {college.instituteCode}
                  </p>
                </div>

                {college.available && college.cutoffRecords.length > 0 ? (
                  <>
                    <p className="text-sm font-bold text-white tabular-nums">
                      {college.cutoffRecords
                        .map((record) =>
                          record.percentile === null
                            ? "Percentile N/A"
                            : `${record.percentile.toFixed(4)}%`
                        )
                        .join(", ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {college.cutoffRecords
                        .map((record) =>
                          record.meritNumber === null
                            ? "Merit N/A"
                            : `Merit ${record.meritNumber}`
                        )
                        .join(", ")}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-300 sm:col-span-2">
                    Cutoff data unavailable
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CollegeComparison() {
  const [colleges, setColleges] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadColleges() {
      try {
        const response = await fetch("/api/colleges");
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to load colleges.");
        }

        if (active) setColleges(data.colleges || []);
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Unable to load colleges.");
        }
      } finally {
        if (active) setLoadingColleges(false);
      }
    }

    loadColleges();

    return () => {
      active = false;
    };
  }, []);

  const query = search.trim().toLowerCase();

  const filteredColleges = query
    ? colleges
        .filter((college) => {
          const matches =
            college.instituteName.toLowerCase().includes(query) ||
            college.instituteCode.toLowerCase().includes(query);
  
          const notSelected = !selected.some(
            (item) => item.instituteCode === college.instituteCode
          );
  
          return matches && notSelected;
        })
        .slice(0, 8)
    : [];

  const addCollege = (college) => {
    if (selected.length >= MAX_SELECTION) return;

    setSelected((current) => [...current, college]);
    setSearch("");
    setComparison(null);
    setError("");
  };

  const removeCollege = (code) => {
    setSelected((current) =>
      current.filter((college) => college.instituteCode !== code)
    );
    setComparison(null);
    setError("");
  };

  const handleCompare = async () => {
    if (selected.length < 2 || selected.length > MAX_SELECTION) {
      setError("Please select 2 or 3 colleges to compare.");
      return;
    }

    setComparing(true);
    setError("");
    setComparison(null);

    try {
      const response = await fetch("/api/ai/college-comparison", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instituteCodes: selected.map((college) => college.instituteCode),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || data.message || "College comparison failed."
        );
      }

      setComparison(data);
    } catch (requestError) {
      setError(
        requestError.message || "Unable to compare colleges. Please try again."
      );
    } finally {
      setComparing(false);
    }
  };

  return (
    <section
      id="college-comparison"
      className="relative overflow-hidden bg-[#101820] px-5 py-24 sm:px-8 lg:px-12"
    >
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-[#4D8DFF]/10 blur-[130px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#4D8DFF]/20 bg-[#4D8DFF]/10 px-4 py-2">
            <GitCompareArrows size={15} className="text-[#7DA5FF]" />
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#7DA5FF]">
              College Intelligence
            </span>
          </div>

          <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Compare colleges.
            <span className="block text-[#D6F36A]">
              Choose with clarity.
            </span>
          </h2>

          <p className="mt-5 text-sm leading-7 text-slate-400 sm:text-base">
            Compare branch availability and historical admission cutoffs
            across Maharashtra engineering colleges.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#172430]/90 p-5 sm:p-8 lg:p-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                Select colleges to compare
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Choose 2–3 colleges from the official dataset.
              </p>
            </div>

            <span className="rounded-full border border-white/10 bg-[#101820] px-3 py-1.5 text-xs font-semibold text-slate-300">
              {selected.length} / {MAX_SELECTION} selected
            </span>
          </div>

          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={selected.length >= MAX_SELECTION || loadingColleges}
              placeholder="Search by college name or institute code..."
              className="w-full rounded-xl border border-white/10 bg-[#101820] py-4 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#4D8DFF] disabled:opacity-50"
            />

            {search.trim() && filteredColleges.length > 0 && (
              <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#172430] p-2 shadow-2xl">
                {filteredColleges.map((college) => (
                  <button
                    type="button"
                    key={college.instituteCode}
                    onClick={() => addCollege(college)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {college.instituteName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Code: {college.instituteCode} · {college.totalBranches} branches
                      </p>
                    </div>
                    <Plus size={17} className="shrink-0 text-[#7DA5FF]" />
                  </button>
                ))}
              </div>
            )}

            {search.trim() && !loadingColleges && filteredColleges.length === 0 && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-[#172430] p-4 text-sm text-slate-400">
                No colleges found. Try another name or institute code.
              </div>
            )}
          </div>

          {loadingColleges && (
            <p className="mt-3 text-xs text-slate-500">
              Loading official college list...
            </p>
          )}

          <div className="mt-6 space-y-3">
            {selected.map((college) => (
              <CollegeChip
                key={college.instituteCode}
                college={college}
                onRemove={removeCollege}
              />
            ))}
          </div>

          {selected.length === 0 && !loadingColleges && (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
              <GitCompareArrows
                size={28}
                className="mx-auto text-slate-500"
              />
              <p className="mt-3 text-sm font-medium text-slate-300">
                Your comparison list is empty
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Search and add colleges to get started.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300"
            >
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleCompare}
            disabled={selected.length < 2 || comparing}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#4D8DFF] px-6 py-4 text-sm font-bold text-white transition hover:bg-[#3678E8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {comparing ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                Comparing colleges...
              </>
            ) : (
              <>
                <GitCompareArrows size={18} />
                Compare Selected Colleges
              </>
            )}
          </button>
        </div>

        {comparison && (
          <div className="mt-14 space-y-12">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={19} className="text-emerald-300" />
              <p className="text-sm font-semibold text-emerald-300">
                Comparison completed
              </p>
            </div>

            <div>
              <h3 className="mb-5 text-2xl font-semibold text-white">
                College Overview
              </h3>
              <div className="grid gap-5 lg:grid-cols-2">
                {comparison.collegeOverview.map((college) => (
                  <CollegeOverviewCard
                    key={college.instituteCode}
                    college={college}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#172430] p-5 sm:p-7">
              <h3 className="text-xl font-semibold text-white">
                Branch Availability
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Common branches and branches unique to each selected college.
              </p>

              <div className="mt-6">
                <p className="text-sm font-semibold text-[#D6F36A]">
                  Common branches ({comparison.branchComparison.commonBranchCount})
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {comparison.branchComparison.commonBranches.length > 0 ? (
                    comparison.branchComparison.commonBranches.map((branch) => (
                      <span
                        key={branch}
                        className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300"
                      >
                        {branch}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No common branches found.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-7 grid gap-4 lg:grid-cols-2">
                {comparison.branchComparison.collegeSpecificBranches.map((college) => (
                  <div
                    key={college.instituteCode}
                    className="rounded-xl bg-[#101820] p-4"
                  >
                    <p className="text-sm font-semibold text-white">
                      {college.instituteName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      College-specific branches
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {college.branches.length > 0 ? (
                        college.branches.map((branch) => (
                          <span
                            key={branch}
                            className="rounded-lg bg-[#4D8DFF]/10 px-3 py-2 text-xs text-[#9DBBFF]"
                          >
                            {branch}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">
                          No exclusive branches identified.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <CutoffComparison data={comparison.openCutoffComparison} />

            <div className="rounded-2xl border border-[#4D8DFF]/20 bg-[#172430] p-5 sm:p-7">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#7DA5FF]">
                  AI-powered insights
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  ClgWise Analysis
                </h3>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {comparison.aiAnalysis || comparison.comparison}
              </div>
            </div>

            <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-5">
              <p className="text-sm font-semibold text-amber-300">
                Data limitations and disclaimer
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-6 text-slate-400">
                {comparison.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-6 text-slate-400">
                {comparison.disclaimer}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
