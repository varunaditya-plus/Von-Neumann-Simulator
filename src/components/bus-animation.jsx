import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bus } from "lucide-react";

const busColors = {
  address: { badge: "bg-blue-500", stroke: "#3b82f6" },
  data: { badge: "bg-red-500", stroke: "#ef4444" },
  control: { badge: "bg-green-500", stroke: "#22c55e" },
};

export function BusAnimation({
  stepIndex,
  progress,
  duration,
  diagramRef,
  timeline,
  onPathLengths,
}) {
  const railRef = useRef(null);
  const [geometry, setGeometry] = useState(null);
  const animationInProgress = progress > 0 && progress < 1;
  const { animation, busActivity } = timeline[stepIndex];

  // Create animation path from source to destination
  const createAnimationPath = useCallback((source, destination, activity, kind) => {
    const sourcePos = geometry.nodes[source];
    const destPos = geometry.nodes[destination];

    if (activity) {
      const from = geometry.ports[activity.source];
      const to = geometry.ports[activity.destination];

      return [
        sourcePos,
        { x: from.x, y: sourcePos.y },
        { x: from.x, y: geometry.rail.y }, // Go down to bus line
        { x: to.x, y: geometry.rail.y }, // Move horizontally
        { x: to.x, y: destPos.y }, // Go up to the destination
        destPos,
      ];
    }
    if (kind === "increment") {
      return [
        { x: sourcePos.x + 36, y: sourcePos.y - 20 },
        { x: sourcePos.x + 36, y: sourcePos.y },
        sourcePos,
      ];
    }

    if (kind === "decode" || kind === "halt") {
      return [
        { x: sourcePos.left + 8, y: sourcePos.y },
        { x: sourcePos.left + sourcePos.width - 8, y: sourcePos.y },
      ];
    }

    const middleX = (sourcePos.x + destPos.x) / 2;

    return [
      sourcePos,
      { x: middleX, y: sourcePos.y },
      { x: middleX, y: destPos.y },
      destPos,
    ];
  }, [geometry]);

  useEffect(() => {
    const diagram = diagramRef.current;

    // Use diagram-relative coordinates so overlays stay aligned after resizing.
    const measure = () => {
      const bounds = diagram.getBoundingClientRect();

      const relativeBox = (element) => {
        const box = element.getBoundingClientRect();

        return {
          x: box.left - bounds.left + box.width / 2,
          y: box.top - bounds.top + box.height / 2,
          left: box.left - bounds.left,
          top: box.top - bounds.top,
          width: box.width,
          height: box.height,
        };
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

    return () => {
      observer.disconnect();
    };
  }, [diagramRef]);

  // Paths change with layout, not animation frames.
  const paths = useMemo(() => {
    if (!geometry) return [];

    return timeline.map(({ animation, busActivity }) => {
      const points = createAnimationPath(animation.source, animation.destination, busActivity, animation.kind);
      const lengths = points.slice(1).map((point, index) => (
        Math.hypot(point.x - points[index].x, point.y - points[index].y)
      ));

      return {
        points,
        lengths,
        total: lengths.reduce((sum, length) => sum + length, 0),
        d: points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" "),
      };
    });
  }, [geometry, timeline, createAnimationPath]);

  const animateAlongPath = ({ points, lengths, total }, progress) => {
    let distance = total * progress;

    // Walk by distance so turning a corner does not change travel speed.
    for (let index = 0; index < lengths.length; index++) {
      if (distance <= lengths[index]) {
        const fraction = lengths[index] ? distance / lengths[index] : 0;

        return {
          x: points[index].x + (points[index + 1].x - points[index].x) * fraction,
          y: points[index].y + (points[index + 1].y - points[index].y) * fraction,
        };
      }

      distance -= lengths[index];
    }

    return points[points.length - 1];
  };

  useEffect(() => {
    if (paths.length) onPathLengths(paths.map(path => path.total));
  }, [paths, onPathLengths]);

  const elapsed = progress * duration;
  const travel = Math.max(0, Math.min(1, (elapsed - 80) / (duration - 260)));
  const opacity = Math.min(1, elapsed / 80, (duration - elapsed) / 80);
  const path = paths[stepIndex];
  const position = path ? animateAlongPath(path, travel) : null;
  const busStyle = busColors[busActivity?.type];
  const color = busStyle?.stroke || "#8b5cf6";

  const connectorStyle = (name) => ({
    transform: "translateY(-100%)",
    ...(geometry && {
      left: geometry.ports[name].x - 6,
      top: 6,
      height: geometry.rail.y - geometry.ports[name].y,
    }),
  });

  return (
    <>
      <div className="relative h-12 mt-4 w-full">
        {/* Bus Line */}
        <div ref={railRef} className="relative z-20 w-[41rem] h-3 bg-[#A8AAAF] rounded-full mx-auto"></div>

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
            <path d={path.d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
              opacity={opacity * 0.6} strokeDasharray={path.total}
              strokeDashoffset={path.total * (1 - travel)} />
            {animation.kind === "decode" && (
              <rect x={position.x} y={geometry.nodes[animation.source].top} width="3"
                height={geometry.nodes[animation.source].height} fill={color} opacity={opacity * 0.5} />
            )}
          </svg>
          <div role="img" aria-label={busActivity ? `${busActivity.type} bus transfer` : `${animation.kind} animation`}
            className={`absolute z-40 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-white shadow-sm ${busActivity ? (busStyle?.badge || "bg-gray-500") : "bg-violet-500"}`}
            style={{
              left: position.x,
              top: position.y,
              opacity,
              transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * Math.sin(Math.PI * progress)})`,
            }}
          >
            {busActivity && <Bus size={18} color="white" />}
            <span>{animation.value}</span>
          </div>
        </div>
      )}
    </>
  );
}