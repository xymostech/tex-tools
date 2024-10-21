import React, {useState, useRef, useEffect, useMemo} from 'react';
import * as d3 from 'd3';
import * as _ from 'lodash';
import './DviRendering.css';

import { defaultInput } from './defaultInput';

const positionElementsMatch = /^\((?<x>[0-9]+), (?<y>[0-9]+)\) {Character { char: (?<char>[0-9]+), font: "cmr10" }}$/

type Position = {
  x: number;
  y: number;
  char: number;
};

function parseLines(text: string): Position[] {
  const lines = text.trim().split("\n");

  let positions = [];
  
  for (const line of lines) {
    let match;
    if (match = line.match(positionElementsMatch)) {
      positions.push({
        x: parseInt(match.groups?.x || '0'),
        y: parseInt(match.groups?.y || '0'),
        char: parseInt(match.groups?.char || '0'),
      });
    } else {
      console.log("Couldn't match line: ", line);
    }
  }

  return positions;
}

function DviRendering() {
  const [text, setText] = useState(defaultInput);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPosition, setHoveredPosition] = useState<[number, number] | null>(null)

  const positions = useMemo(() => {
    return parseLines(text);
  }, [text]);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);

    const smallestX = Math.min(...positions.map(p => p.x));
    const smallestY = Math.min(...positions.map(p => p.y));

    const largestX = Math.max(...positions.map(p => p.x));
    const largestY = Math.max(...positions.map(p => p.y));

    function positionToX(position: Position): number {
      return (position.x) / (largestX);
    }

    function positionToY(position: Position): number {
      return (position.y) / (largestY);
    }

    function isHovered(p: Position): boolean {
      return p.x === hoveredPosition?.[0] && p.y === hoveredPosition?.[1];
    }

    const positionElems = svg.selectAll("g.position")
      .data(positions);
    
    positionElems.sort((a, b) => isHovered(a) ? 1 : isHovered(b) ? -1 : 0);

    positionElems.exit().remove();

    const newPositionElems = positionElems.enter()
      .append("g")
      .attr("class", "position");

    newPositionElems.append("text").attr("class", "contents");
    const newPopups = newPositionElems.append("g");
    newPopups.append("rect");
    newPopups.append("text");

    newPositionElems
      // @ts-ignore
      .merge(positionElems)
      .on("mouseenter", (_event, d) => setHoveredPosition([d.x, d.y]))
      .on("mouseleave", () => setHoveredPosition(null))
      .attr("transform", (d) => `translate(${positionToX(d)}, ${positionToY(d)})`)
    
    positionElems.select("text")
      .attr("font-size", 0.04)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text(d => "x");

    positionElems.select("g")
      .attr("transform", (d) => `translate(0, -0.1)`)
      .attr("z-index", 1)
      .attr("visibility", (d) => isHovered(d) ? "visible" : "hidden");
    
    positionElems.select("g").select("text")
      .attr("font-size", 0.03)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text(d => `${d.x}, ${d.y}`);

    positionElems.select("g").select("rect")
      .attr("x", -0.2)
      .attr("y", -0.05)
      .attr("width", 0.4)
      .attr("height", 0.1)
      .attr("fill", "white")
      .attr("stroke", "black")
      .attr("stroke-width", 0.01)
  }, [positions, hoveredPosition]);

  return (
    <div className="App">
      <div className="input">
        <div>
          Add output from{" "}
          <a href="https://github.com/xymostech/XymosTeX/blob/9fc5cbbd762897dbe4bad4b1be3d651d57f91fdf/src/print_dvi.rs">XymosTeX's print_dvi binary</a>
          {" "}here
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="output">
        <svg ref={svgRef} viewBox='-0.1 -0.1 1.2 1.2' preserveAspectRatio='none'>
        </svg>
      </div>
    </div>
  );
}

export default DviRendering;
