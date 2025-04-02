import { useState, useRef, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { BusAnimation } from "./bus-animation";
import { Bus, Rows3 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { getCurrentCycleName } from "../utils/getCycleName";
import { getStepDescription } from "../utils/getStepDescription";
import { getStepExplanation } from "../utils/getStepExplanation";


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
  const [isExecutingStep, setIsExecutingStep] = useState(false); // Track if a step is currently being executed

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
    setIsExecutingStep(false);

    if (timeoutRef.current) { clearTimeout(timeoutRef.current); }
  };

  const nextStep = () => {
    if (isHalted || isExecutingStep) return;

    setIsExecutingStep(true);
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
            setIsExecutingStep(false);
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
          setIsExecutingStep(false);
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
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "fetch-mdr-to-cir":
        // MDR to CIR
        setBusActivity(null);
        setCir(mdr);
        setActiveElement("cir");
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("fetch-increment-pc");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "fetch-increment-pc":
        // Increment PC
        setBusActivity(null);
        setPc(pc + 1);
        setActiveElement("pc");
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("decode");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "decode":
        // Decode instruction
        setBusActivity(null);
        setActiveElement("cir");
        timeoutRef.current = setTimeout(() => {
          // Determine which execute step to go to based on the instruction
          if (cir?.startsWith("LOAD")) {
            setCurrentStep("execute-load-1");
          } else if (cir?.startsWith("ADD")) {
            setCurrentStep("execute-add-1");
          } else if (cir?.startsWith("STORE")) {
            setCurrentStep("execute-store-1");
          } else if (cir?.startsWith("HALT")) {
            setCurrentStep("execute-halt");
          }
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-load-1":
        const loadAddress = Number.parseInt(cir?.split(" ")[1] || "0");
        
        // First set MAR with the address
        setMar(loadAddress);
        setBusActivity(null);
        setActiveElement("mar");
        
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-load-2");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-load-2":
        const loadAddr = Number.parseInt(cir?.split(" ")[1] || "0");
        // Then fetch from RAM using address bus
        setBusActivity({
          type: "address",
          source: "cu",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read the data from.",
        });
        setActiveElement(`ram-${loadAddr}`);
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-load-3");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-load-3":
        const loadAddr2 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Then get data back via data bus
        setMdr(ram[loadAddr2]);
        setBusActivity({
          type: "data",
          source: "ram",
          destination: "cu",
          purpose:
            "The data bus is carrying the data value from RAM back to the Memory Data Register (MDR) in the CPU.",
        });
        setActiveElement("mdr");
        
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-load-4");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-load-4":
        const loadAddr3 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Finally update ACC
        setAcc(Number.parseInt(ram[loadAddr3]));
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
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-add-1":
        const addAddress = Number.parseInt(cir?.split(" ")[1] || "0");
        
        // First set MAR with the address
        setMar(addAddress);
        setBusActivity(null);
        setActiveElement("mar");
        
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-add-2");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-add-2":
        const addAddr = Number.parseInt(cir?.split(" ")[1] || "0");
        // Then fetch from RAM using address bus
        setBusActivity({
          type: "address",
          source: "cu",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read the data from for addition.",
        });
        setActiveElement(`ram-${addAddr}`);
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-add-3");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-add-3":
        const addAddr2 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Then get data back via data bus
        setMdr(ram[addAddr2]);
        setBusActivity({
          type: "data",
          source: "ram",
          destination: "cu",
          purpose:
            "The data bus is carrying the data value from RAM back to the Memory Data Register (MDR) in the CPU for the addition operation.",
        });
        setActiveElement("mdr");
        
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-add-4");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-add-4":
        const addAddr3 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Finally update ACC with addition
        const newAcc = acc + Number.parseInt(ram[addAddr3]);
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
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-store-1":
        const storeAddress = Number.parseInt(cir?.split(" ")[1] || "0");
        
        // First set MAR with the address
        setMar(storeAddress);
        setBusActivity(null);
        setActiveElement("mar");
        
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-store-2");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-store-2":
        // Then set MDR with ACC value
        setMdr(acc.toString());
        setBusActivity(null);
        setActiveElement("mdr");
        
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-store-3");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-store-3":
        const storeAddr = Number.parseInt(cir?.split(" ")[1] || "0");
        // Send address to RAM
        setBusActivity({
          type: "address",
          source: "cu",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to write the data to.",
        });
        setActiveElement(`ram-${storeAddr}`);
        timeoutRef.current = setTimeout(() => {
          setCurrentStep("execute-store-4");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-store-4":
        const storeAddr2 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Send data to RAM
        ram[storeAddr2] = acc.toString();
        setBusActivity({
          type: "data",
          source: "cu",
          destination: "ram",
          purpose: "The data bus is carrying the data value from MDR to be stored at the specified RAM location.",
        });
        
        timeoutRef.current = setTimeout(() => {
          // Go back to fetch cycle
          setCurrentStep("fetch-pc-to-mar");
          setIsExecutingStep(false);
        }, 1000);
        break;

      case "execute-halt":
        setBusActivity(null);
        setIsHalted(true);
        setIsExecutingStep(false);
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

  // The utility functions have been moved to separate files

  return (
    <div className="space-y-6 mt-4">
      <div className="bg-[#eaecf0] text-gray-950 p-4 rounded-t-lg text-center text-xl !mb-0">
        <div>{getCurrentCycleName(currentStep)} → {getStepDescription(currentStep)}</div>
      </div>

      <div className="bg-gray-100 p-4 rounded-b-lg text-gray-800">
        <p>{getStepExplanation(currentStep)}</p>
      </div>

      <div className="flex justify-center space-x-4 mt-6">
        <Button 
          onClick={nextStep} 
          disabled={isHalted || isExecutingStep} 
          className={`${isHalted || isExecutingStep ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} cursor-pointer`}
        >
          {isExecutingStep ? "Executing..." : "Next Step"}
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
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-purple-500 hover:bg-purple-600 flex items-center gap-2 cursor-pointer">
              <Rows3 size={18} />
              Registers
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md md:max-w-xl lg:max-w-3xl">
            <DialogHeader>
              <DialogTitle>The registers in Von Neumann Architecture</DialogTitle>
              <DialogDescription>
                These are the descriptions of the main registers used in the Von Neumann architecture and what they do
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-purple-500 mr-2"></div>
                  <h3 className="font-bold">Program Counter (PC)</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The Program Counter holds the memory address of the next instruction to be fetched and executed. 
                  It automatically increments after each instruction fetch to point to the next instruction in sequence.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-orange-500 mr-2"></div>
                  <h3 className="font-bold">Memory Address Register (MAR)</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The MAR holds the address of the memory location that is going to be accessed (to be read/written to). 
                  It connects to the address bus and specifies which memory location to interact with.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-pink-500 mr-2"></div>
                  <h3 className="font-bold">Memory Data Register (MDR)</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The MDR temporarily holds data being transferred between memory and the CPU. For a memory read, it receives 
                  data from memory; for a memory write, it holds the data to be written to memory.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-cyan-500 mr-2"></div>
                  <h3 className="font-bold">Current Instruction Register (CIR)</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The CIR holds the instruction currently being executed. After an instruction is fetched from memory, 
                  it is stored here while being decoded and executed by the control unit.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-yellow-500 mr-2"></div>
                  <h3 className="font-bold">Accumulator (ACC)</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The Accumulator is a special register in the ALU that holds the results of arithmetic and logical operations. 
                  It acts as a temporary storage for data being processed and the final results of computations.
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