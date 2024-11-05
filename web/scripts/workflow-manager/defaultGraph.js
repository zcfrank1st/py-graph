export const defaultGraph = {
	"last_node_id": 53,
	"last_link_id": 20,
	"nodes": [
	  {
		"id": 52,
		"type": "OutputToStdout",
		"pos": [
		  1338,
		  493
		],
		"size": {
		  "0": 210,
		  "1": 26
		},
		"flags": {},
		"order": 3,
		"mode": 0,
		"inputs": [
		  {
			"name": "value",
			"type": "FLOAT",
			"link": 20
		  }
		],
		"properties": {}
	  },
	  {
		"id": 53,
		"type": "Add",
		"pos": [
		  1062,
		  549
		],
		"size": {
		  "0": 210,
		  "1": 46
		},
		"flags": {},
		"order": 2,
		"mode": 0,
		"inputs": [
		  {
			"name": "operand1",
			"type": "FLOAT",
			"link": 18
		  },
		  {
			"name": "operand2",
			"type": "FLOAT",
			"link": 19
		  }
		],
		"outputs": [
		  {
			"name": "FLOAT",
			"type": "FLOAT",
			"links": [
			  20
			],
			"shape": 3,
			"slot_index": 0
		  }
		],
		"properties": {}
	  },
	  {
		"id": 50,
		"type": "FLOATValue",
		"pos": [
		  710,
		  397
		],
		"size": {
		  "0": 315,
		  "1": 58
		},
		"flags": {},
		"order": 0,
		"mode": 0,
		"outputs": [
		  {
			"name": "value",
			"type": "FLOAT",
			"links": [
			  18
			],
			"shape": 3,
			"slot_index": 0
		  }
		],
		"properties": {},
		"widgets_values": [
		  5
		]
	  },
	  {
		"id": 51,
		"type": "FLOATValue",
		"pos": [
		  661,
		  586
		],
		"size": {
		  "0": 315,
		  "1": 58
		},
		"flags": {},
		"order": 1,
		"mode": 0,
		"outputs": [
		  {
			"name": "value",
			"type": "FLOAT",
			"links": [
			  19
			],
			"shape": 3,
			"slot_index": 0
		  }
		],
		"properties": {},
		"widgets_values": [
		  6
		]
	  }
	],
	"links": [
	  [
		18,
		50,
		0,
		53,
		0,
		"FLOAT"
	  ],
	  [
		19,
		51,
		0,
		53,
		1,
		"FLOAT"
	  ],
	  [
		20,
		53,
		0,
		52,
		0,
		"FLOAT"
	  ]
	],
	"groups": [],
	"config": {},
	"extra": {},
	"version": 0.4
  }