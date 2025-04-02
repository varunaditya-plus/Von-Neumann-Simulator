export function getStepDescription(currentStep) {
  switch (currentStep) {
    case "fetch-pc-to-mar":
      return "The Program Counter's value is copied to the Memory Address Register";
    case "fetch-mar-to-ram":
      return "The address in MAR is sent to RAM to find the instruction";
    case "fetch-ram-to-mdr":
      return "The instruction at the specified address is loaded into the MDR";
    case "fetch-mdr-to-cir":
      return "The instruction in MDR is copied to the Current Instruction Register";
    case "fetch-increment-pc":
      return "The Program Counter is incremented (the next instruction will now commence)";
    case "decode":
      return "The CPU analyzes the instruction to determine what operation to perform";
    case "execute-load-1":
      return "The CPU prepares to load by setting the Memory Address Register";
    case "execute-load-2":
      return "The CPU sends the address to RAM via the address bus";
    case "execute-load-3":
      return "The CPU receives the data from RAM into the MDR";
    case "execute-load-4":
      return "The CPU loads the value from MDR into the Accumulator";
    case "execute-add-1":
      return "The CPU prepares to add by setting the Memory Address Register";
    case "execute-add-2":
      return "The CPU sends the address to RAM via the address bus";
    case "execute-add-3":
      return "The CPU receives the data from RAM into the MDR";
    case "execute-add-4":
      return "The CPU adds the value from MDR to the Accumulator";
    case "execute-store-1":
      return "The CPU prepares to store by setting the Memory Address Register";
    case "execute-store-2":
      return "The CPU copies the Accumulator value to the MDR";
    case "execute-store-3":
      return "The CPU sends the address to RAM via the address bus";
    case "execute-store-4":
      return "The CPU sends the data from MDR to RAM via the data bus";
    case "execute-halt":
      return "The CPU stops execution as instructed by the HALT command";
    default:
      return "";
  }
}