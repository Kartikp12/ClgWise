
import { useState } from "react";
import {
  ArrowRight,
  GraduationCap,
  UserRound,
  BookOpen,
  MapPin,
  Sparkles,
} from "lucide-react";

const initialProfile = {
  isResultDeclared: true,
  percentile: "",
  expectedPercentile: "",
  category: "",
  candidatureType: "",
  gender: "",
  homeUniversity: "",
  preferredBranches: "",
};

export default function FindColleges() {
  const [profile, setProfile] = useState(initialProfile);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const updateProfile = (field, value) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setSuccess(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const percentile = Number(
      profile.isResultDeclared
        ? profile.percentile
        : profile.expectedPercentile
    );

    if (
      !Number.isFinite(percentile) ||
      percentile < 0 ||
      percentile > 100 ||
      (profile.isResultDeclared
        ? profile.percentile === ""
        : profile.expectedPercentile === "")
    ) {
      setError("Please enter a valid percentile between 0 and 100.");
      return;
    }

    if (!profile.category.trim()) {
      setError("Please enter your category as mentioned in your CET application.");
      return;
    }

    if (!profile.candidatureType.trim()) {
      setError("Please enter your candidature type.");
      return;
    }

    const branches = profile.preferredBranches
      .split(",")
      .map((branch) => branch.trim())
      .filter(Boolean);

    if (branches.length === 0) {
      setError("Please enter at least one preferred engineering branch.");
      return;
    }

    setSuccess(true);
  };

  const inputClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-[#111c27] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-[#4D8DFF]";

  const labelClass = "text-sm font-semibold text-slate-200";

  return (
    <section
      id="find-colleges"
      className="relative overflow-hidden bg-[#111c27] px-5 py-24 sm:px-8 lg:px-12"
    >
      <div className="pointer-events-none absolute -right-40 top-10 h-96 w-96 rounded-full bg-[#4D8DFF]/10 blur-[130px]" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#4D8DFF]/20 bg-[#4D8DFF]/10 px-4 py-2">
            <Sparkles size={14} className="text-[#7DA5FF]" />
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#7DA5FF]">
              Personalized College Discovery
            </span>
          </div>

          <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Find colleges that match{" "}
            <span className="text-[#D6F36A]">your profile.</span>
          </h2>

          <p className="mt-5 text-sm leading-7 text-slate-400 sm:text-base">
            Share your MHT-CET details and preferences to explore
            engineering college options based on historical admission data.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#172430]/90 p-5 shadow-2xl shadow-black/20 sm:p-8 lg:p-10"
        >
          <div className="mb-8 flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4D8DFF]/15 text-[#7DA5FF]">
              <GraduationCap size={23} />
            </div>

            <div>
              <h3 className="font-semibold text-white">
                MHT-CET Student Profile
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Enter your admission details
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <UserRound size={17} className="text-[#D6F36A]" />
                <h4 className="text-sm font-bold text-white">
                  Academic Details
                </h4>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#101820] p-4">
                <input
                  type="checkbox"
                  checked={profile.isResultDeclared}
                  onChange={(event) =>
                    updateProfile("isResultDeclared", event.target.checked)
                  }
                  className="h-4 w-4 accent-[#4D8DFF]"
                />
                <span className="text-sm text-slate-300">
                  My MHT-CET result has been declared
                </span>
              </label>

              <div className="mt-5">
                <label className={labelClass}>
                  {profile.isResultDeclared
                    ? "MHT-CET Percentile"
                    : "Expected MHT-CET Percentile"}
                </label>

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.0001"
                  value={
                    profile.isResultDeclared
                      ? profile.percentile
                      : profile.expectedPercentile
                  }
                  onChange={(event) =>
                    updateProfile(
                      profile.isResultDeclared
                        ? "percentile"
                        : "expectedPercentile",
                      event.target.value
                    )
                  }
                  placeholder="Enter percentile (0–100)"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-7">
              <div className="mb-5 flex items-center gap-2">
                <BookOpen size={17} className="text-[#D6F36A]" />
                <h4 className="text-sm font-bold text-white">
                  Admission Details
                </h4>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>
                    Category
                  </label>
                  <input
                    type="text"
                    value={profile.category}
                    onChange={(event) =>
                      updateProfile("category", event.target.value)
                    }
                    placeholder="As mentioned in CET application"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Candidature Type
                  </label>
                  <input
                    type="text"
                    value={profile.candidatureType}
                    onChange={(event) =>
                      updateProfile("candidatureType", event.target.value)
                    }
                    placeholder="As mentioned in admission documents"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Gender <span className="font-normal text-slate-500">(Optional)</span>
                  </label>
                  <select
                    value={profile.gender}
                    onChange={(event) =>
                      updateProfile("gender", event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    Home University <span className="font-normal text-slate-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={profile.homeUniversity}
                    onChange={(event) =>
                      updateProfile("homeUniversity", event.target.value)
                    }
                    placeholder="Enter your Home University"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-7">
              <div className="mb-5 flex items-center gap-2">
                <MapPin size={17} className="text-[#D6F36A]" />
                <h4 className="text-sm font-bold text-white">
                  College Preferences
                </h4>
              </div>

              <div>
                <label className={labelClass}>
                  Preferred Engineering Branches
                </label>
                <textarea
                  rows={3}
                  value={profile.preferredBranches}
                  onChange={(event) =>
                    updateProfile("preferredBranches", event.target.value)
                  }
                  placeholder="Example: Computer Science and Engineering, Mechanical Engineering"
                  className={`${inputClass} resize-y`}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Separate multiple branches with commas.
                </p>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="rounded-xl border border-[#D6F36A]/20 bg-[#D6F36A]/10 px-4 py-3 text-sm leading-6 text-[#D6F36A]"
              >
                Your profile details are valid. College matching will be
                connected in the next implementation step.
              </p>
            )}

            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#4D8DFF] px-6 py-4 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#3678E8]"
            >
              Continue
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>

            <p className="text-center text-xs leading-5 text-slate-500">
              Historical 2026–27 cutoff data is used for guidance only.
              It does not guarantee future eligibility or admission.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
