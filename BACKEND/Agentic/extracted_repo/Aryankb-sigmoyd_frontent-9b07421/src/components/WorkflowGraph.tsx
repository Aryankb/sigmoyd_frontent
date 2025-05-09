import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Panel,
} from "reactflow";
import CustomNode from "./CustomNode.tsx";
import "reactflow/dist/style.css";
import { FaPlay, FaCheckCircle, FaSave, FaBolt, FaStop } from "react-icons/fa";
import { useAuth } from "@clerk/clerk-react";
import "./WorkflowLoadingAnimation.css";

interface WorkflowNode {
  id: string | number;
  name: string;
  tool_action?: string;
  to_execute?: string[];
  description?: string;
  type?: string;
  config_inputs?: any;
  llm_prompt?: string;
  validation_prompt?: string;
  data_flow_inputs?: string[];
  data_flow_outputs?: string[];
}

interface Trigger {
  name: string;
  description: string;
  config_inputs?: any;
  output?: string;
}

interface WorkflowJson {
  trigger: Trigger;
  workflowflow_name: string;
  workflow_id: string | number;
  workflow: WorkflowNode[];
  data_flow_notebook_keys?: string[];
  active: boolean;
}
interface Workflow {
  id: string;
  name: string;
  json: string;
  prompt: string;
  active?: boolean;
}

interface WorkflowGraphProps {
  workflowJson: WorkflowJson;
  workflows: Workflow[];
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>;
}

// Enhanced node arrangement function for better visualization
const arrangeNodes = (workflow, trigger) => {
  const dependencies = new Map();
  const dependents = new Map();
  const levels = new Map();

  workflow.forEach((node) => {
    dependencies.set(node.id, new Set());
    dependents.set(node.id, new Set());
  });

  workflow.forEach((node) => {
    if (node.data_flow_inputs) {
      node.data_flow_inputs.forEach((input) => {
        const parent = workflow.find((n) =>
          n.data_flow_outputs?.includes(input)
        );
        if (parent) {
          dependencies.get(node.id).add(parent.id);
          dependents.get(parent.id).add(node.id);
        }
      });
    }
  });

  if (trigger && trigger.output) {
    workflow.forEach((node) => {
      if (node.data_flow_inputs?.includes("trigger_output")) {
        dependencies.get(node.id).add("trigger");
        dependents.set("trigger", dependents.get("trigger") || new Set());
        dependents.get("trigger").add(node.id);
      }
    });
  }

  const visited = new Set();
  const assignLevel = (nodeId, level = 0) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    levels.set(nodeId, Math.max(level, levels.get(nodeId) || 0));

    const deps = dependents.get(nodeId);
    if (deps) {
      deps.forEach((depId) => {
        assignLevel(depId, level + 1);
      });
    }
  };

  workflow.forEach((node) => {
    if (dependencies.get(node.id).size === 0) {
      assignLevel(node.id, 0);
    }
  });

  if (trigger) {
    assignLevel("trigger", 0);
  }

  workflow.forEach((node) => {
    if (!levels.has(node.id)) {
      assignLevel(node.id, 0);
    }
  });

  const nodesByLevel = new Map();
  levels.forEach((level, nodeId) => {
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level).push(nodeId);
  });

  const nodePositions = new Map();
  const nodeSpacingX = 350;
  const nodeSpacingY = 200;
  const centerOffset = 150;

  nodesByLevel.forEach((nodeIds, level) => {
    const levelWidth = nodeIds.length * nodeSpacingX;
    const startX = -(levelWidth / 2) + centerOffset;

    nodeIds.forEach((nodeId, index) => {
      const xPos = startX + index * nodeSpacingX;
      const yPos = level * nodeSpacingY;
      nodePositions.set(nodeId, { x: xPos, y: yPos });
    });
  });

  return nodePositions;
};

const generateNodesAndEdges = (workflowJson, handleValueChange) => {
  const { workflow, trigger, data_flow_notebook_keys } = workflowJson;
  const positions = arrangeNodes(workflow, trigger);
  
  const nodes = workflow.map((node) => ({
    // if (node.to_execute && node.to_execute.length === 1) {
    //   node.to_execute = node.to_execute[0];
    // }
    id: node.id.toString(),
    type: "customNode",
    position: positions.get(node.id) || { x: 0, y: 0 },
    data: {
      handleValueChange,
      label: node.name,
      tool_action: node.tool_action || null,
      to_execute: node.to_execute,
      connectorName: node.to_execute
        ? node.to_execute[0]
          ? node.to_execute.length === 1
            ? `${node.to_execute[0][0].replace("connector_", "")}`:
            `${node.to_execute[0].replace("connector_", "")}`
          : ""
        : "",
      description: node.description,
      id: node.id,
      type: node.type,
      config_inputs: node.config_inputs,
      llm_prompt: node.llm_prompt,
      validation_prompt: node.validation_prompt,
    },
    style: {
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      border: "1px solid #ddd",
      borderRadius: "8px",
    },
  }));

  if (trigger.name !== "TRIGGER_MANUAL") {
    nodes.push({
      id: trigger.id.toString(),
      type: "customNode",
      position: positions.get("trigger") || { x: 0, y: 0 },
      data: {
        handleValueChange,
        label: trigger.name,
        description: trigger.description,
        config_inputs: trigger.config_inputs,
        isTrigger: true,
        id: trigger.id,
        type: "TRIGGER",
      },
      style: {
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.2)",
        border: "2px solid var(--color-primary)",
        borderRadius: "8px",
      },
    });
  }

  const edges = [];
  if (trigger.output && data_flow_notebook_keys?.includes("trigger_output")) {
    workflow.forEach((node) => {
      if (node.data_flow_inputs?.includes("trigger_output")) {
        edges.push({
          id: `e${trigger.id}-${node.id}`,
          source: trigger.id.toString(),
          target: node.id.toString(),
          label: trigger.output.toString(),
          animated: true,
          style: {
            stroke: "var(--color-primary)",
            strokeWidth: 2,
          },
          labelStyle: {
            fill: "var(--color-text)",
            fontWeight: 500,
          },
          labelBgStyle: {
            fill: "var(--color-card)",
            opacity: 0.8,
            borderRadius: "4px",
            padding: "2px",
          },
        });
      }
    });
  }

  workflow.forEach((node) => {
    if (node.data_flow_outputs) {
      node.data_flow_outputs.forEach((output) => {
        workflow.forEach((targetNode) => {
          if (
            targetNode.data_flow_inputs &&
            targetNode.data_flow_inputs.includes(output)
          ) {
            edges.push({
              id: `e${node.id}-${targetNode.id}-${output}`,
              source: node.id.toString(),
              target: targetNode.id.toString(),
              label: output,
              animated: true,
              style: {
                stroke: "var(--color-secondary)",
                strokeWidth: 1.5,
                strokeDasharray: "5, 5",
              },
              labelStyle: {
                fill: "var(--color-text)",
                fontSize: 12,
              },
              labelBgStyle: {
                fill: "var(--color-background)",
                opacity: 0.7,
                borderRadius: "4px",
              },
              markerEnd: {
                type: "arrowclosed",
                color: "var(--color-secondary)",
              },
            });
          }
        });
      });
    }
  });

  return { nodes, edges };
};

const nodeTypes = {
  customNode: CustomNode,
};

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({
  workflowJson,
  workflows,
  setWorkflows,
}) => {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [workflowData, setWorkflowData] = useState(workflowJson);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [bootPhase, setBootPhase] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);

  const bootSequence = [
    "Initializing workflow engine...",
    "Analyzing workflow requirements...",
    "Loading available tools...",
    "Finding optimal tool combinations...",
    "Configuring API connections...",
    "Setting up data flows...",
    "Creating intelligent agents...",
    "Establishing trigger conditions...",
    "Building execution paths...",
    "Optimizing workflow logic...",
    "Running security checks...",
    "Finalizing configuration...",
    "System ready.",
  ];

  useEffect(() => {
    setWorkflowData(workflowJson);
    console.log("changed flow");
  }, [workflowJson]);

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(
      workflowData,
      handleValueChange
    );
    setNodes(newNodes);
    setEdges(newEdges);

    console.log("updated useeffect :", workflowData);
  }, [workflowData]);

  const handleValueChange = (nodeId, field, value, type) => {
    setWorkflowData((prevData) => {
      const newJson = JSON.parse(JSON.stringify(prevData));

      if (nodeId === 0) {
        if (type === "config") {
          newJson.trigger.config_inputs = {
            ...newJson.trigger.config_inputs,
            [field]: value,
          };
        }
      } else {
        // Special handling for file deletion with _replace_all_config_inputs_ signal
        if (type === "config" && field === "_replace_all_config_inputs_") {
          // Replace all config inputs with the new structure
          const newConfigInputs = JSON.parse(value);

          newJson.workflow = newJson.workflow.map((node) =>
            node.id === Number(nodeId)
              ? {
                  ...node,
                  config_inputs: newConfigInputs,
                }
              : node
          );
        } else {
          // Normal case: update a single field
          newJson.workflow = newJson.workflow.map((node) =>
            node.id === Number(nodeId)
              ? {
                  ...node,
                  ...(type === "config"
                    ? {
                        config_inputs: {
                          ...node.config_inputs,
                          [field]: value,
                        },
                      }
                    : { [field]: value }),
                }
              : node
          );
        }
      }
      console.log("updated", newJson);
      setShowSaveButton(true);
      return newJson;
    });
  };

  const saveWorkflow = async () => {
    const token = await getToken();
    try {
      const response = await fetch("http://localhost:8000/save_workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workflowjson: workflowData }),
      });

      if (!response.ok) {
        throw new Error("Failed to save workflow");
      }

      const responseData = await response.json();
      setWorkflowData(responseData.json);
      fetchWorkflows();
      console.log("Workflow saved successfully:", responseData);
      alert("Workflow saved successfully!");
      setShowSaveButton(false);
    } catch (error) {
      console.error("Error saving workflow:", error);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const token = await getToken();
      const response = await fetch("http://localhost:8000/sidebar_workflows", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();
      setWorkflows(data);
    } catch (error) {
      console.error("Error fetching workflows:", error);
    }
  };

  const { nodes: initialNodes, edges: initialEdges } = generateNodesAndEdges(
    workflowJson,
    handleValueChange
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const runOrActivateWorkflow = async () => {
    const token = await getToken();
    setLoading(true);
    setBootPhase(0);
    setBootComplete(false);
    setLoadingStep(bootSequence[0]);
    setLoadingProgress(0);

    // Don't modify document classes anymore - this was causing the issue
    // Instead, we'll use component-level state to control the loading overlay

    let currentPhase = 0;

    const advancePhase = () => {
      if (currentPhase < bootSequence.length - 1) {
        currentPhase++;
        setBootPhase(currentPhase);
        setLoadingStep(bootSequence[currentPhase]);
        setLoadingProgress(
          Math.floor((currentPhase / (bootSequence.length - 1)) * 100)
        );

        const delay = Math.random() * 300 + 400;
        setTimeout(advancePhase, delay);
      } else {
        setBootComplete(true);
      }
    };

    setTimeout(() => {
      advancePhase();
    }, 500);

    const url =
      workflowJson.trigger.name === "TRIGGER_MANUAL"
        ? "http://localhost:8000/run_workflow"
        : "http://localhost:8000/activate_workflow";

    console.log("🚀 Running or activating workflow:", workflowData);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ workflowjson: workflowData }),
      });

      // Immediately reset loading state
      setLoading(false);
      setLoadingStep("");
      setLoadingProgress(0);
      setBootComplete(true);
      fetchWorkflows();
      if (!response.ok) {
        const responseData = await response.json();
        console.error(
          "Failed to run or activate workflow",
          responseData.message
        );
        if (
          responseData.message === "Please fill in your API keys to proceed."
        ) {
          window.location.href = "/api-keys";
        }
      } else {
        const responseData = await response.json();
        console.log("🚀 Workflow activated:", responseData);
        setWorkflowData(responseData.json);
        // fetchWorkflows();
      }
    } catch (error) {
      console.error("Error activating workflow:", error);

      // Ensure loading state is cleared on error
      setLoading(false);
      setLoadingStep("");
      setLoadingProgress(0);
      setBootComplete(true);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        border: "1px solid #333",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {loading && (
        <div className="workflow-loading-overlay">
          <div className="boot-container">
            <div className="boot-header">
              <h1 className="boot-title">SIGMOYD AI</h1>
              <p className="boot-subtitle">
                {workflowJson.trigger.name === "TRIGGER_MANUAL"
                  ? "WORKFLOW EXECUTION SEQUENCE"
                  : workflowData.active
                  ? "WORKFLOW DEACTIVATION SEQUENCE"
                  : "WORKFLOW ACTIVATION SEQUENCE"}
              </p>
            </div>

            <div className="boot-terminal">
              <div className="boot-console">
                {bootSequence.slice(0, bootPhase + 1).map((text, index) => (
                  <div key={index} className="boot-line">
                    <span className="boot-prompt">&gt;</span>
                    <div
                      className={`boot-message ${
                        index === bootPhase ? "boot-cursor" : ""
                      }`}
                    >
                      {text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="boot-progress-container">
                <div className="boot-progress-bar">
                  <div
                    className="boot-progress-fill"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <div className="boot-progress-text">{loadingProgress}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        style={{ background: "var(--color-background)" }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          animated: true,
          // type: "smoothstep",
        }}
      >
        <MiniMap
          style={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-text-accent)",
            borderRadius: "4px",
          }}
          nodeColor="var(--color-primary)"
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Controls
          position="bottom-right"
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "4px",
            backgroundColor: "var(--color-card)",
            borderRadius: "4px",
            padding: "4px",
          }}
        />
        <Background
          color="var(--color-text-accent)"
          gap={16}
          size={1}
          variant="dots"
        />

        <Panel
          position="top-left"
          style={{ background: "transparent", border: "none" }}
        >
          <h2
            onClick={(e) => {
              const input = e.currentTarget.nextElementSibling;
              input.style.display = "block";
              input.focus();
              e.currentTarget.style.display = "none";
            }}
            style={{
              cursor: "pointer",
              fontSize: "24px",
              fontWeight: "bold",
              color: "var(--color-text)",
            }}
          >
            {workflowData.workflow_name}
          </h2>
          <input
            type="text"
            value={workflowData.workflow_name}
            onBlur={(e) => {
              e.target.style.display = "none";
              e.target.previousElementSibling.style.display = "block";
              setWorkflowData((prevData) => ({
                ...prevData,
                workflow_name: e.target.value,
              }));
            }}
            onChange={(e) =>
              setWorkflowData((prevData) => ({
                ...prevData,
                workflow_name: e.target.value,
              }))
            }
            className="px-2 py-2 border rounded bg-card text-text"
            placeholder="Workflow Name"
            style={{ display: "none" }}
          />

          <div
            onClick={runOrActivateWorkflow}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg shadow-md transition-all duration-300 mt-8 font-medium cursor-pointer ${
              workflowJson.trigger.name === "TRIGGER_MANUAL"
                ? "bg-blue-400 text-black rounded shadow hover:bg-blue-600"
                : workflowData.active
                ? "bg-red-400 text-black rounded shadow hover:bg-red-600"
                : "bg-red-400 text-black rounded shadow hover:bg-red-600"
            } hover:scale-105 active:scale-95 border border-gray-600`}
            style={{ width: "220px", textAlign: "center" }}
          >
            <div className="flex items-center justify-center">
              {workflowJson.trigger.name === "TRIGGER_MANUAL" ? (
                <FaPlay className="mr-2" />
              ) : workflowData.active ? (
                <FaStop className="mr-2" />
              ) : (
                <FaBolt className="mr-2" />
              )}
              <span>
                {workflowJson.trigger.name === "TRIGGER_MANUAL"
                  ? "Run Workflow"
                  : workflowData.active
                  ? "Deactivate Workflow"
                  : "Activate Workflow"}
              </span>
            </div>
          </div>
            {showSaveButton && (
            <div
              onClick={saveWorkflow}
              className="flex flex items-center justify-center gap-2 px-6 py-3 rounded-lg shadow-md transition-all duration-300 mt-4 font-medium cursor-pointer bg-green-500 text-black rounded shadow hover:bg-green-600"
              style={{ width: "220px", textAlign: "center" }}
            >
              <FaSave className="inline-block mr-2" />
              <span>Save Changes</span>
            </div>
            )}
        </Panel>
      </ReactFlow>
    </div>
  );
};
export default WorkflowGraph;
