
import admissionsData from "./2026-27/master-colleges.json";

export default function getAdmissionStats() {
  const institutes = admissionsData.institutes;

  if (!Array.isArray(institutes) || institutes.length === 0) {
    throw new Error(
      "ClgWise: Admission dataset is missing or invalid."
    );
  }

  const totalInstitutes = institutes.length;

  const totalCourses = institutes.reduce((total, institute) => {
    return total + (
      Array.isArray(institute.courses)
        ? institute.courses.length
        : 0
    );
  }, 0);

  const totalCutoffRecords = institutes.reduce(
    (total, institute) => {
      const courses = Array.isArray(institute.courses)
        ? institute.courses
        : [];

      const instituteCutoffs = courses.reduce(
        (courseTotal, course) => {
          return courseTotal + (
            Array.isArray(course.cutoffRecords)
              ? course.cutoffRecords.length
              : 0
          );
        },
        0
      );

      return total + instituteCutoffs;
    },
    0
  );

  const institutesWithCutoffData = institutes.filter(
    (institute) => institute.cutoffAvailable === true
  ).length;

  return {
    totalInstitutes,
    totalCourses,
    totalCutoffRecords,
    institutesWithCutoffData,
  };
}
