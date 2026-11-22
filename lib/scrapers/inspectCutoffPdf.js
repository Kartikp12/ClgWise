
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const PDF_URL =
  "https://cappublicdocs2026.blob.core.windows.net/documents/2026ENGG_CAP1_MH_CutOff_V1.pdf";

const ACADEMIC_YEAR = "2026-27";
const ADMISSION_ROUND = "CAP Round I";

const OUTPUT_PATH = path.join(
  process.cwd(),
  "lib",
  "data",
  "admissions",
  ACADEMIC_YEAR,
  "cap-round-1.json"
);

const COLLEGE_REGEX = /^(\d{5})\s+-\s+(.+)$/;
const COURSE_REGEX = /^(\d{10})\s+-\s+(.+)$/;

function parseCourse(lines, college, pageNumber) {
  const courseMatch = lines[0].match(COURSE_REGEX);

  if (!courseMatch) {
    throw new Error("Invalid course heading");
  }

  if (!college) {
    throw new Error("College information unavailable");
  }

  const stateLevelIndex = lines.indexOf("State Level");

  if (stateLevelIndex === -1) {
    throw new Error("State Level section missing");
  }

  const categoryStart = stateLevelIndex + 1;
  const categoryEnd = lines.indexOf("I", categoryStart);

  if (categoryEnd === -1) {
    throw new Error("Category headers missing");
  }

  const stageIndex = lines.indexOf("Stage", categoryEnd);

  if (stageIndex === -1) {
    throw new Error("Stage section missing");
  }

  const categories = lines
    .slice(categoryStart, categoryEnd)
    .filter(Boolean);

  const cutoffText = lines
    .slice(categoryEnd + 1, stageIndex)
    .join(" ");

  const cutoffMatches = [
    ...cutoffText.matchAll(
      /(\d+)\s*\(\s*([\d.]+)\s*\)/g
    ),
  ];

  if (categories.length !== cutoffMatches.length) {
    throw new Error(
      `Category mismatch: ${categories.length} categories, ${cutoffMatches.length} values`
    );
  }

  const statusIndex = lines.indexOf("Status:");
  const universityIndex = lines.indexOf("Home University :");

  const cutoffRecords = categories.map((category, index) => ({
    category,
    meritNumber: Number(cutoffMatches[index][1]),
    percentile: Number(cutoffMatches[index][2]),
  }));

  return {
    courseCode: courseMatch[1],
    branch: courseMatch[2],
    status:
      statusIndex !== -1
        ? lines[statusIndex + 1] || null
        : null,
    homeUniversity:
      universityIndex !== -1
        ? lines[universityIndex + 1] || null
        : null,
    sourcePage: pageNumber,
    cutoffRecords,
  };
}

function addCourseToCollege(collegesMap, college, course) {
  if (!collegesMap.has(college.collegeCode)) {
    collegesMap.set(college.collegeCode, {
      collegeCode: college.collegeCode,
      collegeName: college.collegeName,
      courses: [],
    });
  }

  const collegeData = collegesMap.get(college.collegeCode);

  const duplicate = collegeData.courses.some(
    (item) => item.courseCode === course.courseCode
  );

  if (duplicate) {
    return false;
  }

  collegeData.courses.push(course);

  return true;
}

async function extractCompletePdf() {
  let loadingTask;

  const collegesMap = new Map();

  const report = {
    pagesProcessed: 0,
    pagesFailed: [],
    totalCoursesFound: 0,
    totalCoursesExtracted: 0,
    duplicateCourses: [],
    parsingErrors: [],
  };

  let totalCutoffRecords = 0;
  let currentCollege = null;

  const startTime = Date.now();

  try {
    console.log("Downloading official CET Cell PDF...");

    const response = await axios.get(PDF_URL, {
      responseType: "arraybuffer",
      timeout: 120000,
    });

    const pdfBuffer = new Uint8Array(response.data);

    console.log(
      `Downloaded PDF: ${(pdfBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
    );

    const pdfjsLib = await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

    loadingTask = pdfjsLib.getDocument({
      data: pdfBuffer,
      useSystemFonts: true,
      verbosity: 0,
    });

    const pdf = await loadingTask.promise;

    console.log(`Total PDF pages: ${pdf.numPages}`);
    console.log("Starting complete extraction...\n");

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      let page;

      try {
        page = await pdf.getPage(pageNumber);

        const content = await page.getTextContent();

        const lines = content.items
          .map((item) => item.str.trim())
          .filter(Boolean);

        let index = 0;

        while (index < lines.length) {
          const line = lines[index];

          // Detect a new college heading.
          const collegeMatch = line.match(COLLEGE_REGEX);

          if (collegeMatch) {
            currentCollege = {
              collegeCode: collegeMatch[1],
              collegeName: collegeMatch[2],
            };

            index++;
            continue;
          }

          // Detect a course heading.
          const courseMatch = line.match(COURSE_REGEX);

          if (courseMatch) {
            report.totalCoursesFound++;

            const courseStart = index;
            let courseEnd = index + 1;

            // Find the next college or course boundary.
            while (courseEnd < lines.length) {
              if (
                COLLEGE_REGEX.test(lines[courseEnd]) ||
                COURSE_REGEX.test(lines[courseEnd])
              ) {
                break;
              }

              courseEnd++;
            }

            const courseLines = lines.slice(
              courseStart,
              courseEnd
            );

            try {
              const course = parseCourse(
                courseLines,
                currentCollege,
                pageNumber
              );

              const added = addCourseToCollege(
                collegesMap,
                currentCollege,
                course
              );

              if (added) {
                report.totalCoursesExtracted++;

                totalCutoffRecords +=
                  course.cutoffRecords.length;
              } else {
                report.duplicateCourses.push({
                  collegeCode: currentCollege.collegeCode,
                  courseCode: course.courseCode,
                  pageNumber,
                });
              }

            } catch (error) {
              report.parsingErrors.push({
                pageNumber,
                collegeCode: currentCollege?.collegeCode || null,
                courseCode: courseMatch[1],
                branch: courseMatch[2],
                error: error.message,
              });
            }

            index = courseEnd;
            continue;
          }

          index++;
        }

        report.pagesProcessed++;

      } catch (error) {
        report.pagesFailed.push({
          pageNumber,
          error: error.message,
        });

      } finally {
        if (page) {
          page.cleanup();
        }
      }

      // Progress update every 25 pages.
      if (
        pageNumber % 25 === 0 ||
        pageNumber === pdf.numPages
      ) {
        console.log(
          `Progress: ${pageNumber}/${pdf.numPages} pages | ` +
          `${report.totalCoursesExtracted} courses | ` +
          `${totalCutoffRecords} cutoff records`
        );
      }
    }

    const colleges = Array.from(collegesMap.values());

    const totalCourses = colleges.reduce(
      (total, college) => total + college.courses.length,
      0
    );

    const result = {
      metadata: {
        source: "Maharashtra CET Cell",
        sourceUrl: PDF_URL,
        academicYear: ACADEMIC_YEAR,
        admissionRound: ADMISSION_ROUND,
        seatType: "Maharashtra & Minority Seats",
        totalPdfPages: pdf.numPages,
        generatedAt: new Date().toISOString(),
      },

      summary: {
        totalColleges: colleges.length,
        totalCourses,
        totalCutoffRecords,
      },

      parsingReport: {
        ...report,
        status:
          report.pagesFailed.length === 0 &&
          report.parsingErrors.length === 0 &&
          report.duplicateCourses.length === 0
            ? "completed"
            : "needs_review",
      },

      colleges,
    };

    fs.mkdirSync(path.dirname(OUTPUT_PATH), {
      recursive: true,
    });

    fs.writeFileSync(
      OUTPUT_PATH,
      JSON.stringify(result, null, 2),
      "utf8"
    );

    const durationSeconds = (
      (Date.now() - startTime) / 1000
    ).toFixed(2);

    console.log("\n========== FINAL EXTRACTION REPORT ==========");

    console.log(`Pages processed: ${report.pagesProcessed}`);
    console.log(`Pages failed: ${report.pagesFailed.length}`);
    console.log(`Colleges extracted: ${colleges.length}`);
    console.log(`Courses found: ${report.totalCoursesFound}`);
    console.log(`Courses extracted: ${totalCourses}`);
    console.log(`Cutoff records: ${totalCutoffRecords}`);
    console.log(`Parsing errors: ${report.parsingErrors.length}`);
    console.log(`Duplicate courses: ${report.duplicateCourses.length}`);

    console.log(
      `\nExtraction status: ${result.parsingReport.status}`
    );

    console.log(`Time taken: ${durationSeconds} seconds`);
    console.log(`\nDataset saved at:\n${OUTPUT_PATH}`);

    console.log("\nComplete PDF extraction finished.");

  } catch (error) {
    console.error("\nPDF extraction failed:");
    console.error(error.message);

    process.exitCode = 1;

  } finally {
    if (loadingTask) {
      await loadingTask.destroy();
    }
  }
}

extractCompletePdf();
