import React, { useState, useEffect } from "react";

export function BusAnimation({ busActivity }) {
  const [dotPosition, setDotPosition] = useState({ left: "15%", top: "50%" });
  const [dotVisible, setDotVisible] = useState(false);
  const [animationInProgress, setAnimationInProgress] = useState(false);

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

  useEffect(() => {
    if (busActivity && !animationInProgress) {
      if (isBusMoving(busActivity.source, busActivity.destination)) {
        setAnimationInProgress(true);

        // Set initial position
        const startPos = getPosition(busActivity.source);
        setDotPosition({ left: startPos, top: "50%" });
        setDotVisible(true);

        // Use requestAnimationFrame to ensure smooth animation
        requestAnimationFrame(() => {
          setTimeout(() => {
            const endPos = getPosition(busActivity.destination);
            setDotPosition({ left: endPos, top: "50%" });

            // Hide dot after animation completes
            setTimeout(() => {
              setDotVisible(false);
              setAnimationInProgress(false);
            }, 500);
          }, 50);
        });
      }
    }
  }, [busActivity, animationInProgress]);

  return (
    <div className="w-full h-full relative">
      <div className="absolute left-0 right-0 h-2 bg-gray-700 top-1/2 transform -translate-y-1/2"></div>

      <div className="absolute w-2 h-12 bg-gray-700 left-[15%] top-0"></div>
      <div className="absolute w-2 h-12 bg-gray-700 left-[50%] top-0"></div>
      <div className="absolute w-2 h-12 bg-gray-700 left-[85%] top-0"></div>

      {busActivity && isBusMoving(busActivity.source, busActivity.destination) && (
        <div
          className={`absolute w-4 h-4 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ease-in-out ${
            busActivity ? getBusColor(busActivity.type) : "bg-gray-500"
          }`}
          style={{
            left: dotPosition.left,
            top: dotPosition.top,
            opacity: dotVisible ? 1 : 0,
          }}
        ></div>
      )}

      <div className="absolute text-xs font-bold left-[15%] top-0 transform -translate-x-1/2 -translate-y-6">
        Control Unit
      </div>
      <div className="absolute text-xs font-bold left-[50%] top-0 transform -translate-x-1/2 -translate-y-6">RAM</div>
      <div className="absolute text-xs font-bold left-[85%] top-0 transform -translate-x-1/2 -translate-y-6">ALU</div>
    </div>
  );
}