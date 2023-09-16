var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _ComfyApp_instances, _ComfyApp_queueItems, _ComfyApp_processingQueue, _ComfyApp_loadExtensions, _ComfyApp_invokeExtensionsAsync, _ComfyApp_invokeExtensions, _ComfyApp_formatRunnerError, _ComfyApp_formatExecutionError, _ComfyApp_addApiUpdateHandlers;
import { api } from "./api.js";
import { ComfyWidgets } from "./widgets.js";
import { ComfyUI, $el } from "./ui.js";
import { defaultGraph } from "./defaultGraph.js";
import { LGraph, LGraphCanvas, LiteGraph } from "../types/litegraph.js";
export class ComfyApp {
    constructor() {
        _ComfyApp_instances.add(this);
        _ComfyApp_queueItems.set(this, []);
        _ComfyApp_processingQueue.set(this, false);
        this.ui = new ComfyUI(this);
        this.extensions = [];
        this.nodeOutputs = {};
    }
    setup() {
        return __awaiter(this, void 0, void 0, function* () {
            yield __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_loadExtensions).call(this);
            const mainCanvas = document.createElement("canvas");
            mainCanvas.style.touchAction = "none";
            const canvasEl = (this.canvasEl = Object.assign(mainCanvas, { id: "graph-canvas" }));
            canvasEl.tabIndex = 1;
            document.body.prepend(canvasEl);
            this.graph = new LGraph();
            const canvas = (this.canvas = new LGraphCanvas(canvasEl, this.graph));
            this.ctx = canvasEl.getContext("2d");
            LiteGraph.release_link_on_empty_shows_menu = true;
            LiteGraph.alt_drag_do_clone_nodes = true;
            this.graph.start();
            function resizeCanvas() {
                const scale = Math.max(window.devicePixelRatio, 1);
                const { width, height } = canvasEl.getBoundingClientRect();
                canvasEl.width = Math.round(width * scale);
                canvasEl.height = Math.round(height * scale);
                canvasEl.getContext("2d").scale(scale, scale);
                canvas.draw(true, true);
            }
            resizeCanvas();
            window.addEventListener("resize", resizeCanvas);
            yield __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_invokeExtensionsAsync).call(this, "init");
            yield this.registerNodes();
            let restored = false;
            try {
                const json = localStorage.getItem("workflow");
                if (json) {
                    const workflow = JSON.parse(json);
                    this.loadGraphData(workflow);
                    restored = true;
                }
            }
            catch (err) {
                console.error("Error loading previous workflow", err);
            }
            if (!restored) {
                this.loadGraphData(null);
            }
            setInterval(() => localStorage.setItem("workflow", JSON.stringify(this.graph.serialize())), 1000);
            __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_addApiUpdateHandlers).call(this);
            yield __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_invokeExtensionsAsync).call(this, "setup");
        });
    }
    registerNodes() {
        return __awaiter(this, void 0, void 0, function* () {
            const app = this;
            const defs = yield api.getNodeDefs();
            yield this.registerNodesFromDefs(defs);
            yield __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_invokeExtensionsAsync).call(this, "registerCustomNodes");
        });
    }
    registerNodesFromDefs(defs) {
        return __awaiter(this, void 0, void 0, function* () {
            yield __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_invokeExtensionsAsync).call(this, "addCustomNodeDefs", defs);
            const widgets = Object.assign({}, ComfyWidgets, ...(yield __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_invokeExtensionsAsync).call(this, "getCustomWidgets")).filter(Boolean));
            for (const nodeId in defs) {
                const nodeData = defs[nodeId];
                const node = Object.assign(function ComfyNode() {
                    var _a;
                    var inputs = nodeData["input"]["required"];
                    if (nodeData["input"]["optional"] != undefined) {
                        inputs = Object.assign({}, nodeData["input"]["required"], nodeData["input"]["optional"]);
                    }
                    const config = { minWidth: 1, minHeight: 1 };
                    for (const inputName in inputs) {
                        const inputData = inputs[inputName];
                        const type = inputData[0];
                        if ((_a = inputData[1]) === null || _a === void 0 ? void 0 : _a.forceInput) {
                            this.addInput(inputName, type);
                        }
                        else {
                            if (Array.isArray(type)) {
                                Object.assign(config, widgets.COMBO(this, inputName, inputData, app) || {});
                            }
                            else if (`${type}:${inputName}` in widgets) {
                                Object.assign(config, widgets[`${type}:${inputName}`](this, inputName, inputData, app) || {});
                            }
                            else if (type in widgets) {
                                Object.assign(config, widgets[type](this, inputName, inputData, app) || {});
                            }
                            else {
                                this.addInput(inputName, type);
                            }
                        }
                    }
                    for (const o in nodeData["output"]) {
                        const output = nodeData["output"][o];
                        const outputName = nodeData["output_name"][o] || output;
                        const outputShape = nodeData["output_is_list"][o] ? LiteGraph.GRID_SHAPE : LiteGraph.CIRCLE_SHAPE;
                        this.addOutput(outputName, output, { shape: outputShape });
                    }
                    const s = this.computeSize();
                    s[0] = Math.max(config.minWidth, s[0] * 1.5);
                    s[1] = Math.max(config.minHeight, s[1]);
                    this.size = s;
                    this.serialize_widgets = true;
                }, {
                    title: nodeData.display_name || nodeData.name,
                    comfyClass: nodeData.name,
                    category: nodeData.category,
                });
                node.prototype.comfyClass = nodeData.name;
                yield __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_invokeExtensionsAsync).call(this, "beforeRegisterNodeDef", node, nodeData);
                LiteGraph.registerNodeType(nodeId, node);
            }
        });
    }
    registerExtension(extension) {
        if (!extension.name) {
            throw new Error("Extensions must have a 'name' property.");
        }
        if (this.extensions.find((ext) => ext.name === extension.name)) {
            throw new Error(`Extension named '${extension.name}' already registered.`);
        }
        this.extensions.push(extension);
    }
    queueRunner(number, batchCount = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Queueing runner", number, batchCount);
            __classPrivateFieldGet(this, _ComfyApp_queueItems, "f").push({ number, batchCount });
            if (__classPrivateFieldGet(this, _ComfyApp_processingQueue, "f")) {
                return;
            }
            __classPrivateFieldSet(this, _ComfyApp_processingQueue, true, "f");
            this.lastNodeErrors = null;
            try {
                while (__classPrivateFieldGet(this, _ComfyApp_queueItems, "f").length) {
                    ({ number, batchCount } = __classPrivateFieldGet(this, _ComfyApp_queueItems, "f").pop());
                    for (let i = 0; i < batchCount; i++) {
                        const p = yield this.graphToRunner();
                        try {
                            const res = yield api.queueRunner(number, p);
                            this.lastNodeErrors = res.node_errors;
                            if (this.lastNodeErrors.length > 0) {
                                this.canvas.draw(true, true);
                            }
                        }
                        catch (error) {
                            const formattedError = __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_formatRunnerError).call(this, error);
                            this.ui.dialog.show(formattedError);
                            if (error.response) {
                                this.lastNodeErrors = error.response.node_errors;
                                this.canvas.draw(true, true);
                            }
                            break;
                        }
                        for (const n of p.workflow.nodes) {
                            const node = app.graph.getNodeById(n.id);
                            if (node.widgets) {
                                for (const widget of node.widgets) {
                                    if (widget.afterQueued) {
                                        widget.afterQueued();
                                    }
                                }
                            }
                        }
                        this.canvas.draw(true, true);
                        yield this.ui.queue.update();
                    }
                }
            }
            finally {
                __classPrivateFieldSet(this, _ComfyApp_processingQueue, false, "f");
            }
        });
    }
    graphToRunner() {
        return __awaiter(this, void 0, void 0, function* () {
            const workflow = this.graph.serialize();
            const output = {};
            for (const node of this.graph.computeExecutionOrder(false)) {
                const n = workflow.nodes.find((n) => n.id === node.id);
                if (node.isVirtualNode) {
                    if (node.applyToGraph) {
                        node.applyToGraph(workflow);
                    }
                    continue;
                }
                if (node.mode === 2 || node.mode === 4) {
                    continue;
                }
                const inputs = {};
                const widgets = node.widgets;
                if (widgets) {
                    for (const i in widgets) {
                        const widget = widgets[i];
                        if (!widget.options || widget.options.serialize !== false) {
                            inputs[widget.name] = widget.serializeValue ? yield widget.serializeValue(n, i) : widget.value;
                        }
                    }
                }
                for (let i in node.inputs) {
                    let parent = node.getInputNode(i);
                    if (parent) {
                        let link = node.getInputLink(i);
                        while (parent.mode === 4 || parent.isVirtualNode) {
                            let found = false;
                            if (parent.isVirtualNode) {
                                link = parent.getInputLink(link.origin_slot);
                                if (link) {
                                    parent = parent.getInputNode(link.target_slot);
                                    if (parent) {
                                        found = true;
                                    }
                                }
                            }
                            else if (link && parent.mode === 4) {
                                let all_inputs = [link.origin_slot];
                                if (parent.inputs) {
                                    all_inputs = all_inputs.concat(Object.keys(parent.inputs));
                                    for (let parent_input in all_inputs) {
                                        parent_input = all_inputs[parent_input];
                                        if (parent.inputs[parent_input].type === node.inputs[i].type) {
                                            link = parent.getInputLink(parent_input);
                                            if (link) {
                                                parent = parent.getInputNode(parent_input);
                                            }
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (!found) {
                                break;
                            }
                        }
                        if (link) {
                            inputs[node.inputs[i].name] = [String(link.origin_id), parseInt(link.origin_slot)];
                        }
                    }
                }
                output[String(node.id)] = {
                    inputs,
                    class_type: node.comfyClass,
                };
            }
            for (const o in output) {
                for (const i in output[o].inputs) {
                    if (Array.isArray(output[o].inputs[i])
                        && output[o].inputs[i].length === 2
                        && !output[output[o].inputs[i][0]]) {
                        delete output[o].inputs[i];
                    }
                }
            }
            return { workflow, output };
        });
    }
    loadGraphData(graphData) {
        var _a;
        this.clean();
        let reset_invalid_values = false;
        if (!graphData) {
            graphData = structuredClone(defaultGraph);
            reset_invalid_values = true;
        }
        const missingNodeTypes = [];
        for (let n of graphData.nodes) {
            if (!(n.type in LiteGraph.registered_node_types)) {
                missingNodeTypes.push(n.type);
            }
        }
        try {
            this.graph.configure(graphData);
        }
        catch (error) {
            let errorHint = [];
            const filename = error.fileName || ((_a = (error.stack || "").match(/(\/extensions\/.*\.js)/)) === null || _a === void 0 ? void 0 : _a[1]);
            const pos = (filename || "").indexOf("/extensions/");
            if (pos > -1) {
                errorHint.push($el("span", { textContent: "This may be due to the following script:" }), $el("br"), $el("span", {
                    style: {
                        fontWeight: "bold",
                    },
                    textContent: filename.substring(pos),
                }));
            }
            this.ui.dialog.show($el("div", [
                $el("p", { textContent: "Loading aborted due to error reloading workflow data" }),
                $el("pre", {
                    style: { padding: "5px", backgroundColor: "rgba(255,0,0,0.2)" },
                    textContent: error.toString(),
                }),
                $el("pre", {
                    style: {
                        padding: "5px",
                        color: "#ccc",
                        fontSize: "10px",
                        maxHeight: "50vh",
                        overflow: "auto",
                        backgroundColor: "rgba(0,0,0,0.2)",
                    },
                    textContent: error.stack || "No stacktrace available",
                }),
                ...errorHint,
            ]).outerHTML);
            return;
        }
        for (const node of this.graph._nodes) {
            const size = node.computeSize();
            size[0] = Math.max(node.size[0], size[0]);
            size[1] = Math.max(node.size[1], size[1]);
            node.size = size;
            if (node.widgets) {
                for (let widget of node.widgets) {
                    if (reset_invalid_values) {
                        if (widget.type == "combo") {
                            if (!widget.options.values.includes(widget.value) && widget.options.values.length > 0) {
                                widget.value = widget.options.values[0];
                            }
                        }
                    }
                }
            }
            __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_invokeExtensions).call(this, "loadedGraphNode", node);
        }
        if (missingNodeTypes.length) {
            this.ui.dialog.show(`When loading the graph, the following node types were not found: <ul>${Array.from(new Set(missingNodeTypes)).map((t) => `<li>${t}</li>`).join("")}</ul>Nodes that have failed to load will show as red on the graph.`);
            this.logging.addEntry("Comfy.App", "warn", {
                MissingNodes: missingNodeTypes,
            });
        }
    }
    clean() {
        this.nodeOutputs = {};
        this.lastNodeErrors = null;
        this.lastExecutionError = null;
        this.runningNodeId = null;
    }
}
_ComfyApp_queueItems = new WeakMap(), _ComfyApp_processingQueue = new WeakMap(), _ComfyApp_instances = new WeakSet(), _ComfyApp_loadExtensions = function _ComfyApp_loadExtensions() {
    return __awaiter(this, void 0, void 0, function* () {
        const extensions = yield api.getExtensions();
        for (const ext of extensions) {
            try {
                yield import(api.apiURL(ext));
            }
            catch (error) {
                console.error("Error loading extension", ext, error);
            }
        }
    });
}, _ComfyApp_invokeExtensionsAsync = function _ComfyApp_invokeExtensionsAsync(method, ...args) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield Promise.all(this.extensions.map((ext) => __awaiter(this, void 0, void 0, function* () {
            if (method in ext) {
                try {
                    return yield ext[method](...args, this);
                }
                catch (error) {
                    console.error(`Error calling extension '${ext.name}' method '${method}'`, { error }, { extension: ext }, { args });
                }
            }
        })));
    });
}, _ComfyApp_invokeExtensions = function _ComfyApp_invokeExtensions(method, ...args) {
    let results = [];
    for (const ext of this.extensions) {
        if (method in ext) {
            try {
                results.push(ext[method](...args, this));
            }
            catch (error) {
                console.error(`Error calling extension '${ext.name}' method '${method}'`, { error }, { extension: ext }, { args });
            }
        }
    }
    return results;
}, _ComfyApp_formatRunnerError = function _ComfyApp_formatRunnerError(error) {
    if (error == null) {
        return "(unknown error)";
    }
    else if (typeof error === "string") {
        return error;
    }
    else if (error.stack && error.message) {
        return error.toString();
    }
    else if (error.response) {
        let message = error.response.error.message;
        if (error.response.error.details)
            message += ": " + error.response.error.details;
        for (const [nodeID, nodeError] of Object.entries(error.response.node_errors)) {
            message += "\n" + nodeError.class_type + ":";
            for (const errorReason of nodeError.errors) {
                message += "\n    - " + errorReason.message + ": " + errorReason.details;
            }
        }
        return message;
    }
    return "(unknown error)";
}, _ComfyApp_formatExecutionError = function _ComfyApp_formatExecutionError(error) {
    if (error == null) {
        return "(unknown error)";
    }
    const traceback = error.traceback.join("");
    const nodeId = error.node_id;
    const nodeType = error.node_type;
    return `Error occurred when executing ${nodeType}:\n\n${error.exception_message}\n\n${traceback}`;
}, _ComfyApp_addApiUpdateHandlers = function _ComfyApp_addApiUpdateHandlers() {
    api.addEventListener("status", ({ detail }) => {
        this.ui.setStatus(detail);
    });
    api.addEventListener("reconnecting", () => {
        this.ui.dialog.show("Reconnecting...");
    });
    api.addEventListener("reconnected", () => {
        this.ui.dialog.close();
    });
    api.addEventListener("progress", ({ detail }) => {
        this.progress = detail;
        this.graph.setDirtyCanvas(true, false);
    });
    api.addEventListener("executing", ({ detail }) => {
        this.progress = null;
        this.runningNodeId = detail;
        this.graph.setDirtyCanvas(true, false);
        delete this.nodePreviewImages[this.runningNodeId];
    });
    api.addEventListener("executed", ({ detail }) => {
        this.nodeOutputs[detail.node] = detail.output;
        const node = this.graph.getNodeById(detail.node);
        if (node) {
            if (node.onExecuted)
                node.onExecuted(detail.output);
        }
    });
    api.addEventListener("execution_start", ({ detail }) => {
        this.runningNodeId = null;
        this.lastExecutionError = null;
    });
    api.addEventListener("execution_error", ({ detail }) => {
        this.lastExecutionError = detail;
        const formattedError = __classPrivateFieldGet(this, _ComfyApp_instances, "m", _ComfyApp_formatExecutionError).call(this, detail);
        this.ui.dialog.show(formattedError);
        this.canvas.draw(true, true);
    });
    api.addEventListener("b_preview", ({ detail }) => {
        const id = this.runningNodeId;
        if (id == null)
            return;
        const blob = detail;
        const blobUrl = URL.createObjectURL(blob);
        this.nodePreviewImages[id] = [blobUrl];
    });
    api.init();
};
export const app = new ComfyApp();