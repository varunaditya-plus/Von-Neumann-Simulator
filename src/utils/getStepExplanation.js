const ibExplanations = {
  "fetch-cu-read": "The CU sends READ on the control bus; the address bus selects the RAM location in MAR.",
  "execute-load-read": "The CU sends READ on the control bus to request the data from the RAM address held in MAR.",
  "execute-add-read": "The CU sends READ on the control bus to request the operand at the RAM address in MAR.",
  "execute-store-write": "The CU sends WRITE on the control bus, using the address in MAR and the value held in MDR.",
  "execute-load-control": "The CU sends a control signal to the ALU to load the value in MDR into the accumulator (AC).",
  "execute-add-control": "The CU sends a control signal to the ALU to add the value held in MDR to the accumulator (AC).",
  "execute-load-4": "The value held in MDR is copied to the accumulator (AC) through an internal CPU data path.",
  "execute-add-4": "The ALU adds the value held in MDR to the accumulator (AC), storing the result back in AC.",
  "decode": "The CU decodes the instruction in IR to identify the operation and any operand needed.",
  "fetch-increment-pc": "The Program Counter increases by 1 to hold the address of the next instruction to fetch.",
};

function explainStep(currentStep) {
  switch (currentStep) {
    case "fetch-pc-to-mar":
      return "The Program Counter (PC) value is copied to the Memory Address Register (MAR) to specify which memory location to access.";
    case "fetch-mar-to-ram":
      return "The address stored in the MAR is sent to RAM via the address bus to locate the instruction.";
    case "fetch-ram-to-mdr":
      return "The instruction at the specified memory address is loaded into the Memory Data Register (MDR) via the data bus.";
    case "fetch-mdr-to-cir":
      return "The instruction in MDR is transferred to the Current Instruction Register (CIR) for processing.";
    case "fetch-increment-pc":
      return "The Program Counter is increased by 1 to prepare for the next instruction fetch.";
    case "decode":
      return "The Control Unit analyzes the instruction in CIR to determine the operation and operands needed.";
    case "execute-load-1":
      return "The CPU extracts the address from the LOAD instruction and places it in the Memory Address Register (MAR).";
    case "execute-load-2":
      return "The address in MAR is sent to RAM via the address bus to locate the data to be loaded.";
    case "execute-load-3":
      return "The data at the specified memory address is loaded into the Memory Data Register (MDR) via the data bus.";
    case "execute-load-4":
      return "The value in MDR is transferred to the Accumulator (ACC) in the ALU via the control bus.";
    case "execute-add-1":
      return "The CPU extracts the address from the ADD instruction and places it in the Memory Address Register (MAR).";
    case "execute-add-2":
      return "The address in MAR is sent to RAM via the address bus to locate the data to be added.";
    case "execute-add-3":
      return "The data at the specified memory address is loaded into the Memory Data Register (MDR) via the data bus.";
    case "execute-add-4":
      return "The ALU adds the value in MDR to the current value in the Accumulator (ACC) and stores the result in ACC.";
    case "execute-store-1":
      return "The CPU extracts the address from the STORE instruction and places it in the Memory Address Register (MAR).";
    case "execute-store-2":
      return "The current value in the Accumulator (ACC) is copied to the Memory Data Register (MDR) to prepare for storage.";
    case "execute-store-3":
      return "The address in MAR is sent to RAM via the address bus to specify where to store the data.";
    case "execute-store-4":
      return "The value in MDR is sent to the specified RAM location via the data bus, completing the store operation.";
    case "execute-halt":
      return "The HALT instruction stops the CPU execution until the system is reset.";
    default:
      return "";
  }
}

export function getStepExplanation(currentStep, isIB = false) {
  if (isIB && ibExplanations[currentStep]) return ibExplanations[currentStep];

  const explanation = explainStep(currentStep);

  return isIB
    ? explanation
      .replaceAll("Current Instruction Register", "Instruction Register")
      .replaceAll("CIR", "IR")
      .replaceAll("ACC", "AC")
    : explanation;
}