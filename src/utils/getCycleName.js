export function getCurrentCycleName(currentStep) {
  if (currentStep.startsWith("fetch")) { return "Fetch"; }
  else if (currentStep === "decode") { return "Decode"; }
  else if (currentStep.startsWith("execute")) { return "Execute"; }
  return "";
}