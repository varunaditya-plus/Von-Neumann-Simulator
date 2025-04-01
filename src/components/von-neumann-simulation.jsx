import { useState, useRef, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { BusAnimation } from "./bus-animation";
import { Bus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";


export function VonNeumannSimulation() {
  const [pc, setPc] = useState(0); // Program Counter
  const [mar, setMar] = useState(null); // Memory Address Register
  const [mdr, setMdr] = useState(null); // Memory Data Register
  const [cir, setCir] = useState(null); // Current Instruction Register
  const [acc, setAcc] = useState(0); // Accumulator
  const [currentStep, setCurrentStep] = useState("fetch-pc-to-mar"); // current step in the simulation
  const [busActivity, setBusActivity] = useState(null); // the bus's current activity
  const [isHalted, setIsHalted] = useState(false); // if the simulation halted yet
  const [activeElement, setActiveElement] = useState(null); // the current active element in the simulation

  const ram = [
    "LOAD 5", // 0: Load address 5 value into ACC
    "ADD 6", // 1: Add address 6 value to ACC
    "STORE 7", // 2: Store ACC value to address 7
    "HALT", // 3: Stop execution
    "-", // 4: Empty
    "10", // 5: Data: 10
    "5", // 6: Data: 5
    "0", // 7: Result will be stored here
  ];

  const timeoutRef = useRef(null);

  const resetSimulation = () => {
    setPc(0);
    setMar(null);
    setMdr(null);
    setCir(null);
    setAcc(0);
    setCurrentStep("fetch-pc-to-mar");
    setBusActivity(null);
    setIsHalted(false);
    setActiveElement(null);

    if (timeoutRef.current) { clearTimeout(timeoutRef.current); }
  };

  const nextStep = () => {
    if (isHalted) return;

    setActiveElement(null);

    switch (currentStep) {
      case "fetch-pc-to-mar":
        // PC to MAR
        setActiveElement("pc");
        setMar(pc);
        setBusActivity(null);
        timeoutRef.current = setTimeout(() => {
          setActiveElement("mar");
          timeoutRef.current = setTimeout(() => {
            setCurrentStep("fetch-mar-to-ram");
            setActiveElement(null);
          }, 1000);
        }, 1000);
        break;

      case "fetch-mar-to-ram":
        // MAR to RAM (address bus)
        setBusActivity({
          type: "address",
          source: "cu",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read from.",
        });
        setActiveElement(`ram-${mar}`);
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("fetch-ram-to-mdr");
        }, 1000);
        break;

      case "fetch-ram-to-mdr":
        // RAM to MDR (data bus)
        setBusActivity({
          type: "data",
          source: "ram",
          destination: "cu",
          purpose:
            "The data bus is carrying the instruction data from the specified RAM location back to the Memory Data Register (MDR) in the CPU.",
        });
        setMdr(ram[mar]);
        setActiveElement("mdr");
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("fetch-mdr-to-cir");
        }, 1000);
        break;

      case "fetch-mdr-to-cir":
        // MDR to CIR
        setBusActivity(null);
        setCir(mdr);
        setActiveElement("cir");
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("fetch-increment-pc");
        }, 1000);
        break;

      case "fetch-increment-pc":
        // Increment PC
        setBusActivity(null);
        setPc(pc + 1);
        setActiveElement("pc");
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("decode");
        }, 1000);
        break;

      case "decode":
        // Decode instruction
        setBusActivity(null);
        setActiveElement("cir");
        timeoutRef.current = setTimeout(() => {
          // Determine which execute step to go to based on the instruction
          if (cir?.startsWith("LOAD")) {
            setCurrentStep("execute-load");
          } else if (cir?.startsWith("ADD")) {
            setCurrentStep("execute-add");
          } else if (cir?.startsWith("STORE")) {
            setCurrentStep("execute-store");
          } else if (cir?.startsWith("HALT")) {
            setCurrentStep("execute-halt");
          }
        }, 1000);
        break;

      case "execute-load":
        const loadAddress = Number.parseInt(cir?.split(" ")[1] || "0");

        // First set MAR with the address
        setMar(loadAddress);
        setBusActivity(null);
        setActiveElement("mar");

        timeoutRef.current = setTimeout(() => {
          // Then fetch from RAM using address bus
          setBusActivity({
            type: "address",
            source: "cu",
            destination: "ram",
            purpose:
              "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read the data from.",
          });
          setActiveElement(`ram-${loadAddress}`);

          timeoutRef.current = setTimeout(() => {
            // Then get data back via data bus
            setMdr(ram[loadAddress]);
            setBusActivity({
              type: "data",
              source: "ram",
              destination: "cu",
              purpose:
                "The data bus is carrying the data value from RAM back to the Memory Data Register (MDR) in the CPU.",
            });
            setActiveElement("mdr");

            timeoutRef.current = setTimeout(() => {
              // Finally update ACC
              setAcc(Number.parseInt(ram[loadAddress]));
              setBusActivity({
                type: "control",
                source: "cu",
                destination: "alu",
                purpose:
                  "The control bus is carrying control signals to load the value from MDR into the Accumulator (ACC) in the ALU.",
              });
              setActiveElement("acc");

              timeoutRef.current = setTimeout(() => {
                // Go back to fetch cycle
                setCurrentStep("fetch-pc-to-mar");
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);
        break;

      case "execute-add":
        const addAddress = Number.parseInt(cir?.split(" ")[1] || "0");

        // First set MAR with the address
        setMar(addAddress);
        setBusActivity(null);
        setActiveElement("mar");

        timeoutRef.current = setTimeout(() => {
          // Then fetch from RAM using address bus
          setBusActivity({
            type: "address",
            source: "cu",
            destination: "ram",
            purpose:
              "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read the data from for addition.",
          });
          setActiveElement(`ram-${addAddress}`);

          timeoutRef.current = setTimeout(() => {
            // Then get data back via data bus
            setMdr(ram[addAddress]);
            setBusActivity({
              type: "data",
              source: "ram",
              destination: "cu",
              purpose:
                "The data bus is carrying the data value from RAM back to the Memory Data Register (MDR) in the CPU for the addition operation.",
            });
            setActiveElement("mdr");

            timeoutRef.current = setTimeout(() => {
              // Finally update ACC with addition
              const newAcc = acc + Number.parseInt(ram[addAddress]);
              setAcc(newAcc);
              setBusActivity({
                type: "control",
                source: "cu",
                destination: "alu",
                purpose:
                  "The control bus is carrying control signals to the ALU to add the value from MDR to the current value in the Accumulator (ACC).",
              });
              setActiveElement("acc");

              timeoutRef.current = setTimeout(() => {
                // Go back to fetch cycle
                setCurrentStep("fetch-pc-to-mar");
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);
        break;

      case "execute-store":
        const storeAddress = Number.parseInt(cir?.split(" ")[1] || "0");

        // First set MAR with the address
        setMar(storeAddress);
        setBusActivity(null);
        setActiveElement("mar");

        timeoutRef.current = setTimeout(() => {
          // Then set MDR with ACC value
          setMdr(acc.toString());
          setBusActivity(null);
          setActiveElement("mdr");

          timeoutRef.current = setTimeout(() => {
            // Send address to RAM
            setBusActivity({
              type: "address",
              source: "cu",
              destination: "ram",
              purpose:
                "The address bus is carrying the memory address from MAR to RAM to specify which memory location to write the data to.",
            });
            setActiveElement(`ram-${storeAddress}`);

            timeoutRef.current = setTimeout(() => {
              // Send data to RAM
              ram[storeAddress] = acc.toString();
              setBusActivity({
                type: "data",
                source: "cu",
                destination: "ram",
                purpose: "The data bus is carrying the data value from MDR to be stored at the specified RAM location.",
              });

              timeoutRef.current = setTimeout(() => {
                // Go back to fetch cycle
                setCurrentStep("fetch-pc-to-mar");
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);
        break;

      case "execute-halt":
        setBusActivity(null);
        setIsHalted(true);
        break;
    }
  };

  // Clean up any timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Get current cycle name (updates)
  const getCurrentCycleName = () => {
    if (currentStep.startsWith("fetch")) {
      return "Fetch";
    } else if (currentStep === "decode") {
      return "Decode";
    } else if (currentStep.startsWith("execute")) {
      return "Execute";
    }
    return "";
  };

  // Get current step description (updates)
  const getStepDescription = () => {
    switch (currentStep) {
      case "fetch-pc-to-mar":
        return "The Program Counter value is copied to the Memory Address Register";
      case "fetch-mar-to-ram":
        return "The address in MAR is sent to RAM to locate the instruction";
      case "fetch-ram-to-mdr":
        return "The instruction at the specified address is loaded into the MDR";
      case "fetch-mdr-to-cir":
        return "The instruction in MDR is transferred to the Current Instruction Register";
      case "fetch-increment-pc":
        return "The Program Counter is incremented to point to the next instruction";
      case "decode":
        return "The CPU analyzes the instruction to determine what operation to perform";
      case "execute-load":
        return "The CPU loads a value from memory into the Accumulator";
      case "execute-add":
        return "The CPU adds a value from memory to the Accumulator";
      case "execute-store":
        return "The CPU stores the Accumulator value into memory";
      case "execute-halt":
        return "The CPU stops execution as instructed by the HALT command";
      default:
        return "";
    }
  };

  // Get current explanation of the step (updates)
  const getStepExplanation = () => {
    switch (currentStep) {
      case "fetch-pc-to-mar":
        return "The Program Counter (PC) contains the address of the next instruction to be executed. This address is copied to the Memory Address Register (MAR) so the CPU can access that memory location.";
      case "fetch-mar-to-ram":
        return "The address stored in the MAR is sent to RAM via the address bus. This tells the memory system exactly which location needs to be accessed to retrieve the instruction.";
      case "fetch-ram-to-mdr":
        return "The instruction stored at the memory address specified by MAR is retrieved and placed into the Memory Data Register (MDR). The data travels from RAM to the CPU via the data bus.";
      case "fetch-mdr-to-cir":
        return "The instruction now in the MDR is transferred to the Current Instruction Register (CIR). This prepares the instruction for decoding and execution by the CPU.";
      case "fetch-increment-pc":
        return "The Program Counter is increased by 1 to point to the next instruction in sequence. This happens before the current instruction is executed, ensuring the CPU is ready for the next fetch cycle.";
      case "decode":
        return "The Control Unit analyzes the instruction in the CIR to determine what operation needs to be performed. It identifies the opcode (operation code) and any operands (data or addresses) needed for execution.";
      case "execute-load":
        return "The LOAD instruction retrieves a value from the specified memory address and places it in the Accumulator (ACC). This involves setting the MAR with the target address, retrieving the data via the data bus, and storing it in the ACC.";
      case "execute-add":
        return "The ADD instruction retrieves a value from the specified memory address and adds it to the current value in the Accumulator. This arithmetic operation is performed by the ALU (Arithmetic Logic Unit).";
      case "execute-store":
        return "The STORE instruction takes the current value in the Accumulator and writes it to the specified memory address. The CPU sets the MAR with the target address and sends the ACC value via the data bus to be stored in RAM.";
      case "execute-halt":
        return "The HALT instruction signals the CPU to stop executing instructions. This effectively ends the program's execution until the system is reset or a new program is loaded.";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <div className="bg-[#eaecf0] text-gray-950 p-4 rounded-t-lg text-center text-xl !mb-0">
        <div>{getCurrentCycleName()} → {getStepDescription()}</div>
      </div>

      <div className="bg-gray-100 p-4 rounded-b-lg text-gray-800">
        <p>{getStepExplanation()}</p>
      </div>

      <div className="flex justify-center space-x-4 mt-6">
        <Button onClick={nextStep} disabled={isHalted} className="bg-green-600 hover:bg-green-700 cursor-pointer">
          Next Step
        </Button>
        <Button onClick={resetSimulation} variant="outline" className="hover:!border-[#babfc6] cursor-pointer">
          Reset
        </Button>
        <div className="h-10 w-px bg-gray-300"></div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600 flex items-center gap-2 cursor-pointer">
              <Bus size={18} />
              Bus Info
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md md:max-w-xl lg:max-w-3xl">
            <DialogHeader>
              <DialogTitle>The three buses in Von Neumann Architecture</DialogTitle>
              <DialogDescription>
                These are short descriptions of the three types of buses in the Von Neumann architecture (what they do)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-500 mr-2"></div>
                  <h3 className="font-bold">Address Bus</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The Address Bus carries memory addresses from the CPU to memory. It's unidirectional 
                  (one-way) and shows which memory location the CPU wants to access.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-red-500 mr-2"></div>
                  <h3 className="font-bold">Data Bus</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The Data Bus transfers actual data between the CPU and memory. It's bidirectional (two-way), 
                  allowing data to flow in both directions.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-green-500 mr-2"></div>
                  <h3 className="font-bold">Control Bus</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The Control Bus carries signals between the CPU and components (like RAM). These signals decide 
                  the what kind operations is being carried out (read/write), the timing, and other operation-specific stuff. It includes signals 
                  like read/write, interrupt requests, and more.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relativ !mb-0">
        {/* Control Unit */}
        <Card
          className={`p-4 border-2 ${activeElement === "pc" || activeElement === "mar" || activeElement === "mdr" || activeElement === "cir" ? "border-yellow-400" : "border-gray-200"}`}
        >
          <h2 className="text-lg font-bold text-center mb-4">Control Unit</h2>
          <div className={`mb-2 p-2 rounded ${activeElement === "pc" ? "bg-yellow-100" : "bg-gray-100"}`}>
            <span className="font-bold inline-block w-16">PC:</span>
            <span className="inline-block w-24 text-center bg-white border border-gray-300 px-2">{pc}</span>
          </div>
          <div className={`mb-2 p-2 rounded ${activeElement === "mar" ? "bg-yellow-100" : "bg-gray-100"}`}>
            <span className="font-bold inline-block w-16">MAR:</span>
            <span className="inline-block w-24 text-center bg-white border border-gray-300 px-2">
              {mar !== null ? mar : "-"}
            </span>
          </div>
          <div className={`mb-2 p-2 rounded ${activeElement === "mdr" ? "bg-yellow-100" : "bg-gray-100"}`}>
            <span className="font-bold inline-block w-16">MDR:</span>
            <span className="inline-block w-24 text-center bg-white border border-gray-300 px-2">
              {mdr !== null ? mdr : "-"}
            </span>
          </div>
          <div className={`mb-2 p-2 rounded ${activeElement === "cir" ? "bg-yellow-100" : "bg-gray-100"}`}>
            <span className="font-bold inline-block w-16">CIR:</span>
            <span className="inline-block w-24 text-center bg-white border border-gray-300 px-2">
              {cir !== null ? cir : "-"}
            </span>
          </div>
        </Card>

        {/* RAM */}
        <Card className="p-4 border-2 border-gray-200">
          <h2 className="text-lg font-bold text-center mb-4">RAM</h2>
          {ram.map((content, index) => (
            <div key={index} className={`flex mb-1 ${activeElement === `ram-${index}` ? "bg-yellow-100" : ""}`}>
              <div className="w-12 font-bold text-right pr-2">{index}:</div>
              <div className="flex-1 bg-white border border-gray-300 px-2">{content}</div>
            </div>
          ))}
        </Card>

        {/* ALU */}
        <Card className={`p-4 border-2 ${activeElement === "acc" ? "border-yellow-400" : "border-gray-200"}`}>
          <h2 className="text-lg font-bold text-center mb-4">ALU</h2>
          <div className={`mb-2 p-2 rounded ${activeElement === "acc" ? "bg-yellow-100" : "bg-gray-100"}`}>
            <span className="font-bold inline-block w-16">ACC:</span>
            <span className="inline-block w-24 text-center bg-white border border-gray-300 px-2">{acc}</span>
          </div>
        </Card>

        {/* Bus System */}
        <div className="col-span-1 md:col-span-3 h-24 relative mt-8">
          <BusAnimation busActivity={busActivity} />
        </div>
      </div>

      {/* Bus Purpose Display */}
      {busActivity && (
        <div className="flex items-center justify-center mb-4 -mt-6 text-sm">
          <div className={`w-3 h-3 rounded-full mr-2 ${
              busActivity.type === "address"
                ? "bg-blue-500"
                : busActivity.type === "data"
                  ? "bg-red-500"
                  : "bg-green-500"
            }`}
          ></div>
          <p className="text-gray-700">{busActivity.purpose}</p>
        </div>
      )}

    </div>
  );
}