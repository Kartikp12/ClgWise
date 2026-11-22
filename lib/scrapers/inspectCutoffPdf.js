
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const PDF_URL =
  "https://cappublicdocs2026.blob.core.windows.net/documents/2026ENGG_CAP1_MH_CutOff_V1.pdf";

async function extractFirstCourse() {
  let loadingTask;

  try {
    console.log("Downloading official cutoff PDF...");

    const response = await axios.get(PDF_URL, {
      responseType: "arraybuffer",
      timeout: 120000,
    });

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(response.data),
      useSystemFonts: true,
      verbosity: 0,
    });

    const pdf = await loadingTask.promise;

    console.log(`PDF loaded: ${pdf.numPages} pages`);

    // Inspect only page 1 for this test.
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();

    const lines = content.items
      .map((item) => item.str.trim())
      .filter(Boolean);

    const courseIndex = lines.findIndex((line) =>
      /^\d{10}\s+-\s+/.test(line)
    );

    if (courseIndex === -1) {
      throw new Error("Course information not found.");
    }

    const courseMatch = lines[courseIndex].match(
      /^(\d{10})\s+-\s+(.+)$/
    );

    const nextCourseIndex = lines.findIndex(
      (line, index) =>
        index > courseIndex && /^\d{10}\s+-\s+/.test(line)
    );

    const courseLines = lines.slice(
      courseIndex,
      nextCourseIndex === -1 ? lines.length : nextCourseIndex
    );

    const stateLevelIndex = courseLines.indexOf("State Level");

    if (stateLevelIndex === -1) {
      throw new Error("Seat category section not found.");
    }

    const stageIndex = courseLines.indexOf("Stage");

    if (stageIndex === -1) {
      throw new Error("Cutoff values section not found.");
    }

    const categoryStart = stateLevelIndex + 1;
    const categoryEnd = courseLines.indexOf("I", categoryStart);

    if (categoryEnd === -1 || categoryEnd >= stageIndex) {
      throw new Error("Could not identify category headers.");
    }

    const categories = courseLines.slice(
      categoryStart,
      categoryEnd
    );

    const cutoffText = courseLines
      .slice(categoryEnd + 1, stageIndex)
      .join(" ");

    const cutoffMatches = [
      ...cutoffText.matchAll(
        /(\d+)\s*\(\s*([\d.]+)\s*\)/g
      ),
    ];

    if (categories.length !== cutoffMatches.length) {
      throw new Error(
        `Category/value mismatch: ${categories.length} categories, ${cutoffMatches.length} values.`
      );
    }

    const cutoffRecords = categories.map((category, index) => ({
      category,
      meritNumber: Number(cutoffMatches[index][1]),
      percentile: Number(cutoffMatches[index][2]),
    }));

    const result = {
      source: "Maharashtra CET Cell",
      academicYear: "2026-27",
      admissionRound: "CAP Round I",
      collegeCode: lines[courseIndex - 1].match(/^(\d{5})/)?.[1] || null,
      collegeName: "Government College of Engineering, Amravati",
      courseCode: courseMatch[1],
      branch: courseMatch[2],
      status: courseLines[courseLines.indexOf("Status:") + 1] || null,
      homeUniversity:
        courseLines[courseLines.indexOf("Home University :") + 1] || null,
      cutoffRecords,
    };

    const outputPath = path.join(
      process.cwd(),
      "lib",
      "data",
      "test-cutoff-output.json"
    );

    fs.writeFileSync(
      outputPath,
      JSON.stringify(result, null, 2),
      "utf8"
    );

    console.log("\nExtraction successful!");
    console.log(`Extracted categories: ${cutoffRecords.length}`);
    console.log(`JSON saved to: ${outputPath}`);
    console.log(JSON.stringify(result, null, 2));

    page.cleanup();
  } catch (error) {
    console.error("\nExtraction failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (loadingTask) {
      await loadingTask.destroy();
    }
  }
}

extractFirstCourse();
