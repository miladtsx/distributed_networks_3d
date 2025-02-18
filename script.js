/**
 * Represents a Bitcoin node in the network
 */
class BitcoinNode {
    /**
     * @param {BABYLON.Scene} scene - The Babylon.js scene
     * @param {BABYLON.Vector3} position - Initial position of the node
     * @param {string} nodeId - Unique identifier for the node
     */
    constructor(scene, position, nodeId) {
        this.nodeId = nodeId;
        this.connections = new Set();

        // Create visual representation of the node
        this.mesh = BABYLON.MeshBuilder.CreateSphere(`node-${nodeId}`, {
            diameter: 0.5
        }, scene);
        this.mesh.position = position;

        // Create material for the node
        this.material = new BABYLON.StandardMaterial(`nodeMaterial-${nodeId}`, scene);
        this.material.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.8);
        this.mesh.material = this.material;
    }

    /**
     * Connect this node to another node
     * @param {BitcoinNode} otherNode - The node to connect to
     * @param {BABYLON.Scene} scene - The Babylon.js scene
     */
    connectTo(otherNode, scene) {
        if (this.connections.has(otherNode.nodeId)) {
            return;
        }

        // Create bidirectional connection
        this.connections.add(otherNode.nodeId);
        otherNode.connections.add(this.nodeId);

        // Create visual connection line
        const points = [
            this.mesh.position,
            otherNode.mesh.position
        ];

        const lines = BABYLON.MeshBuilder.CreateLines(
            `connection-${this.nodeId}-${otherNode.nodeId}`, 
            {
                points: points,
                updatable: true
            }, 
            scene
        );

        lines.color = new BABYLON.Color3(0.3, 0.3, 0.3);
    }

    /**
     * Simulate node syncing with a progress indicator
     * @param {number} progress - Sync progress from 0 to 1
     * @param {BABYLON.Scene} scene - The Babylon.js scene
     */
    showSyncProgress(progress, scene) {
        this.material.emissiveColor = new BABYLON.Color3(0.3, 0.8, 0.3);
        // Create or update progress ring
        if (!this.syncRing) {
            this.syncRing = BABYLON.MeshBuilder.CreateTorus("syncRing", {
                diameter: 0.7,
                thickness: 0.1
            }, scene);
            this.syncRing.parent = this.mesh;
        }
        this.syncRing.scaling.y = progress;
    }

    /**
     * Show processing state
     * @param {boolean} isProcessing - Whether node is processing
     */
    setProcessing(isProcessing) {
        if (isProcessing) {
            this.material.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0.2);
        } else {
            this.material.emissiveColor = BABYLON.Color3.Black();
        }
    }

    /**
     * Remove connection to another node
     * @param {string} otherNodeId - The ID of the node to disconnect from
     */
    removeConnection(otherNodeId) {
        this.connections.delete(otherNodeId);
    }

    /**
     * Simulate node shutdown
     * @param {BABYLON.Scene} scene - The Babylon.js scene
     * @param {BitcoinNode[]} nodes - Array of all nodes in the network
     */
    shutdown(scene, nodes) {
        // Remove this node's connections from other nodes
        nodes.forEach(node => {
            if (node !== this) {
                node.removeConnection(this.nodeId);
            }
        });

        // Dispose of all connection lines for this node
        scene.meshes.slice().forEach(mesh => {
            if (mesh.name.startsWith(`connection-${this.nodeId}-`) ||
                mesh.name.startsWith(`connection-`) && mesh.name.includes(`-${this.nodeId}`)) {
                mesh.dispose();
            }
        });

        const fadeOut = new BABYLON.Animation(
            "fadeOut",
            "visibility",
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const keys = [];
        keys.push({ frame: 0, value: 1 });
        keys.push({ frame: 30, value: 0 });
        fadeOut.setKeys(keys);

        this.mesh.animations.push(fadeOut);
        scene.beginAnimation(this.mesh, 0, 30, false, 1, () => {
            this.mesh.dispose();
            this.material.dispose();
        });
    }

    /**
     * Send a packet to another node
     * @param {BitcoinNode} targetNode - The receiving node
     * @param {BABYLON.Scene} scene - The Babylon.js scene
     * @param {string} type - Type of packet ("block", "transaction", or "peer")
     */
    sendPacket(targetNode, scene, type) {
        // For peer discovery packets, we don't need an existing connection
        if (type !== "peer" && !this.connections.has(targetNode.nodeId)) {
            console.warn(`Attempted to send ${type} packet without connection between ${this.nodeId} and ${targetNode.nodeId}`);
            return;
        }

        // Create packet mesh
        const packet = BABYLON.MeshBuilder.CreateBox("packet", {
            size: 0.2
        }, scene);

        // Set packet color based on type
        const packetMaterial = new BABYLON.StandardMaterial("packetMaterial", scene);
        switch (type) {
            case "block":
                packetMaterial.emissiveColor = new BABYLON.Color3(1, 0.7, 0); // Gold
                break;
            case "transaction":
                packetMaterial.emissiveColor = new BABYLON.Color3(0, 1, 0.3); // Green
                break;
            case "peer":
                packetMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.6, 1); // Blue
                break;
        }
        packetMaterial.alpha = 0.9;
        packet.material = packetMaterial;

        // Add glow layer if not exists
        if (!scene.glowLayer) {
            scene.glowLayer = new BABYLON.GlowLayer("glow", scene);
            scene.glowLayer.intensity = 0.5;
        }
        scene.glowLayer.addIncludedOnlyMesh(packet);

        // Position at source node
        packet.position = this.mesh.position.clone();

        // Create animation
        const frameRate = 30;
        const animDuration = 1;

        const animation = new BABYLON.Animation(
            "packetAnimation",
            "position",
            frameRate,
            BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        // Animation keys
        const keys = [];
        keys.push({
            frame: 0,
            value: this.mesh.position.clone()
        });

        // Add some curve to the packet path
        const midPoint = BABYLON.Vector3.Lerp(this.mesh.position, targetNode.mesh.position, 0.5);
        midPoint.y += 0.5; // Add some height to the curve

        keys.push({
            frame: frameRate * animDuration / 2,
            value: midPoint
        });

        keys.push({
            frame: frameRate * animDuration,
            value: targetNode.mesh.position.clone()
        });

        animation.setKeys(keys);

        // Add easing
        const easingFunction = new BABYLON.QuadraticEase();
        easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
        animation.setEasingFunction(easingFunction);

        packet.animations.push(animation);

        // Run animation and cleanup
        scene.beginAnimation(packet, 0, frameRate * animDuration, false, 1, () => {
            packet.dispose();
            packetMaterial.dispose();
        });
    }

    /**
     * Clean up node resources
     */
    dispose() {
        if (this.syncRing) {
            this.syncRing.dispose();
        }
        if (this.mesh) {
            this.mesh.dispose();
        }
        if (this.material) {
            this.material.dispose();
        }
    }
}

// Add these constants at the top of the file
const PHASES = {
    DISCOVERY: "discovery",
    SYNCING: "syncing",
    PROCESSING: "processing",
    NETWORK_CHANGES: "network_changes"
};

const COLORS = {
    LIGHT: {
        background: new BABYLON.Color3(0.95, 0.95, 0.95),
        node: new BABYLON.Color3(0.2, 0.5, 0.8),
        connection: new BABYLON.Color3(0.6, 0.6, 0.6),
        text: "black",
        panel: "rgba(255, 255, 255, 0.8)",
        button: "#e0e0e0"
    },
    DARK: {
        background: new BABYLON.Color3(0.05, 0.05, 0.05),
        node: new BABYLON.Color3(0.2, 0.5, 0.8),
        connection: new BABYLON.Color3(0.3, 0.3, 0.3),
        text: "white",
        panel: "rgba(0, 0, 0, 0.7)",
        button: "#454545"
    }
};

// Update these constants near the top with other constants
const PHASE_INFO = {
    [PHASES.DISCOVERY]: {
        icon: "🔍",
        title: "Peer Discovery",
        description: "Nodes discover and establish connections with other peers in the distributed network."
    },
    [PHASES.SYNCING]: {
        icon: "🔄",
        title: "State Synchronization",
        description: "Nodes synchronize their state data to maintain consistency across the network."
    },
    [PHASES.PROCESSING]: {
        icon: "⚡",
        title: "Distributed Processing",
        description: "Nodes collaboratively process and validate operations across the network."
    },
    [PHASES.NETWORK_CHANGES]: {
        icon: "🌐",
        title: "Network Evolution",
        description: "The network adapts as nodes dynamically join or leave the system."
    }
};

// Add these constants near the top with other constants
const ELEMENT_INFO = {
    NODE: {
        icon: "⚫",
        title: "Inactive Node",
        description: "A node in its default state, ready to participate in the network."
    },
    ACTIVE_NODE: {
        icon: "🟡",
        title: "Processing Node",
        description: "A node that is actively processing transactions."
    },
    SYNC_RING: {
        icon: "��",
        title: "Syncing Node",
        description: "A node that is synchronizing with the network (green glow with progress ring)."
    },
    CONNECTION: {
        icon: "➖",
        title: "Connection",
        description: "Network connection between two nodes (gray line)."
    },
    PACKETS: {
        BLOCK: {
            icon: "🟨",
            title: "Block Packet",
            description: "Gold-colored packet representing data being shared."
        },
        TRANSACTION: {
            icon: "🟩",
            title: "Transaction Packet",
            description: "Green-colored packet representing new transaction data."
        }
    }
};

/**
 * Creates and manages the Bitcoin network simulation scene
 */
function createScene() {
    // Create the Babylon.js engine
    const canvas = document.getElementById("renderCanvas");
    const engine = new BABYLON.Engine(canvas, true);

    // Create the scene
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.05, 0.05, 0.05);

    // Create the camera
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        0,
        Math.PI / 3,
        20,
        BABYLON.Vector3.Zero(),
        scene
    );
    camera.attachControl(canvas, true);

    // Create the light
    const light = new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );

    // Simulation state
    let simulationState = {
        speed: 1,
        isRunning: true,
        initialNodeCount: 1,  // Changed to start with 1 node
        nodeCount: 1,         // Changed to start with 1 node
        currentStep: 0,
        currentPhase: PHASES.NETWORK_CHANGES, // Start with network changes phase
        isDarkMode: true,
        phaseTimer: 6900     // Start near the end of network changes phase
    };

    // Create GUI
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    // Create control panel container
    const panel = new BABYLON.GUI.StackPanel();
    panel.width = "220px";
    panel.height = "50px"; // Reduced height since we removed sliders
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    panel.background = "rgba(0, 0, 0, 0.7)";
    panel.paddingBottom = "10px";
    panel.paddingLeft = "10px";
    advancedTexture.addControl(panel);

    // Control buttons
    const buttonPanel = new BABYLON.GUI.StackPanel();
    buttonPanel.isVertical = false;
    buttonPanel.height = "40px";
    buttonPanel.spacing = 10; // Add spacing between buttons
    panel.addControl(buttonPanel);

    // Reset button with improved styling
    const resetBtn = BABYLON.GUI.Button.CreateSimpleButton("reset", "↺ Reset");
    resetBtn.width = "95px";
    resetBtn.height = "35px";
    resetBtn.color = "white";
    resetBtn.fontSize = "16px";
    resetBtn.background = "#454545";
    resetBtn.cornerRadius = 8;
    resetBtn.hoverCursor = "pointer";

    // Add hover effect
    resetBtn.onPointerEnterObservable.add(() => {
        resetBtn.background = "#666666";
    });
    resetBtn.onPointerOutObservable.add(() => {
        resetBtn.background = "#454545";
    });

    resetBtn.onPointerClickObservable.add(() => {
        window.location.reload();  // Replace resetSimulation() with page refresh
    });
    buttonPanel.addControl(resetBtn);

    // Play/Pause button with improved styling
    const playPauseBtn = BABYLON.GUI.Button.CreateSimpleButton("playPause", "⏸️ Pause");
    playPauseBtn.width = "95px";
    playPauseBtn.height = "35px";
    playPauseBtn.color = "white";
    playPauseBtn.fontSize = "16px";
    playPauseBtn.background = "#454545";
    playPauseBtn.cornerRadius = 8;
    playPauseBtn.hoverCursor = "pointer";

    // Add hover effect
    playPauseBtn.onPointerEnterObservable.add(() => {
        playPauseBtn.background = "#666666";
    });
    playPauseBtn.onPointerOutObservable.add(() => {
        playPauseBtn.background = "#454545";
    });

    playPauseBtn.onPointerClickObservable.add(() => {
        simulationState.isRunning = !simulationState.isRunning;
        playPauseBtn.textBlock.text = simulationState.isRunning ? "⏸️ Pause" : "▶️ Play";
    });
    buttonPanel.addControl(playPauseBtn);

    const title = "Dynamic Distributed Network Simulation";

    // Create 3D title text
    const titleText = new BABYLON.GUI.TextBlock();
    titleText.text = title;
    titleText.color = "white";
    titleText.fontSize = "32px"; // Larger font size
    titleText.height = "160px";
    titleText.top = "20px";
    titleText.paddingLeft = "20px";
    titleText.paddingRight = "20px";
    titleText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    titleText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    titleText.textWrapping = true;
    titleText.fontFamily = "Arial Black"; // Bolder font
    titleText.outlineWidth = 4;
    titleText.outlineColor = "#0066cc";

    // Create shadow effect with multiple layers
    const shadowLayers = 4;
    const shadowOffset = 2;
    const shadowColor = "rgba(0, 102, 204, 0.3)"; // Blue shadow with transparency

    for (let i = 0; i < shadowLayers; i++) {
        const shadowText = new BABYLON.GUI.TextBlock();
        shadowText.text = title;
        shadowText.fontSize = titleText.fontSize;
        shadowText.height = titleText.height;
        shadowText.top = `${20 + (i * shadowOffset)}px`;
        shadowText.paddingLeft = titleText.paddingLeft;
        shadowText.paddingRight = titleText.paddingRight;
        shadowText.textHorizontalAlignment = titleText.textHorizontalAlignment;
        shadowText.verticalAlignment = titleText.verticalAlignment;
        shadowText.textWrapping = true;
        shadowText.fontFamily = titleText.fontFamily;
        shadowText.color = shadowColor;
        shadowText.zIndex = -i; // Place behind main text
        advancedTexture.addControl(shadowText);
    }

    // Add main text last so it appears on top
    advancedTexture.addControl(titleText);

    // Instructions text (for phase updates)
    const instructionsText = new BABYLON.GUI.TextBlock();
    instructionsText.text = "";
    instructionsText.color = "white";
    instructionsText.fontSize = "24px";
    instructionsText.height = "40px";
    instructionsText.top = "140px"; // Increased spacing from title
    instructionsText.paddingLeft = "20px";
    instructionsText.paddingRight = "20px";
    instructionsText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    instructionsText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    instructionsText.textWrapping = true;
    instructionsText.fontFamily = "Arial Black";
    instructionsText.outlineWidth = 2;

    // Phase-based neon colors
    const PHASE_STYLES = {
        [PHASES.DISCOVERY]: {
            color: "#00ffff", // Cyan
            outlineColor: "#00808080",
            glowColor: "rgba(0, 255, 255, 0.3)"
        },
        [PHASES.SYNCING]: {
            color: "#ff00ff", // Magenta
            outlineColor: "#80008080",
            glowColor: "rgba(255, 0, 255, 0.3)"
        },
        [PHASES.PROCESSING]: {
            color: "#00ff00", // Neon Green
            outlineColor: "#00800080",
            glowColor: "rgba(0, 255, 0, 0.3)"
        },
        [PHASES.NETWORK_CHANGES]: {
            color: "#ff9900", // Neon Orange
            outlineColor: "#804d0080",
            glowColor: "rgba(255, 153, 0, 0.3)"
        }
    };

    // Create shadow effect for instructions
    const instructionsShadowLayers = 3;
    const instructionsShadowOffset = 1;
    const instructionsShadows = [];

    for (let i = 0; i < instructionsShadowLayers; i++) {
        const shadowText = new BABYLON.GUI.TextBlock();
        shadowText.text = "";
        shadowText.fontSize = instructionsText.fontSize;
        shadowText.height = instructionsText.height;
        shadowText.top = `${140 + (i * instructionsShadowOffset)}px`;
        shadowText.paddingLeft = instructionsText.paddingLeft;
        shadowText.paddingRight = instructionsText.paddingRight;
        shadowText.textHorizontalAlignment = instructionsText.textHorizontalAlignment;
        shadowText.verticalAlignment = instructionsText.verticalAlignment;
        shadowText.textWrapping = true;
        shadowText.fontFamily = instructionsText.fontFamily;
        shadowText.zIndex = -i;
        instructionsShadows.push(shadowText);
        advancedTexture.addControl(shadowText);
    }

    // Add main instructions text last
    advancedTexture.addControl(instructionsText);

    // Add theme toggle button
    const themeBtn = BABYLON.GUI.Button.CreateSimpleButton("theme", "☀️");
    themeBtn.width = "40px";
    themeBtn.height = "40px";
    themeBtn.color = simulationState.isDarkMode ? COLORS.DARK.text : COLORS.LIGHT.text;
    themeBtn.background = simulationState.isDarkMode ? COLORS.DARK.button : COLORS.LIGHT.button;
    themeBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    themeBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    themeBtn.top = "10px";
    themeBtn.right = "10px";

    themeBtn.onPointerClickObservable.add(() => {
        simulationState.isDarkMode = !simulationState.isDarkMode;
        themeBtn.textBlock.text = simulationState.isDarkMode ? "☀️" : "🌙";
        updateTheme();
    });
    advancedTexture.addControl(themeBtn);

    // Add this inside createScene() function, after creating other UI elements
    function createAgendaModal(advancedTexture) {
        // Create modal container
        const modal = new BABYLON.GUI.Rectangle("modal");
        modal.width = "800px"; // Increased width
        modal.height = "600px"; // Increased height
        modal.thickness = 0;
        modal.isVisible = false;
        modal.zIndex = 100;
        modal.background = simulationState.isDarkMode ? "rgba(30, 30, 30, 0.95)" : "rgba(240, 240, 240, 0.95)";
        modal.cornerRadius = 10;
        advancedTexture.addControl(modal);

        // Create scrollable container
        const scrollViewer = new BABYLON.GUI.ScrollViewer("scrollViewer");
        scrollViewer.width = "100%";
        scrollViewer.height = "100%";
        scrollViewer.thickness = 0;
        modal.addControl(scrollViewer);

        // Create main content container
        const contentPanel = new BABYLON.GUI.StackPanel("contentPanel");
        contentPanel.width = "100%";
        contentPanel.spacing = 20;
        scrollViewer.addControl(contentPanel);

        // Create title
        const title = new BABYLON.GUI.TextBlock("modalTitle");
        title.text = "Simulation Guide";
        title.color = simulationState.isDarkMode ? "white" : "black";
        title.fontSize = "24px";
        title.height = "40px";
        title.fontFamily = "Arial Black";
        title.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        contentPanel.addControl(title);

        // Create sections
        const createSection = (title, items, itemCreator) => {
            const sectionTitle = new BABYLON.GUI.TextBlock();
            sectionTitle.text = title;
            sectionTitle.color = simulationState.isDarkMode ? "#00aaff" : "#0066cc";
            sectionTitle.fontSize = "20px";
            sectionTitle.height = "30px";
            sectionTitle.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            sectionTitle.left = "20px";
            sectionTitle.paddingTop = "20px";
            contentPanel.addControl(sectionTitle);

            items.forEach(item => {
                itemCreator(item, contentPanel);
            });
        };

        // Create phase item
        const createPhaseItem = ([phase, info], parent) => {
            const container = new BABYLON.GUI.Rectangle(`phase-${phase}`);
            container.height = "70px";
            container.thickness = 0;
            container.background = "transparent";
            parent.addControl(container);

            const headerText = new BABYLON.GUI.TextBlock();
            headerText.text = `${info.icon} ${info.title}`;
            headerText.color = PHASE_STYLES[phase].color;
            headerText.fontSize = "18px";
            headerText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            headerText.left = "20px";
            headerText.top = "-20px";
            container.addControl(headerText);

            const descText = new BABYLON.GUI.TextBlock();
            descText.text = info.description;
            descText.color = simulationState.isDarkMode ? "white" : "black";
            descText.fontSize = "14px";
            descText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            descText.textWrapping = true;
            descText.left = "20px";
            descText.top = "10px";
            container.addControl(descText);
        };

        // Create element item
        const createElementItem = (info, parent) => {
            const container = new BABYLON.GUI.Rectangle();
            container.height = "60px";
            container.thickness = 0;
            container.background = "transparent";
            parent.addControl(container);

            const headerText = new BABYLON.GUI.TextBlock();
            headerText.text = `${info.icon} ${info.title}`;
            headerText.color = simulationState.isDarkMode ? "#00ffaa" : "#008855";
            headerText.fontSize = "16px";
            headerText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            headerText.left = "20px";
            headerText.top = "-15px";
            container.addControl(headerText);

            const descText = new BABYLON.GUI.TextBlock();
            descText.text = info.description;
            descText.color = simulationState.isDarkMode ? "white" : "black";
            descText.fontSize = "14px";
            descText.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            descText.textWrapping = true;
            descText.left = "20px";
            descText.top = "10px";
            container.addControl(descText);
        };

        // Add sections
        createSection("Simulation Phases", Object.entries(PHASE_INFO), createPhaseItem);
        
        createSection("Network Elements", [
            ELEMENT_INFO.NODE,
            ELEMENT_INFO.ACTIVE_NODE,
            ELEMENT_INFO.SYNC_RING,
            ELEMENT_INFO.CONNECTION
        ], createElementItem);
        
        createSection("Network Packets", [
            ELEMENT_INFO.PACKETS.BLOCK,
            ELEMENT_INFO.PACKETS.TRANSACTION,
        ], createElementItem);

        // Create close button
        const closeBtn = BABYLON.GUI.Button.CreateSimpleButton("closeModal", "✕");
        closeBtn.width = "30px";
        closeBtn.height = "30px";
        closeBtn.color = simulationState.isDarkMode ? "white" : "black";
        closeBtn.thickness = 0;
        closeBtn.cornerRadius = 15;
        closeBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
        closeBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        closeBtn.top = "10px";
        closeBtn.right = "10px";
        closeBtn.onPointerClickObservable.add(() => {
            modal.isVisible = false;
        });
        modal.addControl(closeBtn);

        return modal;
    }

    // Add this after creating other buttons in createScene()
    const agendaBtn = BABYLON.GUI.Button.CreateSimpleButton("agenda", "ℹ️");
    agendaBtn.width = "40px";
    agendaBtn.height = "40px";
    agendaBtn.color = simulationState.isDarkMode ? COLORS.DARK.text : COLORS.LIGHT.text;
    agendaBtn.background = simulationState.isDarkMode ? COLORS.DARK.button : COLORS.LIGHT.button;
    agendaBtn.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    agendaBtn.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    agendaBtn.top = "60px";
    agendaBtn.right = "10px";
    agendaBtn.cornerRadius = 8;
    advancedTexture.addControl(agendaBtn);

    // Create the modal
    const agendaModal = createAgendaModal(advancedTexture);

    // Add click handler to agenda button
    agendaBtn.onPointerClickObservable.add(() => {
        agendaModal.isVisible = true;
    });

    // Update the updateTheme function to include the new elements
    function updateTheme() {
        const colors = simulationState.isDarkMode ? COLORS.DARK : COLORS.LIGHT;
        scene.clearColor = colors.background;
        panel.background = colors.panel;
        instructionsText.color = colors.text;
        themeBtn.color = colors.text;
        themeBtn.background = colors.button;
        resetBtn.background = colors.button;
        playPauseBtn.background = colors.button;
        agendaBtn.color = colors.text;
        agendaBtn.background = colors.button;
        
        // Update modal colors
        if (agendaModal) {
            agendaModal.background = simulationState.isDarkMode ? 
                "rgba(30, 30, 30, 0.95)" : "rgba(240, 240, 240, 0.95)";
            
            const scrollViewer = agendaModal.children.find(child => child.name === "scrollViewer");
            if (scrollViewer && scrollViewer.children[0]) {
                const contentPanel = scrollViewer.children[0];
                contentPanel.children.forEach(child => {
                    if (child.color) {
                        if (child.name === "modalTitle") {
                            child.color = simulationState.isDarkMode ? "white" : "black";
                        } else if (child.text && child.text.includes(":")) {
                            // Section titles
                            child.color = simulationState.isDarkMode ? "#00aaff" : "#0066cc";
                        }
                    }
                    
                    // Update description text colors
                    if (child instanceof BABYLON.GUI.Rectangle) {
                        const descText = child.children[1];
                        if (descText) {
                            descText.color = simulationState.isDarkMode ? "white" : "black";
                        }
                    }
                });
            }
        }
    }

    // Initialize theme
    updateTheme();

    // Create initial nodes
    const nodes = [];

    // Create initial single node
    const radius = 5;
    const position = new BABYLON.Vector3(radius, 0, 0);
    nodes.push(new BitcoinNode(scene, position, "node-0"));

    // Initialize with Network Changes Phase message
    updateInstructions();

    // Update simulation logic
    scene.onBeforeRenderObservable.add(() => {
        if (!simulationState.isRunning) return;

        simulationState.phaseTimer += scene.getEngine().getDeltaTime() * simulationState.speed;

        switch (simulationState.currentPhase) {
            case PHASES.DISCOVERY:
                handleDiscoveryPhase();
                if (simulationState.phaseTimer > 5000) {
                    simulationState.currentPhase = PHASES.SYNCING;
                    simulationState.phaseTimer = 0;
                    updateInstructions();
                }
                break;

            case PHASES.SYNCING:
                handleSyncingPhase();
                if (simulationState.phaseTimer > 8000) {
                    simulationState.currentPhase = PHASES.PROCESSING;
                    simulationState.phaseTimer = 0;
                    updateInstructions();
                }
                break;

            case PHASES.PROCESSING:
                handleProcessingPhase();
                if (simulationState.phaseTimer > 6000) {
                    simulationState.currentPhase = PHASES.NETWORK_CHANGES;
                    simulationState.phaseTimer = 0;
                    updateInstructions();
                }
                break;

            case PHASES.NETWORK_CHANGES:
                handleNetworkChanges();
                if (simulationState.phaseTimer > 7000) {
                    // Ensure we have exactly 2 nodes before moving to discovery phase
                    if (nodes.length < 2) {
                        // Add second node
                        const angle = Math.PI; // Position opposite to first node
                        const position = new BABYLON.Vector3(
                            radius * Math.cos(angle),
                            0,
                            radius * Math.sin(angle)
                        );
                        nodes.push(new BitcoinNode(scene, position, `node-1`));
                        simulationState.nodeCount = nodes.length;
                    }
                    simulationState.currentPhase = PHASES.DISCOVERY;
                    simulationState.phaseTimer = 0;
                    updateInstructions();
                }
                break;
        }
    });

    function handleDiscoveryPhase() {
        if (simulationState.currentStep % (3 / simulationState.speed) < 1) {
            const sourceNode = nodes[Math.floor(Math.random() * nodes.length)];
            const targetNode = nodes[Math.floor(Math.random() * nodes.length)];

            if (sourceNode !== targetNode && !sourceNode.connections.has(targetNode.nodeId)) {
                sourceNode.material.emissiveColor = new BABYLON.Color3(0.3, 0.6, 1);
                targetNode.material.emissiveColor = new BABYLON.Color3(0.3, 0.6, 1);

                // Send peer discovery packet
                sourceNode.sendPacket(targetNode, scene, "peer");

                // Create connection after a short delay
                setTimeout(() => {
                    sourceNode.material.emissiveColor = BABYLON.Color3.Black();
                    targetNode.material.emissiveColor = BABYLON.Color3.Black();
                    
                    // Create bidirectional connection
                    sourceNode.connectTo(targetNode, scene);
                }, 500 / simulationState.speed);
            }
        }
        
        if (simulationState.phaseTimer > 5000) {
            simulationState.currentPhase = PHASES.SYNCING;
            simulationState.phaseTimer = 0;
            updateInstructions();
        }
    }

    function handleSyncingPhase() {
        nodes.forEach(node => {
            const progress = (simulationState.phaseTimer % 2000) / 2000;
            node.showSyncProgress(progress, scene);

            if (Math.random() < 0.05 * simulationState.speed && node.connections.size > 0) {
                const connectedNodeIds = Array.from(node.connections);
                const targetNodeId = connectedNodeIds[Math.floor(Math.random() * connectedNodeIds.length)];
                const targetNode = nodes.find(n => n.nodeId === targetNodeId);
                
                // Verify bidirectional connection exists
                if (targetNode && node.connections.has(targetNode.nodeId) && targetNode.connections.has(node.nodeId)) {
                    node.sendPacket(targetNode, scene, "block");
                }
            }
        });
        
        if (simulationState.phaseTimer > 8000) {
            simulationState.currentPhase = PHASES.PROCESSING;
            simulationState.phaseTimer = 0;
            updateInstructions();
        }
    }

    function handleProcessingPhase() {
        if (simulationState.currentStep % (5 / simulationState.speed) < 1) {
            // Select random source node
            const sourceNode = nodes[Math.floor(Math.random() * nodes.length)];
            
            if (sourceNode.connections.size > 0) {
                // Get random connected node
                const connectedNodeIds = Array.from(sourceNode.connections);
                const targetNodeId = connectedNodeIds[Math.floor(Math.random() * connectedNodeIds.length)];
                const targetNode = nodes.find(node => node.nodeId === targetNodeId);

                if (targetNode) {
                    // Verify connection exists before sending packet
                    if (sourceNode.connections.has(targetNode.nodeId) && targetNode.connections.has(sourceNode.nodeId)) {
                        sourceNode.sendPacket(targetNode, scene, "transaction");
                        sourceNode.setProcessing(true);
                        setTimeout(() => {
                            sourceNode.setProcessing(false);
                        }, 1000 / simulationState.speed);
                    }
                }
            }
        }
        
        if (simulationState.phaseTimer > 6000) {
            simulationState.currentPhase = PHASES.NETWORK_CHANGES;
            simulationState.phaseTimer = 0;
            updateInstructions();
        }
    }

    function handleNetworkChanges() {
        // Only add/remove nodes after we have the initial 2 nodes
        if (simulationState.phaseTimer % 2000 < 20 && nodes.length >= 2) {
            const minNodes = 2;
            const maxNodes = Math.max(20, simulationState.initialNodeCount * 1.5);

            if (Math.random() < 0.5 && nodes.length > minNodes) {
                // Remove random node
                const index = Math.floor(Math.random() * nodes.length);
                const node = nodes[index];
                nodes.splice(index, 1);
                node.shutdown(scene, nodes);
                simulationState.nodeCount = nodes.length;
            } else if (nodes.length < maxNodes) {
                // Find a position that's not too close to existing nodes
                let angle;
                let position;
                let attempts = 0;
                const minDistance = radius * 0.8; // Minimum distance between nodes
                
                do {
                    angle = Math.random() * Math.PI * 2;
                    position = new BABYLON.Vector3(
                        radius * Math.cos(angle),
                        0,
                        radius * Math.sin(angle)
                    );
                    
                    // Check distance from all existing nodes
                    const isTooClose = nodes.some(node => 
                        BABYLON.Vector3.Distance(node.mesh.position, position) < minDistance
                    );
                    
                    if (!isTooClose) {
                        break;
                    }
                    
                    attempts++;
                } while (attempts < 10); // Limit attempts to prevent infinite loop
                
                // If we couldn't find a good spot after 10 attempts, 
                // try a different radius
                if (attempts >= 10) {
                    const alternateRadius = radius * (1 + Math.random() * 0.4); // 100-140% of original radius
                    position = new BABYLON.Vector3(
                        alternateRadius * Math.cos(angle),
                        0,
                        alternateRadius * Math.sin(angle)
                    );
                }
                
                nodes.push(new BitcoinNode(scene, position, `node-${Date.now()}`));
                simulationState.nodeCount = nodes.length;
            }
        }
        
        if (simulationState.phaseTimer > 7000) {
            // Ensure we have exactly 2 nodes before moving to discovery phase
            if (nodes.length < 2) {
                // Add second node
                const angle = Math.PI; // Position opposite to first node
                const position = new BABYLON.Vector3(
                    radius * Math.cos(angle),
                    0,
                    radius * Math.sin(angle)
                );
                nodes.push(new BitcoinNode(scene, position, `node-1`));
                simulationState.nodeCount = nodes.length;
            }
            simulationState.currentPhase = PHASES.DISCOVERY;
            simulationState.phaseTimer = 0;
            updateInstructions();
        }
    }

    function updateInstructions(text) {
        const phaseStyle = PHASE_STYLES[simulationState.currentPhase];
        const phaseInfo = PHASE_INFO[simulationState.currentPhase];

        // Update main text with title and description
        instructionsText.text = `${phaseInfo.icon} ${phaseInfo.title}\n${phaseInfo.description}`;
        instructionsText.color = phaseStyle.color;
        instructionsText.outlineColor = phaseStyle.outlineColor;
        instructionsText.height = "80px"; // Increased height to accommodate two lines

        // Update shadow layers
        instructionsShadows.forEach((shadow, index) => {
            shadow.text = instructionsText.text;
            shadow.color = phaseStyle.glowColor;
            shadow.height = "80px"; // Match the height
        });
    }

    // Update the responsive font sizing to include shadows
    window.addEventListener("resize", () => {
        const width = window.innerWidth;
        let titleSize, instructionsSize, instructionsTop;

        if (width < 600) {
            titleSize = "24px";
            instructionsSize = "18px";
            instructionsTop = "120px"; // Adjusted for better spacing on mobile
        } else if (width < 1024) {
            titleSize = "28px";
            instructionsSize = "20px";
            instructionsTop = "130px";
        } else {
            titleSize = "32px";
            instructionsSize = "24px";
            instructionsTop = "140px";
        }

        titleText.fontSize = titleSize;
        instructionsText.fontSize = instructionsSize;
        instructionsText.top = instructionsTop;

        // Update shadow layers
        instructionsShadows.forEach((shadow, i) => {
            shadow.fontSize = instructionsSize;
            shadow.top = `${parseInt(instructionsTop) + (i * instructionsShadowOffset)}px`;
        });
    });

    // Start the render loop
    engine.runRenderLoop(() => {
        scene.render();
    });

    // Handle window resize
    window.addEventListener("resize", () => {
        engine.resize();
    });
}
