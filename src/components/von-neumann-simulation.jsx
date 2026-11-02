import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { BusAnimation } from "./bus-animation";
import { AnimatedValue } from "./animated-value";
import { Bus, Rows3 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { getCurrentCycleName } from "../utils/getCycleName";
import { getStepDescription } from "../utils/getStepDescription";
import { getStepExplanation } from "../utils/getStepExplanation";


export function VonNeumannSimulation() {
  const [timelinePosition, setTimelinePosition] = useState(0);
  const [isExecutingStep, setIsExecutingStep] = useState(false); // Track if a step is currently being executed

  const initialRam = [
    "LOAD 5", // 0: Load address 5 value into ACC
    "ADD 6", // 1: Add address 6 value to ACC
    "STORE 7", // 2: Store ACC value to address 7
    "HALT", // 3: Stop execution
    "-", // 4: Empty
    "10", // 5: Data: 10
    "5", // 6: Data: 5
    "0", // 7: Result will be stored here
  ];

  const [timeline] = useState(() => {
    const steps = [];
    let state = { pc: 0, mar: null, mdr: null, cir: null, acc: 0,
      currentStep: "fetch-pc-to-mar", isHalted: false, ram: initialRam };
    while (!state.isHalted) {
      const step = getSimulationStep(state);
      steps.push({ state, ...step });
      state = step.nextState;
    }
    return steps;
  });
  const timelineEnd = timeline.length * 1000;
  const stepIndex = Math.min(Math.floor(timelinePosition / 1000), timeline.length - 1);
  const stepProgress = (timelinePosition - stepIndex * 1000) / 1000;
  const step = timeline[stepIndex];
  const simulation = step.state;
  const { pc, mar, mdr, cir, acc, ram, currentStep } = simulation;
  const isHalted = stepProgress === 1 && step.nextState.isHalted;
  const { busActivity } = step;
  const activeElement = stepProgress === 0 ? null
    : stepProgress < 0.5 ? step.sourceElement : step.activeElement;
  const playbackRef = useRef(null);
  const diagramRef = useRef(null);

  const activityStyle = (element) => {
    const source = element === step.animation.source ? Math.sin(Math.PI * Math.min(1, stepProgress / 0.65)) : 0;
    const destination = element === step.animation.destination ? Math.sin(Math.PI * Math.max(0, (stepProgress - 0.35) / 0.65)) : 0;
    const intensity = Math.max(source, destination);
    return { boxShadow: `0 0 0 ${3 * intensity}px rgba(250, 204, 21, ${intensity})` };
  };

  const resetSimulation = () => {
    setTimelinePosition(0);
    setIsExecutingStep(false);
  };

  // Keep a start and end snapshot for each step so dragging can reverse it.
  function getSimulationStep(state) {
    const { pc, mar, mdr, cir, acc, currentStep } = state;
    const ram = [...state.ram];
    const nextState = { ...state, ram };
    let busActivity = null;
    let activeElement = null;

    switch (currentStep) {
      case "fetch-pc-to-mar":
        // PC to MAR
        nextState.mar = pc;
        busActivity = null;
        activeElement = "mar";
        nextState.currentStep = "fetch-mar-to-ram";
        break;

      case "fetch-mar-to-ram":
        // MAR to RAM (address bus)
        busActivity = {
          type: "address",
          source: "registers",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read from.",
        };
        activeElement = `ram-${mar}`;
        nextState.currentStep = "fetch-ram-to-mdr";
        break;

      case "fetch-ram-to-mdr":
        // RAM to MDR (data bus)
        busActivity = {
          type: "data",
          source: "ram",
          destination: "registers",
          purpose:
            "The data bus is carrying the instruction data from the specified RAM location back to the Memory Data Register (MDR) in the CPU.",
        };
        nextState.mdr = ram[mar];
        activeElement = "mdr";
        nextState.currentStep = "fetch-mdr-to-cir";
        break;

      case "fetch-mdr-to-cir":
        // MDR to CIR
        busActivity = null;
        nextState.cir = mdr;
        activeElement = "cir";
        nextState.currentStep = "fetch-increment-pc";
        break;

      case "fetch-increment-pc":
        // Increment PC
        busActivity = null;
        nextState.pc = pc + 1;
        activeElement = "pc";
        nextState.currentStep = "decode";
        break;

      case "decode":
        // Decode instruction
        busActivity = null;
        activeElement = "cir";
        // Determine which execute step to go to based on the instruction
        if (cir?.startsWith("LOAD")) {
          nextState.currentStep = "execute-load-1";
        } else if (cir?.startsWith("ADD")) {
          nextState.currentStep = "execute-add-1";
        } else if (cir?.startsWith("STORE")) {
          nextState.currentStep = "execute-store-1";
        } else if (cir?.startsWith("HALT")) {
          nextState.currentStep = "execute-halt";
        }
        break;

      case "execute-load-1": {
        const loadAddress = Number.parseInt(cir?.split(" ")[1] || "0");
        
        // First set MAR with the address
        nextState.mar = loadAddress;
        busActivity = null;
        activeElement = "mar";
        
        nextState.currentStep = "execute-load-2";
        break;
      }

      case "execute-load-2": {
        const loadAddr = Number.parseInt(cir?.split(" ")[1] || "0");
        // Then fetch from RAM using address bus
        busActivity = {
          type: "address",
          source: "registers",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read the data from.",
        };
        activeElement = `ram-${loadAddr}`;
        nextState.currentStep = "execute-load-3";
        break;
      }

      case "execute-load-3": {
        const loadAddr2 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Then get data back via data bus
        nextState.mdr = ram[loadAddr2];
        busActivity = {
          type: "data",
          source: "ram",
          destination: "registers",
          purpose:
            "The data bus is carrying the data value from RAM back to the Memory Data Register (MDR) in the CPU.",
        };
        activeElement = "mdr";
        
        nextState.currentStep = "execute-load-4";
        break;
      }

      case "execute-load-4": {
        const loadAddr3 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Finally update ACC
        nextState.acc = Number.parseInt(ram[loadAddr3]);
        busActivity = {
          type: "control",
          source: "registers",
          destination: "alu",
          purpose:
            "The control bus is carrying control signals to load the value from MDR into the Accumulator (ACC) in the ALU.",
        };
        activeElement = "acc";
        
        // Go back to fetch cycle
        nextState.currentStep = "fetch-pc-to-mar";
        break;
      }

      case "execute-add-1": {
        const addAddress = Number.parseInt(cir?.split(" ")[1] || "0");
        
        // First set MAR with the address
        nextState.mar = addAddress;
        busActivity = null;
        activeElement = "mar";
        
        nextState.currentStep = "execute-add-2";
        break;
      }

      case "execute-add-2": {
        const addAddr = Number.parseInt(cir?.split(" ")[1] || "0");
        // Then fetch from RAM using address bus
        busActivity = {
          type: "address",
          source: "registers",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read the data from for addition.",
        };
        activeElement = `ram-${addAddr}`;
        nextState.currentStep = "execute-add-3";
        break;
      }

      case "execute-add-3": {
        const addAddr2 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Then get data back via data bus
        nextState.mdr = ram[addAddr2];
        busActivity = {
          type: "data",
          source: "ram",
          destination: "registers",
          purpose:
            "The data bus is carrying the data value from RAM back to the Memory Data Register (MDR) in the CPU for the addition operation.",
        };
        activeElement = "mdr";
        
        nextState.currentStep = "execute-add-4";
        break;
      }

      case "execute-add-4": {
        const addAddr3 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Finally update ACC with addition
        const newAcc = acc + Number.parseInt(ram[addAddr3]);
        nextState.acc = newAcc;
        busActivity = {
          type: "control",
          source: "registers",
          destination: "alu",
          purpose:
            "The control bus is carrying control signals to the ALU to add the value from MDR to the current value in the Accumulator (ACC).",
        };
        activeElement = "acc";
        
        // Go back to fetch cycle
        nextState.currentStep = "fetch-pc-to-mar";
        break;
      }

      case "execute-store-1": {
        const storeAddress = Number.parseInt(cir?.split(" ")[1] || "0");
        
        // First set MAR with the address
        nextState.mar = storeAddress;
        busActivity = null;
        activeElement = "mar";
        
        nextState.currentStep = "execute-store-2";
        break;
      }

      case "execute-store-2":
        // Then set MDR with ACC value
        nextState.mdr = acc.toString();
        busActivity = null;
        activeElement = "mdr";
        
        nextState.currentStep = "execute-store-3";
        break;

      case "execute-store-3": {
        const storeAddr = Number.parseInt(cir?.split(" ")[1] || "0");
        // Send address to RAM
        busActivity = {
          type: "address",
          source: "registers",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to write the data to.",
        };
        activeElement = `ram-${storeAddr}`;
        nextState.currentStep = "execute-store-4";
        break;
      }

      case "execute-store-4": {
        const storeAddr2 = Number.parseInt(cir?.split(" ")[1] || "0");
        // Send data to RAM
        ram[storeAddr2] = acc.toString();
        busActivity = {
          type: "data",
          source: "registers",
          destination: "ram",
          purpose: "The data bus is carrying the data value from MDR to be stored at the specified RAM location.",
        };
        
        // Go back to fetch cycle
        nextState.currentStep = "fetch-pc-to-mar";
        break;
      }

      case "execute-halt":
        busActivity = null;
        nextState.isHalted = true;
        break;
    }

    const kind = currentStep === "fetch-increment-pc" ? "increment"
      : currentStep === "decode" ? "decode"
      : currentStep === "execute-halt" ? "halt" : "transfer";
    if (!activeElement) activeElement = busActivity?.destination === "ram" ? `ram-${mar}` : "cir";
    const sourceElement = busActivity ? (busActivity.source === "ram" ? `ram-${mar}`
      : busActivity.type === "address" ? "mar" : "mdr")
      : currentStep === "fetch-pc-to-mar" ? "pc"
      : currentStep === "fetch-mdr-to-cir" ? "mdr"
      : currentStep === "execute-store-2" ? "acc"
      : currentStep.endsWith("-1") ? "cir" : activeElement;
    let value = nextState[activeElement];
    if (busActivity?.type === "address") value = mar;
    else if (busActivity?.type === "data") value = busActivity.source === "ram" ? nextState.mdr : mdr;
    else if (busActivity?.type === "control") value = currentStep === "execute-add-4" ? "ADD" : "LOAD";
    else if (kind === "increment") value = "+1";
    else if (kind === "decode") value = cir?.split(" ")[0];
    else if (kind === "halt") value = "HALT";
    return { nextState, busActivity, activeElement, sourceElement,
      animation: { kind, source: sourceElement, destination: activeElement, value },
      duration: currentStep === "fetch-pc-to-mar" ? 2000 : 1000 };
  }

  const nextStep = () => {
    if (isHalted || isExecutingStep) return;
    playbackRef.current = {
      from: timelinePosition,
      target: (stepIndex + 1) * 1000,
      duration: step.duration,
      startedAt: performance.now(),
    };
    setIsExecutingStep(true);
  };

  const scrubStep = (event) => {
    setIsExecutingStep(false);
    setTimelinePosition(Number(event.currentTarget.value));
  };

  useEffect(() => {
    if (!isExecutingStep) return;
    const { from, target, duration, startedAt } = playbackRef.current;
    let frame;
    const tick = (now) => {
      const position = Math.min(target, from + (now - startedAt) / duration * 1000);
      setTimelinePosition(position);
      if (position === target) {
        setIsExecutingStep(false);
      } else {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isExecutingStep]);

  return (
    <div ref={diagramRef} className="relative space-y-6 mt-8">
      <div className="bg-[#eaecf0] text-gray-950 p-4 rounded-t-lg text-center text-xl !mb-0">
        <div>{getCurrentCycleName(currentStep)} → {getStepDescription(currentStep)}</div>
      </div>

      <div className="bg-gray-100 p-4 rounded-b-lg text-gray-800">
        <p>{getStepExplanation(currentStep)}</p>
      </div>

      <div className="simulation-timeline" style={{ "--timeline-progress": `${timelinePosition / timelineEnd * 100}%` }}>
        <div className="simulation-timeline-track" aria-hidden="true">
          {timeline.map((entry, index) => (
            <span
              key={index}
              className="simulation-timeline-dot"
              style={{
                left: `${(index + 0.5) / timeline.length * 100}%`,
                background: timelinePosition >= (index + 0.5) * 1000 ? "#ffffff66" : undefined,
              }}
            />
          ))}
        </div>
        <input
          id="step-progress"
          aria-label="Simulation progress"
          type="range"
          min="0"
          max={timelineEnd}
          step="1"
          value={Math.round(timelinePosition)}
          onPointerDown={() => setIsExecutingStep(false)}
          onChange={scrubStep}
          aria-valuetext={`Step ${stepIndex + 1} of ${timeline.length}, ${Math.round(stepProgress * 100)}%: ${getStepDescription(currentStep)}`}
          className="simulation-timeline-input"
        />
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

      <div className="flex flex-row gap-4 justify-center items-center h-full w-full mt-8">
        {/* CPU */}
        <div className={`bg-[#CCCCCC] p-4 rounded-2xl flex flex-col gap-4 w-[20rem] h-[27.5rem] relative ${
          activeElement === "pc" || activeElement === "mar" || activeElement === "mdr" || activeElement === "cir" || activeElement === "acc" 
            ? "ring-2 ring-yellow-400" 
            : ""
        }`}>
          {/* Header */}
          <div className="bg-[#669C51] p-2 flex flex-row justify-between items-center rounded-xl pb-6 pt-2">
            <span className="font-semibold text-white text-lg leading-tight tracking-[0.02em]">Central Processing<br/>Unit (CPU)</span>
            <div className="flex flex-row items-end justify-end h-full -mb-10">
              <div className="grid grid-cols-2 grid-rows-2 w-8 h-8">
                <div className="w-3 h-3 bg-[#D9BE52] rounded-full col-start-2 row-start-1 justify-self-center self-center"></div>
                <div className="w-3 h-3 bg-[#D9BE52] rounded-full col-start-1 row-start-2 justify-self-center self-center"></div>
                <div className="w-3 h-3 bg-[#D9BE52] rounded-full col-start-2 row-start-2 justify-self-center self-center"></div>
              </div>
            </div>
          </div>

          {/* CPU Registers */}
          <div data-simulation-port="registers" className="bg-white p-[1.15rem] pt-3 flex flex-col justify-between items-center rounded-xl gap-1.5 z-20">
            <span className="font-bold text-black text-md leading-snug tracking-[0.02em] text-center w-full mb-1">Registers</span>
            <div className={`flex flex-row w-full h-full ${activeElement === "pc" ? "ring-2 ring-yellow-400" : ""}`} style={activityStyle("pc")}>
              <span className="bg-[#00D2C0] text-[#003837] w-3/12 h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">PC</span>
              <span data-simulation-node="pc" className="bg-[#E6E6E6] w-9/12 h-8 py-1 px-2 flex items-center justify-start text-sm"><AnimatedValue before={pc} after={step.nextState.pc} progress={stepProgress} /></span>
            </div>
            <div className={`flex flex-row w-full h-full ${activeElement === "mar" ? "ring-2 ring-yellow-400" : ""}`} style={activityStyle("mar")}>
              <span className="bg-[#00D2C0] text-[#003837] w-3/12 h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">MAR</span>
              <span data-simulation-node="mar" className="bg-[#E6E6E6] w-9/12 h-8 py-1 px-2 flex items-center justify-start text-sm">
                <AnimatedValue before={mar} after={step.nextState.mar} progress={stepProgress} />
              </span>
            </div>
            <div className={`flex flex-row w-full h-full ${activeElement === "mdr" ? "ring-2 ring-yellow-400" : ""}`} style={activityStyle("mdr")}>
              <span className="bg-[#00D2C0] text-[#003837] w-3/12 h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">MDR</span>
              <span data-simulation-node="mdr" className="bg-[#E6E6E6] w-9/12 h-8 py-1 px-2 flex items-center justify-start text-sm">
                <AnimatedValue before={mdr} after={step.nextState.mdr} progress={stepProgress} />
              </span>
            </div>
          </div>

          <div className="flex flex-row gap-2">
            {/* Control unit */}
            <div data-simulation-port="cu" className={`bg-[#af8541] p-[1.15rem] py-5 flex flex-col justify-between items-center rounded-xl gap-1 h-32 w-[8.5rem] z-20 ${
              activeElement === "cir" ? "ring-2 ring-yellow-400" : ""
            }`}>
              <span className="font-bold text-white text-md leading-snug tracking-[0.02em] text-center w-full">Control Unit</span>
              <div className="flex flex-col w-full h-full">
                <span className="bg-[#FFC15E] text-[#382600] w-full h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">CIR</span>
                <span data-simulation-node="cir" className="bg-[#E6E6E6] w-full h-8 py-1 px-2 flex items-center justify-start text-sm">
                  <AnimatedValue before={cir} after={step.nextState.cir} progress={stepProgress} />
                </span>
              </div>
            </div>

            {/* ALU Register */}
            <div data-simulation-port="alu" className={`bg-black p-[1.15rem] py-5 flex flex-col justify-between items-center rounded-xl gap-1 h-32 w-[7rem] z-20 ${
              activeElement === "acc" ? "ring-2 ring-yellow-400" : ""
            }`}>
              <span className="font-bold text-white text-md leading-snug tracking-[0.02em] text-left w-full">ALU</span>
              <div className="flex flex-col w-full h-full">
                <span className="bg-[#4691E0] text-[#001938] w-full h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">ACC</span>
                <span data-simulation-node="acc" className="bg-[#2C2E32] text-white w-full h-8 py-1 px-2 flex items-center justify-start text-sm"><AnimatedValue before={acc} after={step.nextState.acc} progress={stepProgress} /></span>
              </div>
            </div>
          </div>

        </div>

        {/* RAM */}
        <div data-simulation-port="ram" className={`bg-[#009B99] p-4 rounded-2xl flex flex-col w-[20rem] h-[27.5em] relative ${
          activeElement && activeElement.startsWith("ram-") ? "ring-2 ring-yellow-400" : ""
        }`}>
          {/* Header */}
          <div className="bg-[#00D2C0] p-2 flex flex-row justify-between items-center rounded-t-xl pb-6 pt-2">
            <span className="font-semibold text-white text-lg leading-tight tracking-[0.02em]">Random Access<br/>Memory (RAM)</span>
            <div className="flex flex-row items-end justify-end h-full -mb-10">
              <div className="grid grid-cols-2 grid-rows-2 w-8 h-8">
                <div className="w-3 h-3 bg-[#009B99] rounded-full col-start-2 row-start-1 justify-self-center self-center"></div>
                <div className="w-3 h-3 bg-[#009B99] rounded-full col-start-1 row-start-2 justify-self-center self-center"></div>
                <div className="w-3 h-3 bg-[#009B99] rounded-full col-start-2 row-start-2 justify-self-center self-center"></div>
              </div>
            </div>
          </div>

          {/* RAM Slots */}
          <div className="bg-white p-[1.15rem] pt-3 flex flex-col justify-between items-center rounded-b-xl gap-1.5 h-full overflow-auto z-20">
            {ram.map((content, index) => (
              <div 
                key={index} 
                className={`flex flex-row w-full h-full ${activeElement === `ram-${index}` ? "ring-2 ring-yellow-400" : ""}`}
                style={activityStyle(`ram-${index}`)}
              >
                <span className="bg-[#00D2C0] text-[#003837] w-3/12 h-7 py-1 px-2 flex items-center justify-center font-bold text-sm">{index}</span>
                <span data-simulation-node={`ram-${index}`} className="bg-[#E6E6E6] w-9/12 h-7 py-1 px-2 flex items-center justify-start text-sm">
                  <AnimatedValue before={content} after={step.nextState.ram[index]} progress={stepProgress} />
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Bus Animation Component */}
      <BusAnimation busActivity={busActivity} step={step} progress={stepProgress} diagramRef={diagramRef} />

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
