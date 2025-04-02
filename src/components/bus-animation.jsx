import React, { useState, useEffect } from "react";
import { Bus } from "lucide-react";

export function BusAnimation({ busActivity }) {
  const [dotPosition, setDotPosition] = useState({ left: "15%", top: "0%" });
  const [dotVisible, setDotVisible] = useState(false);
  const [animationInProgress, setAnimationInProgress] = useState(false);
  const [animationPath, setAnimationPath] = useState([]);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);

  // Get position based on component name
  const getPosition = (component) => {
    switch (component) {
      case "cu":
        return "15%";
      case "ram":
        return "50%";
      case "alu":
        return "85%";
      default:
        return "15%";
    }
  };

  // Get color based on bus type
  const getBusColor = (type) => {
    switch (type) {
      case "address":
        return "bg-blue-500";
      case "data":
        return "bg-red-500";
      case "control":
        return "bg-green-500";
      default:
        return "bg-gray-500";
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
    
    return [
      { left: sourcePos, top: "0%" },
      { left: sourcePos, top: "50%" },
      { left: destPos, top: "50%" },
      { left: destPos, top: "0%" }
    ];
  };

  useEffect(() => {
    // Reset animation when busActivity changes
    if (busActivity === null) {
      setDotVisible(false);
      setAnimationInProgress(false);
      setCurrentPathIndex(0);
      return;
    }

    if (busActivity && !animationInProgress) {
      if (isBusMoving(busActivity.source, busActivity.destination)) {
        // Create the animation path
        const path = createAnimationPath(busActivity.source, busActivity.destination);
        setAnimationPath(path);
        
        setAnimationInProgress(true);
        setCurrentPathIndex(0);
        setDotPosition(path[0]);
        setDotVisible(true);
        
        // Start the animation sequence
        animateAlongPath(path, 0);
      }
    }
  }, [busActivity]);

  const animateAlongPath = (path, index) => {
    if (index >= path.length) {
      // Animation complete
      setTimeout(() => {
        setDotVisible(false);
        setAnimationInProgress(false);
      }, 200);
      return;
    }

    setDotPosition(path[index]);
    setCurrentPathIndex(index);
    
    setTimeout(() => {
      animateAlongPath(path, index + 1);
    }, 300);
  };

  return (
    <div className="w-full h-full relative">
      <div className="absolute left-0 right-0 h-2 bg-gray-700 top-1/2 transform -translate-y-1/2"></div>

      <div className="absolute w-2 h-12 bg-gray-700 left-[15%] top-0"></div>
      <div className="absolute w-2 h-12 bg-gray-700 left-[50%] top-0"></div>
      <div className="absolute w-2 h-12 bg-gray-700 left-[85%] top-0"></div>

      {busActivity && isBusMoving(busActivity.source, busActivity.destination) && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{
            left: dotPosition.left,
            top: dotPosition.top,
            opacity: dotVisible ? 1 : 0,
            transition: "left 300ms linear, top 300ms linear"
          }}
        >
          <Bus 
            size={20} 
            className={`${busActivity ? getBusColor(busActivity.type) : "text-gray-500"} p-1 rounded-lg ml-2`}
            color="white"
          />
        </div>
      )}

      <div className="absolute text-xs font-bold left-[15%] top-0 transform -translate-x-1/2 -translate-y-6">
        Control Unit
      </div>
      <div className="absolute text-xs font-bold left-[50%] top-0 transform -translate-x-1/2 -translate-y-6">RAM</div>
      <div className="absolute text-xs font-bold left-[85%] top-0 transform -translate-x-1/2 -translate-y-6">ALU</div>
    </div>
  );
}