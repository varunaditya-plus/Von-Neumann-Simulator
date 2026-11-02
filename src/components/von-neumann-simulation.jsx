import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { BusAnimation } from "./bus-animation";
import { AnimatedValue } from "./animated-value";
import { Bus, Rows3 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { getCurrentCycleName } from "../utils/getCycleName";
import { getStepDescription } from "../utils/getStepDescription";
import { getStepExplanation } from "../utils/getStepExplanation";


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

export function VonNeumannSimulation({ isIB = false }) {
  const [isExecutingStep, setIsExecutingStep] = useState(false); // Track if a step is currently being executed

  // Build snapshots once so scrubbing never applies an instruction twice.
  const [timeline] = useState(() => {
    const steps = [];
    let state = {
      pc: 0,
      mar: null,
      mdr: null,
      cir: null,
      acc: 0,
      currentStep: "fetch-pc-to-mar",
      isHalted: false,
      ram: initialRam,
    };

    while (!state.isHalted) {
      const step = getSimulationStep(state);
      steps.push({ state, ...step });
      state = step.nextState;
    }
    return steps;
  });

  const busActivities = useMemo(() => [...new Map(
    timeline
      .filter(({ busActivity }) => busActivity)
      .map(({ busActivity }) => [busActivity.purpose, busActivity]),
  ).values()], [timeline]);

  const [timing, setTiming] = useState(() => ({
    position: 0,
    durations: timeline.map(() => 1000),
  }));

  const timelinePosition = timing.position;
  const setTimelinePosition = (position) => setTiming(current => ({ ...current, position }));
  const stepOffsets = useMemo(() => {
    const offsets = [0];
    timing.durations.forEach(duration => offsets.push(offsets.at(-1) + duration));
    return offsets;
  }, [timing.durations]);

  const stepIndex = Math.min(
    stepOffsets.filter(offset => offset <= timelinePosition).length - 1,
    timeline.length - 1,
  );
  const stepDuration = timing.durations[stepIndex];
  const stepProgress = (timelinePosition - stepOffsets[stepIndex]) / stepDuration;
  const step = timeline[stepIndex];
  const { pc, mar, mdr, cir, acc, ram, currentStep } = step.state;
  const stepDescription = getStepDescription(currentStep, isIB);
  const isHalted = stepProgress === 1 && step.nextState.isHalted;
  const { busActivity } = step;
  const activeElement = stepProgress === 0 ? null
    : stepProgress < 0.5 ? step.animation.source : step.animation.destination;
  const playbackRef = useRef(null);
  const diagramRef = useRef(null);

  const activityStyle = (element) => {
    const source = element === step.animation.source ? Math.sin(Math.PI * Math.min(1, stepProgress / 0.65)) : 0;
    const destination = element === step.animation.destination ? Math.sin(Math.PI * Math.max(0, (stepProgress - 0.35) / 0.65)) : 0;
    const intensity = Math.max(source, destination);
    return { boxShadow: `0 0 0 ${3 * intensity}px rgba(250, 204, 21, ${intensity})` };
  };

  const onPathLengths = useCallback((lengths) => {
    // 350 pixels per second, with the same 80 ms lead-in and 180 ms arrival for every step.
    const durations = lengths.map(length => Math.round(260 + length / 350 * 1000));

    setTiming(current => {
      if (durations.every((duration, index) => duration === current.durations[index])) return current;

      // Preserve the step and its progress when a resize changes path lengths.
      let index = 0;
      let remaining = current.position;

      while (index < current.durations.length - 1 && remaining >= current.durations[index]) {
        remaining -= current.durations[index++];
      }

      const progress = remaining / current.durations[index];
      const position = durations.slice(0, index).reduce((sum, duration) => sum + duration, 0)
        + progress * durations[index];

      return { position, durations };
    });
  }, []);

  useEffect(() => {
    setIsExecutingStep(false);
  }, [timing.durations]);

  const resetSimulation = () => {
    setTimelinePosition(0);
    setIsExecutingStep(false);
  };

  // Keep a start and end snapshot for each step so dragging can reverse it.
  function getSimulationStep(state) {
    const { pc, mar, mdr, cir, acc, currentStep } = state;
    const ram = state.ram;
    const nextState = { ...state };
    let busActivity = null;
    let activeElement = null;

    switch (currentStep) {
      case "fetch-pc-to-mar":
        // PC to MAR
        nextState.mar = pc;
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
        nextState.currentStep = isIB ? "fetch-cu-read" : "fetch-ram-to-mdr";
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
        nextState.cir = mdr;
        activeElement = "cir";
        nextState.currentStep = "fetch-increment-pc";
        break;

      case "fetch-increment-pc":
        // Increment PC
        nextState.pc = pc + 1;
        activeElement = "pc";
        nextState.currentStep = "decode";
        break;

      case "decode":
        // Decode instruction
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
        activeElement = "mar";
        
        nextState.currentStep = "execute-load-2";
        break;
      }

      case "execute-load-2":
        // Then fetch from RAM using address bus
        busActivity = {
          type: "address",
          source: "registers",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read the data from.",
        };
        activeElement = `ram-${mar}`;
        nextState.currentStep = isIB ? "execute-load-read" : "execute-load-3";
        break;

      case "execute-load-3":
        // Then get data back via data bus
        nextState.mdr = ram[mar];
        busActivity = {
          type: "data",
          source: "ram",
          destination: "registers",
          purpose:
            "The data bus is carrying the data value from RAM back to the Memory Data Register (MDR) in the CPU.",
        };
        activeElement = "mdr";
        
        nextState.currentStep = isIB ? "execute-load-control" : "execute-load-4";
        break;

      case "execute-load-4":
        // Finally update ACC
        nextState.acc = Number.parseInt(mdr);
        busActivity = isIB ? null : {
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

      case "execute-add-1": {
        const addAddress = Number.parseInt(cir?.split(" ")[1] || "0");
        
        // First set MAR with the address
        nextState.mar = addAddress;
        activeElement = "mar";
        
        nextState.currentStep = "execute-add-2";
        break;
      }

      case "execute-add-2":
        // Then fetch from RAM using address bus
        busActivity = {
          type: "address",
          source: "registers",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to read the data from for addition.",
        };
        activeElement = `ram-${mar}`;
        nextState.currentStep = isIB ? "execute-add-read" : "execute-add-3";
        break;

      case "execute-add-3":
        // Then get data back via data bus
        nextState.mdr = ram[mar];
        busActivity = {
          type: "data",
          source: "ram",
          destination: "registers",
          purpose:
            "The data bus is carrying the data value from RAM back to the Memory Data Register (MDR) in the CPU for the addition operation.",
        };
        activeElement = "mdr";
        
        nextState.currentStep = isIB ? "execute-add-control" : "execute-add-4";
        break;

      case "execute-add-4":
        // Finally update ACC with addition
        nextState.acc = acc + Number.parseInt(mdr);
        busActivity = isIB ? null : {
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

      case "execute-store-1": {
        const storeAddress = Number.parseInt(cir?.split(" ")[1] || "0");
        
        // First set MAR with the address
        nextState.mar = storeAddress;
        activeElement = "mar";
        
        nextState.currentStep = "execute-store-2";
        break;
      }

      case "execute-store-2":
        // Then set MDR with ACC value
        nextState.mdr = acc.toString();
        activeElement = "mdr";
        
        nextState.currentStep = "execute-store-3";
        break;

      case "execute-store-3":
        // Send address to RAM
        busActivity = {
          type: "address",
          source: "registers",
          destination: "ram",
          purpose:
            "The address bus is carrying the memory address from MAR to RAM to specify which memory location to write the data to.",
        };
        activeElement = `ram-${mar}`;
        nextState.currentStep = isIB ? "execute-store-write" : "execute-store-4";
        break;

      case "execute-store-4":
        // Send data to RAM
        nextState.ram = ram.map((value, index) => index === mar ? mdr : value);
        busActivity = {
          type: "data",
          source: "registers",
          destination: "ram",
          purpose: "The data bus is carrying the data value from MDR to be stored at the specified RAM location.",
        };
        
        // Go back to fetch cycle
        nextState.currentStep = "fetch-pc-to-mar";
        break;

      case "fetch-cu-read":
      case "execute-load-read":
      case "execute-add-read":
      case "execute-store-write": {
        const writing = currentStep === "execute-store-write";

        busActivity = {
          type: "control",
          source: "cu",
          destination: "ram",
          signal: writing ? "WRITE" : "READ",
          purpose: writing
            ? "The CU sends a WRITE signal on the control bus. RAM stores the data arriving on the data bus at the address supplied by MAR."
            : "The CU sends a READ signal on the control bus. RAM returns the contents of the address supplied by MAR on the data bus.",
        };
        activeElement = `ram-${mar}`;
        nextState.currentStep = currentStep === "fetch-cu-read" ? "fetch-ram-to-mdr"
          : writing ? "execute-store-4" : currentStep.replace("-read", "-3");
        break;
      }

      case "execute-load-control":
      case "execute-add-control":
        busActivity = {
          type: "control",
          source: "cu",
          destination: "alu",
          signal: cir.split(" ")[0],
          purpose: "The CU sends control signals to the ALU to select the operation. The operand is transferred separately from MDR; it is not carried by the control bus.",
        };
        activeElement = "acc";
        nextState.currentStep = currentStep.replace("-control", "-4");
        break;

      case "execute-halt":
        nextState.isHalted = true;
        break;
    }

    const kind = currentStep === "fetch-increment-pc" ? "increment"
      : currentStep === "decode" ? "decode"
      : currentStep === "execute-halt" ? "halt" : "transfer";

    if (!activeElement) activeElement = busActivity?.destination === "ram" ? `ram-${mar}` : "cir";

    // Control signals start in the CU; operand values travel separately from MDR.
    const sourceElement = busActivity
      ? (busActivity.source === "ram" ? `ram-${mar}`
        : busActivity.source === "cu" ? "cir"
        : busActivity.type === "address" ? "mar" : "mdr")
      : currentStep === "fetch-pc-to-mar" ? "pc"
      : currentStep === "fetch-mdr-to-cir" || currentStep === "execute-load-4" || currentStep === "execute-add-4" ? "mdr"
      : currentStep === "execute-store-2" ? "acc"
      : currentStep.endsWith("-1") ? "cir" : activeElement;

    let value = nextState[activeElement];

    if (busActivity?.type === "address") value = mar;
    else if (busActivity?.type === "data") value = busActivity.source === "ram" ? nextState.mdr : mdr;
    else if (busActivity?.type === "control") value = busActivity.signal || (currentStep === "execute-add-4" ? "ADD" : "LOAD");
    else if (kind === "increment") value = "+1";
    else if (kind === "decode") value = cir?.split(" ")[0];
    else if (kind === "halt") value = "HALT";
    else if (isIB && (currentStep === "execute-load-4" || currentStep === "execute-add-4")) value = mdr;

    return {
      nextState,
      busActivity,
      animation: { kind, source: sourceElement, destination: activeElement, value },
    };
  }

  const nextStep = () => {
    if (isHalted || isExecutingStep) return;

    playbackRef.current = {
      from: timelinePosition,
      target: stepOffsets[stepIndex + 1],
      startedAt: performance.now(),
    };

    setIsExecutingStep(true);
  };

  const scrubStep = (event) => {
    setIsExecutingStep(false);
    // Each slider stop selects the start snapshot of one step.
    setTimelinePosition(stepOffsets[Number(event.currentTarget.value)]);
  };

  useEffect(() => {
    if (!isExecutingStep) return;

    const { from, target, startedAt } = playbackRef.current;
    let frame;

    const tick = (now) => {
      const position = Math.min(target, from + (now - startedAt));
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
      <div className="relative bg-[#eaecf0] text-gray-950 p-4 rounded-t-lg text-center text-xl !mb-0">
        <a
          href={isIB ? "/" : "/ib"}
          aria-label={isIB ? "Switch to IGCSE" : "Switch to IB"}
          className="absolute bottom-full right-0 z-50 mb-1 origin-bottom-right text-xs text-blue-600 underline transition-transform duration-200 ease-in-out hover:scale-110 hover:rotate-[5deg]"
        >
          {isIB ? "IGCSE" : "IB"}
        </a>
        <div>{getCurrentCycleName(currentStep)} → {stepDescription}</div>
      </div>

      <div className="bg-gray-100 p-4 rounded-b-lg text-gray-800">
        <p>{getStepExplanation(currentStep, isIB)}</p>
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
                  <h3 className="font-bold">{isIB ? "Instruction Register (IR)" : "Current Instruction Register (CIR)"}</h3>
                </div>
                <p className="text-gray-700 pl-8">
                  The {isIB ? "IR" : "CIR"} holds the instruction currently being executed. After an instruction is fetched from memory,
                  it is stored here while being decoded and executed by the control unit.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-yellow-500 mr-2"></div>
                  <h3 className="font-bold">Accumulator ({isIB ? "AC" : "ACC"})</h3>
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
            <div className="flex flex-row w-full h-full" style={activityStyle("pc")}>
              <span className="bg-[#00D2C0] text-[#003837] w-3/12 h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">PC</span>
              <span data-simulation-node="pc" className="bg-[#E6E6E6] w-9/12 h-8 py-1 px-2 flex items-center justify-start text-sm">
                <AnimatedValue before={pc} after={step.nextState.pc} progress={stepProgress} duration={stepDuration} />
              </span>
            </div>
            <div className="flex flex-row w-full h-full" style={activityStyle("mar")}>
              <span className="bg-[#00D2C0] text-[#003837] w-3/12 h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">MAR</span>
              <span data-simulation-node="mar" className="bg-[#E6E6E6] w-9/12 h-8 py-1 px-2 flex items-center justify-start text-sm">
                <AnimatedValue before={mar} after={step.nextState.mar} progress={stepProgress} duration={stepDuration} />
              </span>
            </div>
            <div className="flex flex-row w-full h-full" style={activityStyle("mdr")}>
              <span className="bg-[#00D2C0] text-[#003837] w-3/12 h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">MDR</span>
              <span data-simulation-node="mdr" className="bg-[#E6E6E6] w-9/12 h-8 py-1 px-2 flex items-center justify-start text-sm">
                <AnimatedValue before={mdr} after={step.nextState.mdr} progress={stepProgress} duration={stepDuration} />
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
                <span className="bg-[#FFC15E] text-[#382600] w-full h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">{isIB ? "IR" : "CIR"}</span>
                <span data-simulation-node="cir" className="bg-[#E6E6E6] w-full h-8 py-1 px-2 flex items-center justify-start text-sm">
                  <AnimatedValue before={cir} after={step.nextState.cir} progress={stepProgress} duration={stepDuration} />
                </span>
              </div>
            </div>

            {/* ALU Register */}
            <div data-simulation-port="alu" className={`bg-black p-[1.15rem] py-5 flex flex-col justify-between items-center rounded-xl gap-1 h-32 w-[7rem] z-20 ${
              activeElement === "acc" ? "ring-2 ring-yellow-400" : ""
            }`}>
              <span className="font-bold text-white text-md leading-snug tracking-[0.02em] text-left w-full">ALU</span>
              <div className="flex flex-col w-full h-full">
                <span className="bg-[#4691E0] text-[#001938] w-full h-8 py-1 px-2 flex items-center justify-center font-bold text-sm">{isIB ? "AC" : "ACC"}</span>
                <span data-simulation-node="acc" className="bg-[#2C2E32] text-white w-full h-8 py-1 px-2 flex items-center justify-start text-sm">
                  <AnimatedValue before={acc} after={step.nextState.acc} progress={stepProgress} duration={stepDuration} />
                </span>
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
                className="flex flex-row w-full h-full"
                style={activityStyle(`ram-${index}`)}
              >
                <span className="bg-[#00D2C0] text-[#003837] w-3/12 h-7 py-1 px-2 flex items-center justify-center font-bold text-sm">{index}</span>
                <span data-simulation-node={`ram-${index}`} className="bg-[#E6E6E6] w-9/12 h-7 py-1 px-2 flex items-center justify-start text-sm">
                  <AnimatedValue before={content} after={step.nextState.ram[index]} progress={stepProgress} duration={stepDuration} />
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Bus Animation Component */}
      <BusAnimation
        stepIndex={stepIndex}
        progress={stepProgress}
        duration={stepDuration}
        diagramRef={diagramRef}
        timeline={timeline}
        onPathLengths={onPathLengths}
      />

      {/* Hidden statuses share one grid cell to reserve the tallest wrapped message. */}
      <div className="grid mb-4 -mt-6 text-sm">
        {busActivities.map(activity => (
          <div
            key={activity.purpose}
            aria-hidden={busActivity?.purpose !== activity.purpose}
            className={`col-start-1 row-start-1 flex items-center justify-center ${busActivity?.purpose === activity.purpose ? "" : "invisible"}`}
          >
            <div className={`w-3 h-3 rounded-full mr-2 ${
              activity.type === "address"
                ? "bg-blue-500"
                : activity.type === "data"
                  ? "bg-red-500"
                  : "bg-green-500"
            }`}
            ></div>
            <p className="text-gray-700">{activity.purpose}</p>
          </div>
        ))}
      </div>

      <div className="relative h-8" style={{ "--timeline-progress": `${stepIndex / (timeline.length - 1) * 100}%` }}>
        <div className="pointer-events-none absolute inset-x-3.5 inset-y-1 rounded-full bg-linear-to-r from-[#3478f6] from-[percentage:var(--timeline-progress)] to-[#efefef] to-[percentage:var(--timeline-progress)]" aria-hidden="true">
          {timeline.map((entry, index) => (
            <span
              key={index}
              className={`absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${index <= stepIndex ? "bg-white/40" : "bg-[#a0a0a0]"}`}
              style={{
                left: `${index / (timeline.length - 1) * 100}%`,
              }}
            />
          ))}
        </div>
        <input
          id="step-progress"
          aria-label="Simulation progress"
          type="range"
          min="0"
          max={timeline.length - 1}
          step="1"
          value={stepIndex}
          onPointerDown={() => setIsExecutingStep(false)}
          onChange={scrubStep}
          aria-valuetext={`Step ${stepIndex + 1} of ${timeline.length}, ${Math.round(stepProgress * 100)}%: ${stepDescription}`}
          className="absolute inset-0 m-0 h-8 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-runnable-track]:h-6 [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-moz-range-track]:h-6 [&::-moz-range-track]:bg-transparent
            [&::-webkit-slider-thumb]:-mt-0.5 [&::-webkit-slider-thumb]:size-7
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#dedede] [&::-webkit-slider-thumb]:bg-white
            [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[#dedede] [&::-moz-range-thumb]:bg-white
            focus-visible:rounded-full focus-visible:outline-2 focus-visible:outline-solid
            focus-visible:outline-[#3478f6] focus-visible:outline-offset-[3px]"
        />
      </div>

    </div>
  );
}
