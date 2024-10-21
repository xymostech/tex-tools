import React, {useState, useRef, useEffect, useMemo} from 'react';
import * as d3 from 'd3';
import * as _ from 'lodash';
import './ParagraphSplitting.css';

import { defaultInput } from './defaultInput';

const potentialBreakpointMatch = /^@ via @@(?<previous>[-0-9]+) b=(?<badness>[-0-9]+) p=(?<penalty>[^ ]+) d=(?<demerits>[-0-9]+)$/
const decidedBreakpointMatch = /^@@(?<breakpoint>[0-9]+): line [^ ]+\.(?<class>[0-9]+) t=(?<totaldemerits>[-0-9]+) -> @@(?<previous>[0-9]+)$/

type Potential = {
  previousBreakpoint: number;
  demerits: number;
};

type PartialNode = {
  breakpointIndex: number;
  totalDemerits: number;
  classification: number;
  previousBreakpoint: number | null;
  lineNumber: number;
  potentials: Potential[];
};

type Node = PartialNode & {
  lineIndex: number;
};

type Graph = {
  nodes: Node[];
  maxLines: number;
}

function getLineNumber(breakpointIndex: number, graph: Map<number, PartialNode>): number {
  let lineCount = 0;
  let currentBreakpoint = breakpointIndex;
  while (currentBreakpoint !== 0) {
    lineCount++;
    let node = graph.get(currentBreakpoint);
    if (!node || node.previousBreakpoint == null) {
      throw new Error(`currentBreakpoint=${currentBreakpoint} node.previousBreakpoint=${node?.previousBreakpoint}`);
    }
    currentBreakpoint = node.previousBreakpoint;
  }
  return lineCount;
}

function parseLines(text: string): Graph {
  const lines = text.trim().split("\n");

  const graph = new Map<number, PartialNode>();
  graph.set(0, {
    breakpointIndex: 0,
    totalDemerits: 0,
    classification: 0,
    previousBreakpoint: null,
    lineNumber: 0,
    potentials: [],
  });

  let maxLineNumber = 0;

  let currPotentials: Potential[] = [];
  
  for (const line of lines) {
    let match;
    if (match = line.match(potentialBreakpointMatch)) {
      currPotentials.push({
        previousBreakpoint: Number.parseInt(match.groups?.previous || "0"),
        demerits: Number.parseInt(match.groups?.demerits || "0"),
      });
    } else if (match = line.match(decidedBreakpointMatch)) {
      const breakpoint = Number.parseInt(match.groups?.breakpoint || "0");
      const classification = Number.parseInt(match.groups?.class || "0");
      const totalDemerits = Number.parseInt(match.groups?.totaldemerits || "0");
      const previousBreakpoint = Number.parseInt(match.groups?.previous || "0");

      const lineNumber = getLineNumber(previousBreakpoint, graph) + 1;
      maxLineNumber = Math.max(maxLineNumber, lineNumber);

      graph.set(breakpoint, {
        breakpointIndex: breakpoint,
        totalDemerits,
        classification,
        previousBreakpoint,
        lineNumber,
        potentials: currPotentials,
      });
      currPotentials = [];
    } else {
      console.log("Couldn't match line: ", line);
    }
  }

  const allLines = _.groupBy(Array.from(graph.values()), node => node.lineNumber);
  const sortedLines = _.mapValues(allLines, line => _.sortBy(line, node => node.breakpointIndex));
  const nodesWithIndices = _.values(sortedLines).flatMap(line => _.map(line, (node, index) => ({ ...node, lineIndex: index })));

  return {
    nodes: nodesWithIndices,
    maxLines: maxLineNumber,
  }
}

function ParagraphSplitting() {
  const [text, setText] = useState(defaultInput);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredBreakpoint, setHoveredBreakpoint] = useState<number | null>(null)

  const graph = useMemo(() => {
    return parseLines(text);
  }, [text]);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = d3.select(svgRef.current);

    const node = _.find(graph.nodes, node => node.breakpointIndex === hoveredBreakpoint);

    const hoveredNodes: number[] = [];
    let currBreakpoint = hoveredBreakpoint;
    while (currBreakpoint != null) {
      const currNode = _.find(graph.nodes, node => node.breakpointIndex === currBreakpoint);
      if (!currNode) {
        break;
      }
      hoveredNodes.push(currNode.breakpointIndex);
      currBreakpoint = currNode.previousBreakpoint;
    }

    let totalColumns = _.uniqBy(graph.nodes, node => node.lineIndex).length - 1;

    const circleRadius = 1 / Math.max(totalColumns, graph.maxLines) / 2.2;

    function nodeToX(node: Node): number {
      return node.lineIndex / totalColumns;
    }

    function nodeToY(node: Node): number {
      return node.lineNumber / graph.maxLines;
    }

    function shrinkLine(x1: number, y1: number, x2: number, y2: number, shrinkAmount: number): { x: number, y: number } {
      const dx = x1 - x2;
      const dy = y1 - y2;
      const norm = Math.sqrt(dx * dx + dy * dy);
      const dxNorm = dx / norm;
      const dyNorm = dy / norm;

      return { x: x2 + dxNorm * shrinkAmount, y: y2 + dyNorm * shrinkAmount };
    }

    // @ts-ignore
    const nodePairs: {
      node: Node;
      prevNode: Node;
    }[] = _.map(graph.nodes, node => ({ node, prevNode: _.find(graph.nodes, nn => nn.breakpointIndex === node.previousBreakpoint) }))
      .filter(nodePair => nodePair.prevNode != null);

    const finalLines = svg.selectAll("line.final")
      .data(nodePairs)

    finalLines.exit().remove();

    finalLines.enter()
        .append("line")
        .attr("class", "final")
      // @ts-ignore
      .merge(finalLines)
        .attr("pointer-events", "none")
        .attr("x1", d => shrinkLine(nodeToX(d.node), nodeToY(d.node), nodeToX(d.prevNode), nodeToY(d.prevNode), circleRadius).x)
        .attr("y1", d => shrinkLine(nodeToX(d.node), nodeToY(d.node), nodeToX(d.prevNode), nodeToY(d.prevNode), circleRadius).y)
        .attr("x2", d => shrinkLine(nodeToX(d.prevNode), nodeToY(d.prevNode), nodeToX(d.node), nodeToY(d.node), circleRadius).x)
        .attr("y2", d => shrinkLine(nodeToX(d.prevNode), nodeToY(d.prevNode), nodeToX(d.node), nodeToY(d.node), circleRadius).y)
        .attr("stroke", d => hoveredNodes.includes(d.node.breakpointIndex) ? "black" : "rgba(0, 0, 0, 0.3)")
        .attr("stroke-width", d => hoveredNodes.includes(d.node.breakpointIndex) ? 0.01 : 0.005);

    const containers = svg.selectAll("g.node")
      .data(graph.nodes);

    containers.exit().remove();
    
    const newContainers = containers.enter()
      .append("g")
      .attr("class", "node");
    
    newContainers.append("text");
    newContainers.append("circle");
    const newStats = newContainers.append("g");
    newStats.append("rect");
    newStats.append("text");

    // @ts-ignore
    const allContainers = newContainers.merge(containers);

    allContainers
      .on("mouseenter", (_event, d) => setHoveredBreakpoint(d.breakpointIndex))
      .on("mouseleave", () => setHoveredBreakpoint(null))
      .attr("transform", (d) => `translate(${nodeToX(d)}, ${nodeToY(d)})`);

    allContainers.select("circle")
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("pointer-events", "fill")
      .attr("stroke-width", d => hoveredNodes.includes(d.breakpointIndex) ? 0.01 : 0.005)
      .attr("r", circleRadius);

    allContainers.select("text")
      .attr("font-size", 0.03)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text(d => `${d.breakpointIndex}`);

    allContainers.select("g")
      .attr("pointer-events", "none")
      .attr("transform", () => `translate(${-2.5 * circleRadius}, 0)`)
      .attr("visibility", (d) => hoveredNodes.includes(d.breakpointIndex) ? "visible" : "hidden");
    
    allContainers.select("g").select("rect")
      .attr("width", circleRadius * 2.5)
      .attr("height", circleRadius * 2)
      .attr("x", -circleRadius * 1.25)
      .attr("y", -circleRadius)
      .attr("fill", "white");
    
    allContainers.select("g").select("text")
      .attr("font-size", 0.02)
      .attr("text-anchor", "middle")
      .text(d => `${d.totalDemerits}`);
  }, [graph, hoveredBreakpoint]);

  return (
    <div className="App">
      <div className="input">
        <div>Add output from <code>\tracingparagraphs=1</code> here</div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="output">
        <svg ref={svgRef} viewBox='-0.2 -0.1 1.3 1.2' preserveAspectRatio='none'>
        </svg>
      </div>
    </div>
  );
}

export default ParagraphSplitting;
