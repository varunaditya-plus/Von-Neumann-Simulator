import { useState, useRef, useEffect } from "react";
import { Bus } from "lucide-react";

export function BusAnimation({ busActivity, step, progress, diagramRef }) {
  const railRef = useRef(null);
  const [geometry, setGeometry] = useState(null);
  const animationInProgress = progress > 0 && progress < 1;
  const { animation } = step;

  // Get position based on component name
  const getPosition = (component) => {
    switch (component) {
      case "cu": return geometry?.ports.cu;
      case "cir": return geometry?.ports.cu;
      case "registers": return geometry?.ports.registers;
      case "pc": return geometry?.ports.registers;
      case "mar": return geometry?.ports.registers;
      case "mdr": return geometry?.ports.registers;
      case "alu": return geometry?.ports.alu;
      case "acc": return geometry?.ports.alu;
      case "ram": return geometry?.ports.ram;
      default: return geometry?.ports.cu;
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
    const sourcePos = geometry?.nodes[source];
    const destPos = geometry?.nodes[destination];
    if (!sourcePos || !destPos) return null;

    if (busActivity && isBusMoving(busActivity.source, busActivity.destination)) {
      const from = getPosition(busActivity.source);
      const to = getPosition(busActivity.destination);
      return [
        sourcePos,
        { x: from.x, y: sourcePos.y },
        { x: from.x, y: geometry.rail.y }, // Go down to bus line
        { x: to.x, y: geometry.rail.y }, // Move horizontally
        { x: to.x, y: destPos.y }, // Go up to the destination
        destPos,
      ];
    }
    if (animation.kind === "increment") {
      return [{ x: sourcePos.x + 36, y: sourcePos.y - 20 }, { x: sourcePos.x + 36, y: sourcePos.y }, sourcePos];
    }
    if (animation.kind === "decode" || animation.kind === "halt") {
      return [{ x: sourcePos.left + 8, y: sourcePos.y }, { x: sourcePos.left + sourcePos.width - 8, y: sourcePos.y }];
    }
    const middleX = (sourcePos.x + destPos.x) / 2;
    return [sourcePos, { x: middleX, y: sourcePos.y }, { x: middleX, y: destPos.y }, destPos];
  };

  useEffect(() => {
    const diagram = diagramRef.current;
    const measure = () => {
      const bounds = diagram.getBoundingClientRect();
      const relativeBox = (element) => {
        const box = element.getBoundingClientRect();
        return { x: box.left - bounds.left + box.width / 2, y: box.top - bounds.top + box.height / 2,
          left: box.left - bounds.left, top: box.top - bounds.top, width: box.width, height: box.height };
      };
      const nodes = Object.fromEntries([...diagram.querySelectorAll("[data-simulation-node]")]
        .map(element => [element.dataset.simulationNode, relativeBox(element)]));
      const ports = Object.fromEntries([...diagram.querySelectorAll("[data-simulation-port]")]
        .map(element => {
          const box = relativeBox(element);
          return [element.dataset.simulationPort, {
            x: element.dataset.simulationPort === "registers" ? box.left + box.width - 6 : box.x,
            y: box.top + box.height,
          }];
        }));
      setGeometry({ nodes, ports, rail: relativeBox(railRef.current) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(diagram);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [diagramRef]);

  const animateAlongPath = (points, progress) => {
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let distance = total * progress;
    for (let index = 0; index < lengths.length; index++) {
      if (distance <= lengths[index]) {
        const fraction = lengths[index] ? distance / lengths[index] : 0;
        return {
          x: points[index].x + (points[index + 1].x - points[index].x) * fraction,
          y: points[index].y + (points[index + 1].y - points[index].y) * fraction,
          total,
        };
      }
      distance -= lengths[index];
    }
    return { ...points[points.length - 1], total };
  };

  const travel = Math.max(0, Math.min(1, (progress - 0.08) / 0.74));
  const opacity = Math.min(1, progress / 0.08, (1 - progress) / 0.08);
  const points = createAnimationPath(animation.source, animation.destination);
  const position = points ? animateAlongPath(points, travel) : null;
  const path = points?.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const color = { address: "#3b82f6", data: "#ef4444", control: "#22c55e" }[busActivity?.type] || "#8b5cf6";
  const connectorStyle = (name) => ({
    transform: "translateY(-100%)",
    ...(geometry && { left: geometry.ports[name].x - 6, top: 6, height: geometry.rail.y - geometry.ports[name].y }),
  });

  return (
    <>
      <div className="relative h-12 mt-4 w-full">
        {/* Bus Line */}
        <div ref={railRef} className="w-[41rem] h-3 bg-[#A8AAAF] rounded-full mx-auto"></div>

        {/* Vertical Connectors */}
        <div className="absolute w-3 h-12 bg-[#8e6e3a] left-[29.5%] top-0" style={connectorStyle("cu")}></div> {/* CU */}
        <div className="absolute w-3 h-48 bg-[#ebeced] left-[45%] top-0" style={connectorStyle("registers")}></div> {/* Registers */}
        <div className="absolute w-3 h-12 bg-[#CBE6E3] left-[66.3%] top-0 transform" style={connectorStyle("ram")}></div> {/* RAM */}
        <div className="absolute w-3 h-12 bg-[#37383A] left-[34.5%] top-0" style={connectorStyle("alu")}></div> {/* ALU */}

      </div>
      {/* Bus Animation */}
      {position && animationInProgress && (
        <div className="absolute inset-0 !m-0 z-30 pointer-events-none">
          <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
            <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
              opacity={opacity * 0.6} strokeDasharray={position.total}
              strokeDashoffset={position.total * (1 - travel)} />
            {animation.kind === "decode" && (
              <rect x={position.x} y={geometry.nodes[animation.source].top} width="3"
                height={geometry.nodes[animation.source].height} fill={color} opacity={opacity * 0.5} />
            )}
          </svg>
          <div role="img" aria-label={busActivity ? `${busActivity.type} bus transfer` : `${animation.kind} animation`}
            className={`absolute z-40 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-white shadow-sm ${busActivity ? getBusColor(busActivity.type) : "bg-violet-500"}`}
            style={{ left: position.x, top: position.y, opacity,
              transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * Math.sin(Math.PI * progress)})` }}>
            {busActivity && <Bus size={18} color="white" />}
            <span>{animation.value}</span>
          </div>
        </div>
      )}
    </>
  );
}
