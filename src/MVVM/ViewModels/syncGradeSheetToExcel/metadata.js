import { periodSheets } from "./constants";
import { formatTimeRange } from "./formatters";
import { patchAddress } from "./patches";

export function setMetadata(patches, section) {
  const metadata = {
    room: section?.room || "",
    days: section?.days || "",
    time: formatTimeRange(section),
    code: section?.subject_code || "",
    title: section?.subject_title || section?.subject_code || "",
    edp: section?.edp_code || "",
    sectionNo: section?.section_no || "",
    year: section?.year_level || "",
    teacher: section?.teacher_name || "Jeorge Rey Mancilla",
  };

  const settings = [
    ["D1", metadata.year], ["F1", metadata.room], ["F2", metadata.time],
    ["F3", metadata.days], ["B4", metadata.edp], ["F4", metadata.sectionNo],
    ["B5", metadata.code], ["B6", metadata.teacher], ["B7", metadata.title],
  ];
  settings.forEach(([address, value]) => patchAddress(patches, "Settings", address, value));

  const summary = [
    ["B1", metadata.title], ["E1", metadata.room], ["B2", metadata.time],
    ["E2", metadata.days], ["B3", metadata.code], ["E3", metadata.teacher],
    ["B4", metadata.title],
  ];
  summary.forEach(([address, value]) => patchAddress(patches, "Summary", address, value));

  Object.values(periodSheets).forEach((sheetName) => {
    const periodMetadata = [
      ["E2", metadata.room], ["E3", metadata.days], ["E4", metadata.teacher],
      ["R2", metadata.title], ["R3", metadata.time], ["R4", metadata.code],
    ];
    periodMetadata.forEach(([address, value]) => patchAddress(patches, sheetName, address, value));
  });
}
