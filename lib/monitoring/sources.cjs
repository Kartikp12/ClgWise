
const SOURCES = [
    {
      id: "cet-cell-home",
      authority: "Maharashtra State CET Cell",
      category: "official",
      academicYearScope: "all",
      url: "https://cetcell.mahacet.org/",
      enabled: true,
    },
    {
      id: "cet-cell-notices",
      authority: "Maharashtra State CET Cell",
      category: "official",
      academicYearScope: "all",
      url: "https://cetcell.mahacet.org/Notices/",
      enabled: true,
    },
    {
      id: "dte-home",
      authority: "Directorate of Technical Education Maharashtra",
      category: "official",
      academicYearScope: "all",
      url: "https://dte.maharashtra.gov.in/",
      enabled: true,
    },
    {
      id: "fra-home",
      authority: "Maharashtra Fees Regulating Authority",
      category: "official",
      academicYearScope: "all",
      url: "https://mahafra.org/api/latest-update/fetchLatestUpdate",
      format: "json",
      enabled: true,
    },
    {
      id: "cet-engineering-2026-27",
      authority: "Maharashtra State CET Cell",
      category: "official",
      academicYearScope: "2026-27",
      url: "https://fe2026.mahacet.org/StaticPages/HomePage?did=475",
      enabled: true,
    },
    {
      id: "cet-institute-list-2026-27",
      authority: "Maharashtra State CET Cell",
      category: "official",
      academicYearScope: "2026-27",
      url: "https://fe2026.mahacet.org/StaticPages/frmInstituteWiseAllotmentList",
      enabled: true,
    },
    {
      id: "fra-fees-2026-27",
      authority: "Maharashtra Fees Regulating Authority",
      category: "official",
      academicYearScope: "2026-27",
      url: "https://ay26-27.mahafraportal.org/",
      enabled: true,
    },

{
    id: "cet-cap-round-1-cutoff-2026-27",
    authority: "Maharashtra State CET Cell",
    category: "admission-cutoff",
    academicYearScope: "2026-27",
    url: "https://cappublicdocs2026.blob.core.windows.net/documents/2026ENGG_CAP1_MH_CutOff_V1.pdf",
    format: "pdf",
    enabled: true,
  },
  
  ];
  
  module.exports = SOURCES;
  