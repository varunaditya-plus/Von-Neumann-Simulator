import React, { useState, useEffect } from "react";
import { Bus } from "lucide-react";
import { useSpring, animated } from "@react-spring/web";

export function BusAnimation({ busActivity }) {
  const [animationInProgress, setAnimationInProgress] = useState(false);

  const [springProps, api] = useSpring(() => ({
    from: { left: "15%", top: "0%", opacity: 0 },
    config: { duration: 300 }
  }));

  // Get position based on component name
  const getPosition = (component) => {
    console.log(`ts ${component} pmo`);
    switch (component) {
      case "cu": return "29.5%";
      case "cir": return "29.5%";
      case "registers": return "45%";
      case "pc": return "45%";
      case "mar": return "45%";
      case "mdr": return "45%";
      case "alu": return "34.5%";
      case "acc": return "34.5%";
      case "ram": return "66.3%";
      default: return "29.5%";
    }
  };

  // Get color based on bus type
  const getBusColor = (type) => {
    switch (type) {
      case "address": return "bg-blue-500";
      case "data": return "bg-red-500";
      case "control": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  // Check if the bus is actually moving between parts
  const isBusMoving = (source, destination) => {
    return source !== destination;
  };

  // Create animation path from source to destination
  const createAnimationPath = (source, destination) => {
    const sourcePos = getPosition(source);
    const destPos = getPosition(destination);
    
    // Special for registers as the connector line is longer
    if (source === "registers" || destination === "registers") {
      if (source === "registers") {
        return [
          { left: sourcePos, top: "-410%" }, // Start (up)
          { left: sourcePos, top: "0%" }, // Go down to bus line
          { left: destPos, top: "0%" }, // Move horizontally
          { left: destPos, top: "-110%" } // Go up
        ];
      } else if (destination === "registers") {
        return [
          { left: sourcePos, top: "-110%" }, // Start at source
          { left: sourcePos, top: "0%" }, // Go down to bus line
          { left: destPos, top: "0%" }, // Move horizontally
          { left: destPos, top: "-410%" } // Go up (to registers)
        ];
      }
    }
    
    // Default path for components: Down, horizontal, up
    return [
      { left: sourcePos, top: "0%" }, // Start from source
      { left: sourcePos, top: "-50%" }, // Go down to the bus line
      { left: destPos, top: "-50%" }, // Move horizontally along the bus
      { left: destPos, top: "0%" } // Go UP to destination
    ];
  };

  useEffect(() => {
    // Reset animation when busActivity changes
    if (busActivity === null) {
      setAnimationInProgress(false);
      return;
    }

    if (busActivity && !animationInProgress) {
      if (isBusMoving(busActivity.source, busActivity.destination)) {
        // Create the animation path
        const path = createAnimationPath(busActivity.source, busActivity.destination);
        
        setAnimationInProgress(true);
        
        // Start the animation sequence
        api.set({ ...path[0], opacity: 0 });
        setTimeout(() => {
          animateAlongPath(path, 0);
        }, 50);
      }
    }
  }, [busActivity]);

  const animateAlongPath = (path, index) => {
    if (index >= path.length) {
      // Animation complete
      setTimeout(() => {
        api.start({ opacity: 0 });
        setAnimationInProgress(false);
      }, 200);
      return;
    }

    api.start({
      ...path[index],
      opacity: 1,
      onRest: () => {
        setTimeout(() => {
          animateAlongPath(path, index + 1);
        }, 50);
      }
    });
  };

  return (
    <div className="relative h-12 mt-4 w-full">
      {/* Bus Line */}
      <div className="w-[41rem] h-3 bg-[#A8AAAF] rounded-full mx-auto"></div>

      {/* Vertical Connectors */}
      <div className="absolute w-3 h-12 bg-[#8e6e3a] left-[29.5%] top-0" style={{transform: 'translateY(-100%)'}}></div> {/* CU */}
      <div className="absolute w-3 h-48 bg-[#ebeced] left-[45%] top-0" style={{transform: 'translateY(-100%)'}}></div> {/* Registers */}
      <div className="absolute w-3 h-12 bg-[#CBE6E3] left-[66.3%] top-0 transform" style={{transform: 'translateY(-100%)'}}></div> {/* RAM */}
      <div className="absolute w-3 h-12 bg-[#37383A] left-[34.5%] top-0" style={{transform: 'translateY(-100%)'}}></div> {/* ALU */}

      {/* Bus Animation */}
      {busActivity && isBusMoving(busActivity.source, busActivity.destination) && (
        <animated.div
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={springProps}
        >
          <Bus 
            size={20} 
            className={`${busActivity ? getBusColor(busActivity.type) : "text-gray-500"} p-1 rounded-lg ml-2`}
            color="white"
          />
        </animated.div>
      )}
    </div>
  );
}