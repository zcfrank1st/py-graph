import { api } from '../api.js'
import { CanvasManager } from '../canvas-manager/index.js'
import { StateHandler } from '../state-handler/index.js'
import { ProgressManager } from '../progress-manager/index.js'
import { EventManager } from '../eventManager.js'
import { ComfyWidgets } from '../canvas-manager/widgets.js'

export class NodeManager implements Module {
  /**
   * Stores preview images for nodes
   */
  nodePreviewImages: Record<string, string[]>

  /**
   * The node that is currently being dragged over
   */
  dragOverNode: LGraphNode

  /**
   * The graph instance
   */
  canvasManager: CanvasManager

  /**
   * The state handler instance
   */
  stateHandler: StateHandler

  /**
   * The progress manager instance
   */
  progressManager: ProgressManager

  constructor(private eventManager: EventManager) {}

  async setup(config: ComfyCenter) {
    this.canvasManager = config.canvasManager
    this.stateHandler = config.stateHandler
    await this.registerNodes(config)
  }

  /**
   * Registers nodes with the graph
   */
  async registerNodes(config: ComfyCenter) {
    const app = this
    // Load node definitions from the backend
    const defs = await api.getNodeDefs()
    await this.registerNodesFromDefs(config, defs)
    await this.eventManager.invokeExtensions('registerCustomNodes')
  }

  async registerNodesFromDefs(config: ComfyCenter, defs: { [x: string]: any }) {
    await this.eventManager.invokeExtensions('addCustomNodeDefs', defs)

    // Generate list of known widgets
    const widgets = Object.assign(
      {},
      ComfyWidgets,
      ...(await this.eventManager.invokeExtensions('getCustomWidgets')).filter(
        Boolean
      )
    )

    const that = this
    console.log('Registering nodes', defs)

    // Register a node for each definition
    for (const nodeId in defs) {
      const nodeData = defs[nodeId]

      const node = Object.assign(
        function ComfyNode() {
          var inputs = nodeData['input']['required']
          if (nodeData['input']['optional'] != undefined) {
            inputs = Object.assign(
              {},
              nodeData['input']['required'],
              nodeData['input']['optional']
            )
          }
          const config = { minWidth: 1, minHeight: 1 }
          for (const inputName in inputs) {
            const inputData = inputs[inputName]
            const type = inputData[0]

            if (inputData[1]?.forceInput) {
              this.addInput(inputName, type)
            } else {
              if (Array.isArray(type)) {
                // Enums
                Object.assign(
                  config,
                  widgets.COMBO(this, inputName, inputData, config) || {}
                )
              } else if (`${type}:${inputName}` in widgets) {
                // Support custom widgets by Type:Name
                Object.assign(
                  config,
                  widgets[`${type}:${inputName}`](
                    this,
                    inputName,
                    inputData,
                    config
                  ) || {}
                )
              } else if (type in widgets) {
                // Standard type widgets
                Object.assign(
                  config,
                  widgets[type](this, inputName, inputData, config) || {}
                )
              } else {
                // Node connection inputs
                this.addInput(inputName, type)
              }
            }
          }

          for (const o in nodeData['output']) {
            const output = nodeData['output'][o]
            const outputName = nodeData['output_name'][o] || output
            const outputShape = nodeData['output_is_list'][o]
              ? LiteGraph.GRID_SHAPE
              : LiteGraph.CIRCLE_SHAPE
            this.addOutput(outputName, output, { shape: outputShape })
          }

          const s = this.computeSize()
          s[0] = Math.max(config.minWidth, s[0] * 1.5)
          s[1] = Math.max(config.minHeight, s[1])
          this.size = s
          this.serialize_widgets = true

          that.eventManager.invokeExtensions('nodeCreated', this)
        },
        {
          title: nodeData.display_name || nodeData.name,
          comfyClass: nodeData.name,
          category: nodeData.category
        }
      )

      node.prototype.comfyClass = nodeData.name

      this.#addDrawBackgroundHandler(node as any)

      await this.eventManager.invokeExtensions(
        'beforeRegisterNodeDef',
        node,
        nodeData
      )
      LiteGraph.registerNodeType(nodeId, node)

      // 注意需要在注册类型后，再设置 node 的 category 属性，否则会被覆盖
      node.category = nodeData.category
    }
  }

  /**
   * Adds Custom drawing logic for nodes
   * e.g. Draws images and handles thumbnail navigation on nodes that output images
   * @param node The node to add the draw handler
   */
  #addDrawBackgroundHandler(node) {
    const app = this

    function getImageTop(node: LGraphNode) {
      let shiftY: number
      if (node.imageOffset != null) {
        shiftY = node.imageOffset
      } else {
        if (node.widgets?.length) {
          const w = node.widgets[node.widgets.length - 1]
          shiftY = w.last_y
          if (w.computeSize) {
            shiftY += w.computeSize()[1] + 4
          } else if (w.computedHeight) {
            shiftY += w.computedHeight
          } else {
            shiftY += LiteGraph.NODE_WIDGET_HEIGHT + 4
          }
        } else {
          shiftY = node.computeSize()[1]
        }
      }
      return shiftY
    }

    node.prototype.setSizeForImage = function () {
      if (this.inputHeight) {
        this.setSize(this.size)
        return
      }
      const minHeight = getImageTop(this) + 220
      if (this.size[1] < minHeight) {
        this.setSize([this.size[0], minHeight])
      }
    }
    node.prototype.onDrawBackground = function (ctx) {
      if (!this.flags.collapsed) {
        let imgURLs = []
        let imagesChanged = false

        const output = app.stateHandler.nodeOutputs[this.id + '']
        if (output && output.images) {
          if (this.images !== output.images) {
            this.images = output.images
            imagesChanged = true
            imgURLs = imgURLs.concat(
              output.images.map((params) => {
                return api.apiURL(
                  '/view?' +
                    new URLSearchParams(params).toString() +
                    app.canvasManager.getPreviewFormatParam()
                )
              })
            )
          }
        }

        const preview = app.nodePreviewImages?.[this.id + '']
        if (this.preview !== preview) {
          this.preview = preview
          imagesChanged = true
          if (preview != null) {
            imgURLs.push(preview)
          }
        }

        if (imagesChanged) {
          this.imageIndex = null
          if (imgURLs.length > 0) {
            Promise.all(
              imgURLs.map((src) => {
                return new Promise((r) => {
                  const img = new Image()
                  img.onload = () => r(img)
                  img.onerror = () => r(null)
                  img.src = src
                })
              })
            ).then((imgs) => {
              if (
                (!output || this.images === output.images) &&
                (!preview || this.preview === preview)
              ) {
                this.imgs = imgs.filter(Boolean)
                this.setSizeForImage?.()
                app.canvasManager.graph.setDirtyCanvas(true)
              }
            })
          } else {
            this.imgs = null
          }
        }

        if (this.imgs && this.imgs.length) {
          const canvas = this.graph.list_of_graphcanvas[0]
          const mouse = canvas.graph_mouse
          if (!canvas.pointer_is_down && this.pointerDown) {
            if (
              mouse[0] === this.pointerDown.pos[0] &&
              mouse[1] === this.pointerDown.pos[1]
            ) {
              this.imageIndex = this.pointerDown.index
            }
            this.pointerDown = null
          }

          let w = this.imgs[0].naturalWidth
          let h = this.imgs[0].naturalHeight
          let imageIndex = this.imageIndex
          const numImages = this.imgs.length
          if (numImages === 1 && !imageIndex) {
            this.imageIndex = imageIndex = 0
          }

          const shiftY = getImageTop(this)

          let dw = this.size[0]
          let dh = this.size[1]
          dh -= shiftY

          if (imageIndex == null) {
            let best = 0
            let cellWidth
            let cellHeight
            let cols = 0
            let shiftX = 0
            for (let c = 1; c <= numImages; c++) {
              const rows = Math.ceil(numImages / c)
              const cW = dw / c
              const cH = dh / rows
              const scaleX = cW / w
              const scaleY = cH / h

              const scale = Math.min(scaleX, scaleY, 1)
              const imageW = w * scale
              const imageH = h * scale
              const area = imageW * imageH * numImages

              if (area > best) {
                best = area
                cellWidth = imageW
                cellHeight = imageH
                cols = c
                shiftX = c * ((cW - imageW) / 2)
              }
            }

            let anyHovered = false
            this.imageRects = []
            for (let i = 0; i < numImages; i++) {
              const img = this.imgs[i]
              const row = Math.floor(i / cols)
              const col = i % cols
              const x = col * cellWidth + shiftX
              const y = row * cellHeight + shiftY
              if (!anyHovered) {
                anyHovered = LiteGraph.isInsideRectangle(
                  mouse[0],
                  mouse[1],
                  x + this.pos[0],
                  y + this.pos[1],
                  cellWidth,
                  cellHeight
                )
                if (anyHovered) {
                  this.overIndex = i
                  let value = 110
                  if (canvas.pointer_is_down) {
                    if (!this.pointerDown || this.pointerDown.index !== i) {
                      this.pointerDown = { index: i, pos: [...mouse] }
                    }
                    value = 125
                  }
                  ctx.filter = `contrast(${value}%) brightness(${value}%)`
                  canvas.canvas.style.cursor = 'pointer'
                }
              }
              this.imageRects.push([x, y, cellWidth, cellHeight])
              ctx.drawImage(img, x, y, cellWidth, cellHeight)
              ctx.filter = 'none'
            }

            if (!anyHovered) {
              this.pointerDown = null
              this.overIndex = null
            }
          } else {
            // Draw individual
            const scaleX = dw / w
            const scaleY = dh / h
            const scale = Math.min(scaleX, scaleY, 1)

            w *= scale
            h *= scale

            let x = (dw - w) / 2
            let y = (dh - h) / 2 + shiftY
            ctx.drawImage(this.imgs[imageIndex], x, y, w, h)

            const drawButton = (x, y, sz, text) => {
              const hovered = LiteGraph.isInsideRectangle(
                mouse[0],
                mouse[1],
                x + this.pos[0],
                y + this.pos[1],
                sz,
                sz
              )
              let fill = '#333'
              let textFill = '#fff'
              let isClicking = false
              if (hovered) {
                canvas.canvas.style.cursor = 'pointer'
                if (canvas.pointer_is_down) {
                  fill = '#1e90ff'
                  isClicking = true
                } else {
                  fill = '#eee'
                  textFill = '#000'
                }
              } else {
                this.pointerWasDown = null
              }

              ctx.fillStyle = fill
              ctx.beginPath()
              ctx.roundRect(x, y, sz, sz, [4])
              ctx.fill()
              ctx.fillStyle = textFill
              ctx.font = '12px Arial'
              ctx.textAlign = 'center'
              ctx.fillText(text, x + 15, y + 20)

              return isClicking
            }

            if (numImages > 1) {
              if (
                drawButton(
                  x + w - 35,
                  y + h - 35,
                  30,
                  `${this.imageIndex + 1}/${numImages}`
                )
              ) {
                let i =
                  this.imageIndex + 1 >= numImages ? 0 : this.imageIndex + 1
                if (!this.pointerDown || !this.pointerDown.index === i) {
                  this.pointerDown = { index: i, pos: [...mouse] }
                }
              }

              if (drawButton(x + w - 35, y + 5, 30, `x`)) {
                if (!this.pointerDown || !this.pointerDown.index === null) {
                  this.pointerDown = { index: null, pos: [...mouse] }
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Draws node highlights (executing, drag drop) and progress bar
   */
  #addDrawNodeHandler() {
    const origDrawNode = LGraphCanvas.prototype.drawNode
    const origDrawNodeShape = LGraphCanvas.prototype.drawNodeShape
    const self = this

    LGraphCanvas.prototype.drawNodeShape = function (
      node: LGraphNode,
      ctx,
      size,
      fgcolor,
      bgcolor,
      selected,
      mouse_over
    ) {
      const res = origDrawNodeShape.apply(this, arguments)

      const nodeErrors = self.stateHandler.lastNodeErrors?.[
        node.id
      ] as NodeError

      let color = null
      let lineWidth = 1
      if (node.id === +self.stateHandler.runningNodeId) {
        color = '#0f0'
      } else if (self.dragOverNode && node.id === self.dragOverNode.id) {
        color = 'dodgerblue'
      } else if (nodeErrors?.errors) {
        color = 'red'
        lineWidth = 2
      } else if (
        self.stateHandler.lastExecutionError &&
        +self.stateHandler.lastExecutionError.node_id === node.id
      ) {
        color = '#f0f'
        lineWidth = 2
      }

      if (color) {
        const shape = node._shape || node.shape || LiteGraph.ROUND_SHAPE
        ctx.lineWidth = lineWidth
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        if (shape == LiteGraph.BOX_SHAPE)
          ctx.rect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT
          )
        else if (
          shape == LiteGraph.ROUND_SHAPE ||
          (shape == LiteGraph.CARD_SHAPE && node.flags.collapsed)
        )
          ctx.roundRect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT,
            this.round_radius * 2
          )
        else if (shape == LiteGraph.CARD_SHAPE)
          ctx.roundRect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT,
            [this.round_radius * 2, this.round_radius * 2, 2, 2]
          )
        else if (shape == LiteGraph.CIRCLE_SHAPE)
          ctx.arc(
            size[0] * 0.5,
            size[1] * 0.5,
            size[0] * 0.5 + 6,
            0,
            Math.PI * 2
          )
        ctx.strokeStyle = color
        ctx.stroke()
        ctx.strokeStyle = fgcolor
        ctx.globalAlpha = 1
      }

      if (
        self.progressManager.progress &&
        node.id === +self.stateHandler.runningNodeId
      ) {
        ctx.fillStyle = 'green'
        ctx.fillRect(
          0,
          0,
          size[0] *
            (self.progressManager.progress.value /
              self.progressManager.progress.max),
          6
        )
        ctx.fillStyle = bgcolor
      }

      // Highlight inputs that failed validation
      if (nodeErrors) {
        ctx.lineWidth = 2
        ctx.strokeStyle = 'red'
        for (const error of nodeErrors.errors) {
          if (error.extra_info && error.extra_info.input_name) {
            const inputIndex = node.findInputSlot(error.extra_info.input_name)
            if (inputIndex !== -1) {
              let pos = node.getConnectionPos(true, inputIndex)
              ctx.beginPath()
              ctx.arc(
                pos[0] - node.pos[0],
                pos[1] - node.pos[1],
                12,
                0,
                2 * Math.PI,
                false
              )
              ctx.stroke()
            }
          }
        }
      }

      return res
    }

    LGraphCanvas.prototype.drawNode = function (node, ctx) {
      var editor_alpha = this.editor_alpha
      var old_color = node.bgcolor

      if (node.mode === 2) {
        // never
        this.editor_alpha = 0.4
      }

      if (node.mode === 4) {
        // never
        node.bgcolor = '#FF00FF'
        this.editor_alpha = 0.2
      }

      const res = origDrawNode.apply(this, arguments)

      this.editor_alpha = editor_alpha
      node.bgcolor = old_color

      return res
    }
  }
}